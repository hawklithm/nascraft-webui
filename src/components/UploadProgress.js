import React, { useState, useEffect, useMemo } from 'react';
import { FloatButton, Drawer, List, Progress, Badge, Typography, Grid } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import { setUploadProgressCallback } from '../utils/fileWatcher';
import { sep } from '@tauri-apps/api/path';

const UploadProgress = () => {
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [uploadList, setUploadList] = useState([]);
  const screens = Grid.useBreakpoint();
  const isMobile = useMemo(() => !screens.md, [screens.md]);

  useEffect(() => {
    const callback = (progressList) => {
      setUploadList([...progressList]);
    };
    setUploadProgressCallback(callback);
    return () => setUploadProgressCallback(null);
  }, []);

  useEffect(() => {
    const handler = () => setShowUploadProgress(true);
    window.addEventListener('nascraft:openUploadProgress', handler);
    return () => window.removeEventListener('nascraft:openUploadProgress', handler);
  }, []);

  const getFileName = (filePath) => {
    const parts = filePath.split(sep());
    return parts[parts.length - 1];
  };

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
      {!isMobile && (
        <FloatButton
          icon={<CloudUploadOutlined />}
          type="primary"
          style={{ right: 24, bottom: 24 }}
          onClick={() => setShowUploadProgress(true)}
          badge={{ count: uploadList.filter(([_, { status }]) => status === 'uploading').length }}
        />
      )}

      <Drawer
        title="文件上传进度"
        placement="right"
        onClose={() => setShowUploadProgress(false)}
        open={showUploadProgress}
        width={isMobile ? '100%' : 400}
      >
        <List
          dataSource={uploadList}
          renderItem={([filePath, { progress, status }]) => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography.Text ellipsis style={{ maxWidth: '70%' }}>
                    {getFileName(filePath)}
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