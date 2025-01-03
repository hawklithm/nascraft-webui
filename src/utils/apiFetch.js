import { message } from 'antd';

const API_BASE_URL = '/api';

const defaultMessageConfig = {
  duration: 3,
  style: {
    marginTop: '20vh',
  },
};

export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok || data.status !== 1 || data.code !== "0") {
      const errorMessage = data.message || `请求失败: ${response.status}`;
      message.error({
        content: errorMessage,
        ...defaultMessageConfig,
      });
      throw new Error(errorMessage);
    }
    
    return data.data; // 返回内部的 data 对象
  } catch (error) {
    message.error({
      content: error.message || '请求失败',
      ...defaultMessageConfig,
    });
    console.error('API request failed:', error);
    throw error; // 继续抛出错误以便调用者处理
  }
};

// 导出配置对象，供其他组件使用
export const config = {
  apiBaseUrl: API_BASE_URL,
  maxConcurrentUploads: 3,
}; 