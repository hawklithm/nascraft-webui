import React, { useState } from 'react';
import { Form, Upload, Button, Card, Typography, Input, message, Progress, Collapse, Tag } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useHistory } from 'react-router-dom';
import SparkMD5 from 'spark-md5';
import { apiFetch, config } from '../utils/apiFetch';
import withSystemCheck from '../components/withSystemCheck';

const { Title } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

function UploadForm() {
  const history = useHistory();
  const [form] = Form.useForm();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [chunkProgress, setChunkProgress] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);

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
      setChunkProgress(prev => ({
        ...prev,
        [chunk.start_offset]: 0
      }));

      const xhr = new XMLHttpRequest();
      
      await new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setChunkProgress(prev => ({
              ...prev,
              [chunk.start_offset]: percentComplete
            }));
          }
        };

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

  const handleBeforeUpload = (file) => {
    setSelectedFile(file);
    form.setFieldsValue({ filename: file.name });
    return false; // 阻止自动上传
  };

  const startUpload = async (file, formValues) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setChunkProgress({});

      const md5Hash = await calculateMD5(file);

      const metaData = await apiFetch('/submit_metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: formValues.filename || file.name,
          total_size: file.size,
          description: formValues.description,
          checksum: md5Hash,
        }),
      });

      const { chunks, total_chunks } = metaData;
      let completedChunks = 0;

      const uploadChunks = async (chunksToUpload) => {
        const chunkPromises = chunksToUpload.map(chunk => 
          uploadChunk(file, chunk, metaData.id)
            .then(success => {
              if (success) {
                completedChunks++;
                const progress = Math.round((completedChunks / total_chunks) * 100);
                setUploadProgress(progress);
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

      message.success({
        content: (
          <span>
            文件上传成功 <Tag color="blue" onClick={() => history.push('/uploaded-files')} style={{ cursor: 'pointer' }}>查看文件</Tag>
          </span>
        ),
        duration: 3,
      });

      setUploadProgress(100);
    } catch (error) {
      console.error('Upload failed:', error);
      message.error(`上传失败：${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const renderChunkProgress = () => {
    return Object.entries(chunkProgress).map(([offset, progress]) => (
      <div key={offset} style={{ marginBottom: 10 }}>
        <span>分片 {parseInt(offset) / 1048576 + 1}:</span>
        <Progress percent={progress} size="small" />
      </div>
    ));
  };

  return (
    <Card>
      <Title level={2}>文件上传</Title>
      <Form form={form} onFinish={(values) => startUpload(selectedFile, values)}>
        <Form.Item name="filename" label="文件名">
          <Input placeholder="请输入文件名" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <TextArea rows={4} placeholder="请输入文件描述" />
        </Form.Item>
        <Form.Item>
          <Upload beforeUpload={handleBeforeUpload} showUploadList={false}>
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
          {selectedFile && (
            <div style={{ marginTop: 10 }}>
              已选文件: {selectedFile.name}
            </div>
          )}
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" disabled={!selectedFile || uploading}>
            {uploading ? '上传中...' : '开始上传'}
          </Button>
        </Form.Item>
      </Form>
      {uploading && (
        <div>
          <Progress percent={uploadProgress} />
          <Collapse style={{ marginTop: 20 }}>
            <Panel header="查看分片上传进度" key="1">
              {renderChunkProgress()}
            </Panel>
          </Collapse>
        </div>
      )}
    </Card>
  );
}

export default withSystemCheck(UploadForm); 