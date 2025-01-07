import { readFile,watch, BaseDirectory } from '@tauri-apps/plugin-fs';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { apiFetch, config } from './apiFetch';
import SparkMD5 from 'spark-md5';
import { audioDir, appDataDir, documentDir, downloadDir, pictureDir, videoDir } from '@tauri-apps/api/path';
import { sep } from '@tauri-apps/api/path';

const sysConfName = 'sys.conf';

let currentWatchDirs = new Set();
let isWatching = false;

// 添加上传进度管理
let uploadProgressMap = new Map();
let uploadProgressCallback = null;

export const setUploadProgressCallback = (callback) => {
  uploadProgressCallback = callback;
};

const updateUploadProgress = (filePath, progress, status = 'uploading') => {
  uploadProgressMap.set(filePath, { progress, status, timestamp: Date.now() });
  if (uploadProgressCallback) {
    uploadProgressCallback(Array.from(uploadProgressMap.entries()));
  }
};

const calculateMD5 = (file) => {
  return new Promise((resolve, reject) => {
    const chunkSize = 2097152; // Read in chunks of 2MB
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();
    let cursor = 0;

    fileReader.onload = (e) => {
      spark.append(e.target.result);
      cursor += chunkSize;
      if (cursor < file.size) {
        readNextChunk();
      } else {
        resolve(spark.end());
      }
    };

    fileReader.onerror = () => {
      reject('MD5 calculation failed');
    };

    const readNextChunk = () => {
      const slice = file.slice(cursor, cursor + chunkSize);
      fileReader.readAsArrayBuffer(slice);
    };

    readNextChunk();
  });
};

const uploadChunk = async (file, chunk, fileId) => {
  try {
    const xhr = new XMLHttpRequest();
    
    await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP Error: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network Error'));

      xhr.open('POST', `${config.apiBaseUrl}/upload`);
      xhr.setRequestHeader('X-File-ID', fileId);
      xhr.setRequestHeader('X-Start-Offset', chunk.start_offset);
      xhr.setRequestHeader('Content-Range', `bytes ${chunk.start_offset}-${chunk.end_offset}/${file.size}`);

      xhr.send(file.slice(chunk.start_offset, chunk.end_offset + 1));
    });

    return true;
  } catch (error) {
    console.error('Chunk upload failed:', error);
    return false;
  }
};

const pathMap = new Map();

const initPathMap = async () => {
  const paths = [
    { path: await audioDir(), baseDir: BaseDirectory.Audio },
    { path: await appDataDir(), baseDir: BaseDirectory.AppData },
    { path: await documentDir(), baseDir: BaseDirectory.Document },
    { path: await downloadDir(), baseDir: BaseDirectory.Download },
    { path: await pictureDir(), baseDir: BaseDirectory.Picture },
    { path: await videoDir(), baseDir: BaseDirectory.Video },
  ];
  
  paths.forEach(({ path, baseDir }) => {
    pathMap.set(path, baseDir);
  });
};

const handleFileUpload = async (filePath) => {
  try {
    updateUploadProgress(filePath, 0, 'uploading');
    if (pathMap.size === 0) {
      await initPathMap();
    }

    let targetPath = '';
    let targetBaseDir = null;

    // 查找匹配的前缀路径
    for (const [path, baseDir] of pathMap.entries()) {
      if (filePath.startsWith(path)) {
        targetPath = filePath.substring(path.length + 1); // +1 是为了去掉路径分隔符
        targetBaseDir = baseDir;
        break;
      }
    }

    if (!targetBaseDir) {
      throw new Error('无法找到匹配的目录');
    }

    // 读取文件内容
    const fileContent = await readFile(targetPath, { baseDir: targetBaseDir });
    if (fileContent.length === 0) {
      console.log("fileContent is empty,skip");
      return;
    }
    const file = new Blob([fileContent]);
    
    const md5Hash = await calculateMD5(file);
    console.log("md5Hash=", md5Hash);

    const metaData = await apiFetch('/submit_metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: targetPath.split(sep()).pop(),
        total_size: file.size,
        description: '',
        checksum: md5Hash,
      }),
    });

    const { chunks  } = metaData;
    let completedChunks = 0;
    const totalChunks = chunks.length;

    const uploadChunks = async (chunksToUpload) => {
      const chunkPromises = chunksToUpload.map(chunk => 
        uploadChunk(file, chunk, metaData.id).then(success => {
          if (success) {
            completedChunks++;
            const progress = Math.round((completedChunks / totalChunks) * 100);
            updateUploadProgress(filePath, progress);
          }
          return success;
        })
      );

      return Promise.all(chunkPromises);
    };

    for (let i = 0; i < chunks.length; i += config.maxConcurrentUploads) {
      const chunksGroup = chunks.slice(i, i + config.maxConcurrentUploads);
      const results = await uploadChunks(chunksGroup);
      
      if (results.includes(false)) {
        throw new Error('部分分片上传失败');
      }
    }

    console.log('文件上传成功');
    updateUploadProgress(filePath, 100, 'success');
  } catch (error) {
    console.error('Upload failed:', error);
    updateUploadProgress(filePath, 0, 'error');
  }
};

const updateWatchDirs = async () => {
  try {
    const sysConfContent = await readTextFile(sysConfName, { baseDir: BaseDirectory.AppConfig });
    const sysConfJson = JSON.parse(sysConfContent);
    const { watchDir, interval } = sysConfJson;

    const newWatchDirs = new Set(watchDir);

    // Add new directories to watch
    newWatchDirs.forEach(async (dir) => {
      if (!currentWatchDirs.has(dir) && dir) {
        currentWatchDirs.add(dir);
        console.log("add watch dir =", dir);
        await watch(
          dir,
          async (event) => {
            console.log('change detected:', event);
            if (event.type.create !== undefined) {
              console.log('New file detected:', event.paths);
              for (const path of event.paths) {
                  await handleFileUpload(path);
              }
            }
          },
          {
            baseDir: BaseDirectory.App,
            delayMs: interval * 1000,
            recursive: true,
          }
        );
      }
    });

    // Remove directories that are no longer in sys.conf
    currentWatchDirs.forEach((dir) => {
      if (!newWatchDirs.has(dir)) {
        currentWatchDirs.delete(dir);
        // Logic to stop watching the directory if needed
        console.log(`Stopped watching directory: ${dir}`);
      }
    });
  } catch (error) {
    console.error('Failed to update watch directories:', error);
  }
};

export const startWatching = async () => {
  if (isWatching) return; // 如果已经在监听，则直接返回
  isWatching = true; // 设置标志为true，表示已经开始监听
  console.log('startWatching...');

  await updateWatchDirs();

  // Watch sys.conf for changes
  await watch(
    sysConfName,
    async () => {
      console.log('sys.conf changed, updating watch directories...');
      await updateWatchDirs();
    },
    {
      baseDir: BaseDirectory.AppConfig,
      delayMs: 10 * 1000,
    }
  );
}; 