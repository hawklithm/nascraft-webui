import { BaseDirectory } from '@tauri-apps/plugin-fs';
import { mkdir, writeTextFile, readTextFile, exists } from '@tauri-apps/plugin-fs';


/**
 * 上传状态枚举
 */
export const UploadStatus = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * 上传状态机类
 * 管理单个文件的上传状态，支持断点续传
 */
export class UploadStateMachine {
  /**
   * @param {string} filePath - 文件路径
   * @param {number} fileSize - 文件大小（字节）
   * @param {number} chunkCount - 总分片数
   * @param {string} md5 - 文件 MD5 哈希值
   */
  constructor(filePath, fileSize, chunkCount, md5) {
    this.filePath = filePath;
    this.fileSize = fileSize;
    this.chunkCount = chunkCount;
    this.md5 = md5;
    this.uploadedChunks = new Set();
    this.status = UploadStatus.PENDING;
    this.progress = 0;
    this.fileId = null;
    this.lastUpdated = Date.now();
    this.errorCount = 0;
  }

  /**
   * 标记分片已上传
   * @param {number} chunkIndex - 分片索引
   */
  markChunkUploaded(chunkIndex) {
    this.uploadedChunks.add(chunkIndex);
    this.progress = Math.round((this.uploadedChunks.size / this.chunkCount) * 100);
    this.lastUpdated = Date.now();
  }

  /**
   * 检查分片是否已上传
   * @param {number} chunkIndex - 分片索引
   * @returns {boolean}
   */
  isChunkUploaded(chunkIndex) {
    return this.uploadedChunks.has(chunkIndex);
  }

  /**
   * 设置文件 ID（从服务器元数据获取）
   * @param {string} fileId - 文件 ID
   */
  setFileId(fileId) {
    this.fileId = fileId;
  }

  /**
   * 设置上传状态
   * @param {string} status - 上传状态
   */
  setStatus(status) {
    this.status = status;
    this.lastUpdated = Date.now();
    if (status === UploadStatus.FAILED) {
      this.errorCount++;
    }
  }

  /**
   * 检查是否可以断点续传
   * @returns {boolean}
   */
  canResume() {
    return this.uploadedChunks.size > 0 && this.uploadedChunks.size < this.chunkCount;
  }

  /**
   * 获取下一个待上传的分片索引
   * @returns {number|null} 分片索引，如果没有则返回 null
   */
  getNextChunkIndex() {
    for (let i = 0; i < this.chunkCount; i++) {
      if (!this.uploadedChunks.has(i)) {
        return i;
      }
    }
    return null;
  }

  /**
   * 序列化状态对象
   * @returns {Object}
   */
  toJSON() {
    return {
      filePath: this.filePath,
      fileSize: this.fileSize,
      chunkCount: this.chunkCount,
      md5: this.md5,
      uploadedChunks: Array.from(this.uploadedChunks),
      status: this.status,
      progress: this.progress,
      fileId: this.fileId,
      lastUpdated: this.lastUpdated,
      errorCount: this.errorCount,
    };
  }

  /**
   * 从 JSON 对象反序列化
   * @param {Object} json - JSON 对象
   * @returns {UploadStateMachine}
   */
  static fromJSON(json) {
    const machine = new UploadStateMachine(
      json.filePath,
      json.fileSize,
      json.chunkCount,
      json.md5
    );
    machine.uploadedChunks = new Set(json.uploadedChunks || []);
    machine.status = json.status || UploadStatus.PENDING;
    machine.progress = json.progress || 0;
    machine.fileId = json.fileId;
    machine.lastUpdated = json.lastUpdated || Date.now();
    machine.errorCount = json.errorCount || 0;
    return machine;
  }

  /**
   * 保存状态到文件
   * @returns {Promise<void>}
   */
  async saveState() {
    try {
      // 确保 upload_states 目录存在
      const statesDir = 'upload_states';
      const statesDirExists = await exists(statesDir, { baseDir: BaseDirectory.AppData });
      if (!statesDirExists) {
        await mkdir(statesDir, { baseDir: BaseDirectory.AppData, recursive: true });
      }

      // 状态文件名：MD5.json
      const stateFileName = `${this.md5}.json`;

      const stateJSON = JSON.stringify(this.toJSON(), null, 2);
      await writeTextFile(`upload_states/${stateFileName}`, stateJSON, { baseDir: BaseDirectory.AppData });
    } catch (error) {
      console.error('Failed to save upload state:', error);
    }
  }

  /**
   * 从文件加载状态
   * @param {string} md5 - 文件 MD5 哈希值
   * @returns {Promise<UploadStateMachine|null>}
   */
  static async loadState(md5) {
    try {
      const stateFileName = `${md5}.json`;

      const existsFlag = await exists(`upload_states/${stateFileName}`, { baseDir: BaseDirectory.AppData });
      if (!existsFlag) {
        return null;
      }

      const stateJSON = await readTextFile(`upload_states/${stateFileName}`, { baseDir: BaseDirectory.AppData });
      const json = JSON.parse(stateJSON);
      return UploadStateMachine.fromJSON(json);
    } catch (error) {
      console.error('Failed to load upload state:', error);
      return null;
    }
  }

  /**
   * 创建或加载上传状态机
   * @param {string} filePath - 文件路径
   * @param {number} fileSize - 文件大小
   * @param {number} chunkCount - 总分片数
   * @param {string} md5 - 文件 MD5 哈希值
   * @returns {Promise<UploadStateMachine>}
   */
  static async loadOrCreate(filePath, fileSize, chunkCount, md5) {
    let machine = await UploadStateMachine.loadState(md5);
    if (machine) {
      // 如果文件路径或大小不匹配，创建新的状态机
      if (machine.filePath !== filePath || machine.fileSize !== fileSize) {
        machine = new UploadStateMachine(filePath, fileSize, chunkCount, md5);
        await machine.saveState();
      }
    } else {
      machine = new UploadStateMachine(filePath, fileSize, chunkCount, md5);
      await machine.saveState();
    }
    return machine;
  }

  /**
   * 删除状态文件
   * @param {string} md5 - 文件 MD5 哈希值
   * @returns {Promise<void>}
   */
  static async deleteState(md5) {
    try {
      const stateFileName = `${md5}.json`;
      const stateFilePath = `upload_states/${stateFileName}`;
      // TODO: 使用 fs 插件的 remove API 删除文件
      // 目前 Tauri fs 插件可能不直接支持删除，需要在状态文件中标记
      console.log(`State file ${stateFileName} should be deleted`);
    } catch (error) {
      console.error('Failed to delete upload state:', error);
    }
  }
}

export default UploadStateMachine;
