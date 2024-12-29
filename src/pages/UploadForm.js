import React, { useState } from 'react';
import { Form, Upload, Button, Card, Typography, Input, message, Progress, Space, Row, Col } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useHistory } from 'react-router-dom';

const { Title } = Typography;
const { TextArea } = Input;

// 配置对象
const config = {
  apiBaseUrl: '/api', // 添加 /api 前缀
  maxConcurrentUploads: 3,
};

function UploadForm() {
  const history = useHistory();
  const [fileId, setFileId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [chunkProgress, setChunkProgress] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);

  const apiFetch = async (endpoint, options) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}${endpoint}`, options);
      const data = await response.json();
      
      if (!response.ok) {
        message.error({
          content: data.message || `请求失败: ${response.status}`,
          duration: 3,
          style: {
            marginTop: '20vh',
          },
        });
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      if (data.status !== 1 || data.code !== "0") {
        message.error({
          content: data.message || '操作失败',
          duration: 3,
          style: {
            marginTop: '20vh',
          },
        });
        throw new Error(data.message || '操作失败');
      }
      
      return data;
    } catch (error) {
      if (!error.message.includes('HTTP error') && !error.message.includes('操作失败')) {
        message.error({
          content: error.message || '请求失败',
          duration: 3,
          style: {
            marginTop: '20vh',
          },
        });
      }
      throw error;
    }
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
    return false; // 阻止自动上传
  };

  const startUpload = async (file, formValues) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setChunkProgress({});

      const response = await apiFetch('/submit_metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: formValues.filename || file.name,
          total_size: file.size,
          description: formValues.description
        }),
      });

      const metaData = response.data;
      setFileId(metaData.id);
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

      message.success('文件上传成功');
      setUploadProgress(100);
      history.push('/welcome');
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const onFinish = async (values) => {
    if (!selectedFile) {
      message.error({
        content: '请先选择要上传的文件',
        duration: 3,
        style: {
          marginTop: '20vh',
        },
      });
      return;
    }
    await startUpload(selectedFile, values);
  };

  const renderChunkProgress = () => {
    return Object.entries(chunkProgress).map(([offset, progress]) => (
      <Form.Item 
        key={offset} 
        label={`分片 ${parseInt(offset) / 1048576 + 1}`} 
        wrapperCol={{ span: 24 }}
      >
        <Progress percent={progress} size="small" />
      </Form.Item>
    ));
  };

  return (
    <Row justify="center" align="middle" style={{ minHeight: '100vh', background: '#f0f2f5', padding: 24 }}>
      <Col xs={24} sm={24} md={20} lg={16} xl={12}>
        <Card bordered={false}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2} style={{ textAlign: 'center', margin: 0 }}>
              文件上传
            </Title>
            
            <Form
              name="upload"
              labelCol={{ span: 6 }}
              wrapperCol={{ span: 18 }}
              onFinish={onFinish}
              autoComplete="off"
              size="large"
            >
              <Form.Item
                label="文件名称"
                name="filename"
                rules={[{ required: true, message: '请输入文件名称!' }]}
              >
                <Input placeholder="请输入文件名称" />
              </Form.Item>

              <Form.Item
                label="文件描述"
                name="description"
              >
                <TextArea rows={4} placeholder="请输入文件描述" />
              </Form.Item>

              <Form.Item
                label="选择文件"
                name="file"
                rules={[{ required: true, message: '请选择要上传的文件!' }]}
              >
                <Upload
                  beforeUpload={handleBeforeUpload}
                  maxCount={1}
                  disabled={uploading}
                >
                  <Button icon={<UploadOutlined />} disabled={uploading} block>
                    选择文件
                  </Button>
                </Upload>
              </Form.Item>

              {uploadProgress > 0 && (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Form.Item 
                    label="总体进度" 
                    style={{ marginBottom: 0 }}
                  >
                    <Progress percent={uploadProgress} />
                  </Form.Item>
                  <Card
                    size="small"
                    title="分片上传进度"
                    style={{ background: '#fafafa' }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {renderChunkProgress()}
                    </Space>
                  </Card>
                </Space>
              )}

              <Form.Item wrapperCol={{ span: 24 }} style={{ marginTop: 24 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    block
                    disabled={uploading}
                    size="large"
                  >
                    提交
                  </Button>
                  <Button 
                    block 
                    onClick={() => history.push('/welcome')}
                    disabled={uploading}
                    size="large"
                  >
                    返回
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Space>
        </Card>
      </Col>
    </Row>
  );
}

export default UploadForm; 