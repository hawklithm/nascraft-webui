import React, { useState, useEffect } from 'react';
import { FloatButton, Drawer, List, Progress, Badge, Typography } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import { setUploadProgressCallback } from '../utils/fileWatcher';

const UploadProgress = () => {
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [uploadList, setUploadList] = useState([]);

  useEffect(() => {
    setUploadProgressCallback((progressList) => {
      setUploadList(progressList);
    });
  }, []);

  const renderUploadStatus = (status) => {
    switch (status) {
      case 'uploading':
        return <Badge status="processing" text="上传中" />;
      case 'success':
        return <Badge status="success" text="已完成" />;
      case 'error':
        return <Badge status="error" text="失败" />;
      default:
        return null;
    }
  };

  return (
    <>
      <FloatButton
        icon={<CloudUploadOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24 }}
        onClick={() => setShowUploadProgress(true)}
        badge={{ count: uploadList.filter(([_, { status }]) => status === 'uploading').length }}
      />

      <Drawer
        title="文件上传进度"
        placement="right"
        onClose={() => setShowUploadProgress(false)}
        open={showUploadProgress}
        width={400}
      >
        <List
          dataSource={uploadList}
          renderItem={([filePath, { progress, status }]) => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text ellipsis style={{ maxWidth: '80%' }}>
                    {filePath.split('/').pop()}
                  </Typography.Text>
                  {renderUploadStatus(status)}
                </div>
                <Progress percent={progress} status={status === 'error' ? 'exception' : undefined} />
              </div>
            </List.Item>
          )}
        />
      </Drawer>
    </>
  );
};

export default UploadProgress; 