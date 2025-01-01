import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      welcome: 'Welcome to NASCraft Management System',
      uploadFile: 'Upload File',
      logout: 'Logout',
      systemInit: 'System Initialization',
      // Add more translations as needed
    },
  },
  zh: {
    translation: {
      welcome: '欢迎使用 NASCraft 管理系统',
      uploadFile: '上传文件',
      logout: '退出登录',
      systemInit: '系统初始化',
      // Add more translations as needed
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: navigator.language.split(/[-_]/)[0], // 获取浏览器语言
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n; 