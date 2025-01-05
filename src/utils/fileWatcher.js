import { watch, BaseDirectory } from '@tauri-apps/plugin-fs';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { apiFetch, config } from './apiFetch';
import SparkMD5 from 'spark-md5';

const sysConfName = 'sys.conf';

let currentWatchDirs = new Set();
let isWatching = false;

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
      xhr.setRequestHeader('Content-Length', chunk.chunk_size);
      xhr.setRequestHeader('Content-Range', `bytes ${chunk.start_offset}-${chunk.end_offset}/${file.size}`);

      xhr.send(file.slice(chunk.start_offset, chunk.end_offset + 1));
    });

    return true;
  } catch (error) {
    console.error('Chunk upload failed:', error);
    return false;
  }
};

const handleFileUpload = async (filePath) => {
  try {
    const file = await fetch(filePath).then(res => res.blob());
    console.log("file=", file);
    const md5Hash = await calculateMD5(file);
    console.log("md5Hash=", md5Hash);
    const metaData = await apiFetch('/submit_metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        total_size: file.size,
        description: '',
        checksum: md5Hash,
      }),
    });

    const { chunks, total_chunks } = metaData;

    const uploadChunks = async (chunksToUpload) => {
      const chunkPromises = chunksToUpload.map(chunk => 
        uploadChunk(file, chunk, metaData.id)
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
  } catch (error) {
    console.error('Upload failed:', error);
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
        await watch(
          dir,
          async (event) => {
            if (event.kind === 'create') {
              console.log('New file detected:', event.path);
              await handleFileUpload(event.path);
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