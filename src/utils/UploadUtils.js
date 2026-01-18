import SparkMD5 from 'spark-md5';
import { apiFetch, getApiBaseUrl, isTauriRuntime, tauriHttpFetch } from './apiFetch';

/**
 * 计算文件的 MD5 值
 * @param {Blob|File} file - 文件对象
 * @returns {Promise<string>} MD5 哈希值
 */
export const calculateMD5 = (file) => {
  return new Promise((resolve, reject) => {
    const chunkSize = 2097152; // 2MB 分片
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
      reject(new Error('MD5 calculation failed'));
    };

    const readNextChunk = () => {
      const slice = file.slice(cursor, cursor + chunkSize);
      fileReader.readAsArrayBuffer(slice);
    };

    readNextChunk();
  });
};

/**
 * 上传单个分片到服务器
 * @param {Blob} file - 文件 Blob 对象
 * @param {Object} chunk - 分片信息 { start_offset, end_offset, chunk_size }
 * @param {string} fileId - 文件 ID
 * @returns {Promise<boolean>} 上传是否成功
 */
export const uploadChunk = async (file, chunk, fileId) => {
  try {
    const baseUrl = await getApiBaseUrl();
    const isTauri = await isTauriRuntime();
    
    if (isTauri) {
      const bodyBuf = await file.slice(chunk.start_offset, chunk.end_offset + 1).arrayBuffer();
      const response = await tauriHttpFetch(`${baseUrl}/upload`, {
        method: 'POST',
        headers: {
          'X-File-ID': fileId,
          'X-Start-Offset': String(chunk.start_offset),
          'Content-Range': `bytes ${chunk.start_offset}-${chunk.end_offset}/${file.size}`,
        },
        body: new Uint8Array(bodyBuf),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
    } else {
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

        xhr.open('POST', `${baseUrl}/upload`);
        xhr.setRequestHeader('X-File-ID', fileId);
        xhr.setRequestHeader('X-Start-Offset', chunk.start_offset);
        xhr.setRequestHeader('Content-Range', `bytes ${chunk.start_offset}-${chunk.end_offset}/${file.size}`);

        xhr.send(file.slice(chunk.start_offset, chunk.end_offset + 1));
      });
    }

    return true;
  } catch (error) {
    console.error('Chunk upload failed:', error);
    return false;
  }
};

/**
 * 提交文件元数据到服务器
 * @param {Blob} file - 文件 Blob 对象
 * @param {string} md5Hash - 文件的 MD5 哈希值
 * @param {string} description - 文件描述
 * @returns {Promise<Object>} 服务器返回的元数据 { id, chunks, total_chunks }
 */
export const submitMetadata = async (file, md5Hash, description = '') => {
  const metaData = await apiFetch('/submit_metadata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: file.name || 'unknown',
      total_size: file.size,
      description,
      checksum: md5Hash,
    }),
  });

  return metaData;
};
