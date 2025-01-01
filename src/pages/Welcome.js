import React, { useState } from 'react';
import { Button, Typography, Space } from 'antd';
import { useHistory } from 'react-router-dom';

const { Title } = Typography;

function Welcome() {
  const history = useHistory();
  const [language, setLanguage] = useState(navigator.language.split(/[-_]/)[0]); // 获取浏览器语言

  const translations = {
    en: {
      welcome: 'Welcome to NASCraft Management System',
      uploadFile: 'Upload File',
      logout: 'Logout',
      systemInit: 'System Initialization',
      switchLanguage: 'Switch to Chinese',
    },
    zh: {
      welcome: '欢迎使用 NASCraft 管理系统',
      uploadFile: '上传文件',
      logout: '退出登录',
      systemInit: '系统初始化',
      switchLanguage: '切换到英文',
    },
  };

  const t = translations[language] || translations.en;

  const toggleLanguage = () => {
    setLanguage((prevLang) => (prevLang === 'zh' ? 'en' : 'zh'));
  };

  return (
    <div className="container">
      <div className="welcome-content">
        <Title level={1}>{t.welcome}</Title>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Button 
            type="primary" 
            size="large"
            onClick={() => history.push('/upload')}
          >
            {t.uploadFile}
          </Button>
          <Button 
            size="large"
            onClick={() => history.push('/login')}
          >
            {t.logout}
          </Button>
          <Button 
            size="large"
            onClick={() => history.push('/system-init')}
            style={{ width: '100%' }}
          >
            {t.systemInit}
          </Button>
        </Space>
      </div>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <Button onClick={toggleLanguage}>
          {t.switchLanguage}
        </Button>
      </div>
    </div>
  );
}

export default Welcome; 