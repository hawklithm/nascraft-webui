import React from 'react';
import { Button, Typography, Space, Link } from 'antd';
import { useHistory } from 'react-router-dom';

const { Title } = Typography;

function Welcome() {
  const history = useHistory();

  return (
    <div className="container">
      <div className="welcome-content">
        <Title level={1}>欢迎使用</Title>
        <Title level={3} type="secondary">NASCraft 管理系统</Title>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Button 
            type="primary" 
            size="large"
            onClick={() => history.push('/upload')}
          >
            上传文件
          </Button>
          <Button 
            size="large"
            onClick={() => history.push('/login')}
          >
            退出登录
          </Button>
          <Button 
            size="large"
            onClick={() => history.push('/system-init')}
            style={{ width: '100%' }}
          >
            系统初始化
          </Button>
        </Space>
      </div>
    </div>
  );
}

export default Welcome; 