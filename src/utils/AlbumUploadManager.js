import { invoke } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { calculateMD5, submitMetadata, uploadChunk } from './UploadUtils';
import UploadStateMachine, { UploadStatus } from './UploadStateMachine';

const UPLOAD_DELAY_MS = 10000; // 每个文件上传后等待 10 秒
const MAX_RETRY_COUNT = 3; // 最大重试次数

/**
 * 相册上传管理器
 * 负责遍历相册、调度上传、管理上传队列
 */
export class AlbumUploadManager {
  constructor() {
    this.isUploading = false;
    this.shouldStop = false;
    this.uploadQueue = [];
    this.currentFileIndex = 0;
    this.failedFiles = [];
  }

  /**
   * 启动相册自动上传
   * @returns {Promise<void>}
   */
  async startAlbumUpload() {
    if (this.isUploading) {
      console.log('Album upload is already running');
      return;
    }

    try {
      this.isUploading = true;
      this.shouldStop = false;
      this.failedFiles = [];

      // 调用自定义插件获取相册图片路径列表
      console.log('Fetching album photo paths...');
      const photoPaths = await invoke('plugin:photo|get_album_paths');
      
      if (!photoPaths || photoPaths.length === 0) {
        console.log('No photos found in album');
        this.isUploading = false;
        return;
      }

      console.log(`Found ${photoPaths.length} photos in album`);
      this.uploadQueue = photoPaths;
      this.currentFileIndex = 0;

      // 开始逐个上传
      await this.processUploadQueue();

    } catch (error) {
      console.error('Failed to start album upload:', error);
      this.isUploading = false;
    }
  }

  /**
   * 停止相册上传
   */
  stopAlbumUpload() {
    this.shouldStop = true;
    this.isUploading = false;
    console.log('Album upload stopped');
  }

  /**
   * 处理上传队列
   * @returns {Promise<void>}
   */
  async processUploadQueue() {
    while (this.currentFileIndex < this.uploadQueue.length && !this.shouldStop) {
      const filePath = this.uploadQueue[this.currentFileIndex];
      
      try {
        await this.uploadSingleFile(filePath);
        this.currentFileIndex++;
        
        // 每个文件上传后等待 10 秒
        if (this.currentFileIndex < this.uploadQueue.length && !this.shouldStop) {
          console.log(`Waiting ${UPLOAD_DELAY_MS}ms before next upload...`);
          await this.sleep(UPLOAD_DELAY_MS);
        }
      } catch (error) {
        console.error(`Failed to upload file ${filePath}:`, error);
        this.failedFiles.push({
          filePath,
          error: error.message,
          timestamp: Date.now(),
        });
        this.currentFileIndex++;
      }
    }

    this.isUploading = false;
    console.log(`Album upload completed. Success: ${this.currentFileIndex}, Failed: ${this.failedFiles.length}`);
    
    if (this.failedFiles.length > 0) {
      console.log('Failed files:', this.failedFiles);
    }
  }

  /**
   * 上传单个文件（支持断点续传）
   * @param {string} filePath - 文件路径
   * @returns {Promise<void>}
   */
  async uploadSingleFile(filePath) {
    console.log(`Uploading file: ${filePath}`);
    
    try {
      // 读取文件内容
      const fileContent = await readFile(filePath);
      if (!fileContent || fileContent.length === 0) {
        console.log(`File ${filePath} is empty, skipping`);
        return;
      }

      const file = new Blob([fileContent]);
      const fileName = filePath.split(/[/\\]/).pop();
      file.name = fileName;

      // 计算 MD5
      const md5Hash = await calculateMD5(file);
      console.log(`File MD5: ${md5Hash}`);

      // 提交元数据
      const metaData = await submitMetadata(file, md5Hash, '');
      const { chunks, total_chunks } = metaData;

      // 创建或加载上传状态机
      const stateMachine = await UploadStateMachine.loadOrCreate(
        filePath,
        file.size,
        total_chunks,
        md5Hash
      );

      // 如果已完成，跳过
      if (stateMachine.status === UploadStatus.COMPLETED) {
        console.log(`File ${filePath} already uploaded, skipping`);
        return;
      }

      // 设置文件 ID
      stateMachine.setFileId(metaData.id);
      stateMachine.setStatus(UploadStatus.UPLOADING);
      await stateMachine.saveState();

      // 更新上传进度
      const progressCallback = (filePath, progress, status) => {
        if (progressCallback) {
          progressCallback(filePath, progress, status);
        }
      };

      // 上传分片（支持断点续传）
      for (const chunk of chunks) {
        if (this.shouldStop) {
          stateMachine.setStatus(UploadStatus.PAUSED);
          await stateMachine.saveState();
          throw new Error('Upload stopped by user');
        }

        // 如果分片已上传，跳过
        if (stateMachine.isChunkUploaded(chunk.index)) {
          console.log(`Chunk ${chunk.index} already uploaded, skipping`);
          continue;
        }

        console.log(`Uploading chunk ${chunk.index}/${total_chunks}`);
        
        let retryCount = 0;
        let uploadSuccess = false;

        // 重试机制
        while (retryCount < MAX_RETRY_COUNT && !uploadSuccess && !this.shouldStop) {
          try {
            uploadSuccess = await uploadChunk(file, chunk, metaData.id);
            
            if (uploadSuccess) {
              stateMachine.markChunkUploaded(chunk.index);
              await stateMachine.saveState();
              console.log(`Chunk ${chunk.index} uploaded successfully`);
            } else {
              retryCount++;
              console.warn(`Chunk ${chunk.index} upload failed, retry ${retryCount}/${MAX_RETRY_COUNT}`);
              if (retryCount < MAX_RETRY_COUNT) {
                await this.sleep(2000); // 重试前等待 2 秒
              }
            }
          } catch (error) {
            retryCount++;
            console.error(`Chunk ${chunk.index} upload error:`, error);
            if (retryCount < MAX_RETRY_COUNT) {
              await this.sleep(2000); // 重试前等待 2 秒
            }
          }
        }

        if (!uploadSuccess) {
          throw new Error(`Chunk ${chunk.index} upload failed after ${MAX_RETRY_COUNT} retries`);
        }
      }

      // 所有分片上传完成
      stateMachine.setStatus(UploadStatus.COMPLETED);
      await stateMachine.saveState();
      console.log(`File ${filePath} upload completed successfully`);

    } catch (error) {
      console.error(`Upload file ${filePath} failed:`, error);
      throw error;
    }
  }

  /**
   * 检查相册自动上传是否启用
   * @returns {Promise<boolean>}
   */
  async checkAutoUploadConfig() {
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const { BaseDirectory } = await import('@tauri-apps/plugin-fs');
      
      const sysConfContent = await readTextFile('sys.conf', { baseDir: BaseDirectory.AppConfig });
      const sysConfJson = JSON.parse(sysConfContent);
      
      return sysConfJson.autoUploadAlbum === true;
    } catch (error) {
      console.error('Failed to check auto upload config:', error);
      return false;
    }
  }

  /**
   * 睡眠指定毫秒数
   * @param {number} ms - 毫秒数
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取上传统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      totalFiles: this.uploadQueue.length,
      currentIndex: this.currentFileIndex,
      completedCount: this.currentFileIndex,
      failedCount: this.failedFiles.length,
      isUploading: this.isUploading,
      shouldStop: this.shouldStop,
    };
  }
}

// 单例模式
let albumUploadManagerInstance = null;

/**
 * 获取 AlbumUploadManager 单例
 * @returns {AlbumUploadManager}
 */
export const getAlbumUploadManager = () => {
  if (!albumUploadManagerInstance) {
    albumUploadManagerInstance = new AlbumUploadManager();
  }
  return albumUploadManagerInstance;
};

export default AlbumUploadManager;
