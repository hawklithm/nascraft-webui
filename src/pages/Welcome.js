import React, { useState } from 'react';
import { Typography, Space, Tag } from 'antd';
import { useHistory } from 'react-router-dom';

const { Title } = Typography;

function Welcome() {
  const history = useHistory();
  const [language, setLanguage] = useState(navigator.language.split(/[-_]/)[0]);

  const translations = {
    en: {
      welcome: 'Welcome to NASCraft Management System',
      uploadFile: 'Upload File',
      logout: 'Logout',
      systemInit: 'System Initialization',
      switchLanguage: 'Switch to Chinese',
      viewUploadedFiles: 'View Uploaded Files',
    },
    zh: {
      welcome: '欢迎使用 NASCraft 管理系统',
      uploadFile: '上传文件',
      logout: '退出登录',
      systemInit: '系统初始化',
      switchLanguage: '切换到英文',
      viewUploadedFiles: '查看已上传文件',
    },
  };

  const t = translations[language] || translations.en;

  const toggleLanguage = () => {
    setLanguage((prevLang) => (prevLang === 'zh' ? 'en' : 'zh'));
  };

  return (
    <div className="container" style={{ textAlign: 'center', paddingTop: '50px' }}>
      <div className="welcome-content">
        <Title level={1}>{t.welcome}</Title>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Tag color="blue" onClick={() => history.push('/upload')} style={{ cursor: 'pointer' }}>
            {t.uploadFile}
          </Tag>
          <Tag color="blue" onClick={() => history.push('/login')} style={{ cursor: 'pointer' }}>
            {t.logout}
          </Tag>
          <Tag color="blue" onClick={() => history.push('/system-init')} style={{ cursor: 'pointer' }}>
            {t.systemInit}
          </Tag>
          <Tag color="blue" onClick={() => history.push('/uploaded-files')} style={{ cursor: 'pointer' }}>
            {t.viewUploadedFiles}
          </Tag>
        </Space>
      </div>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <Tag color="geekblue" onClick={toggleLanguage} style={{ cursor: 'pointer' }}>
          {t.switchLanguage}
        </Tag>
      </div>
    </div>
  );
}

export default Welcome; 