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
    
    if (!response.ok) {
      message.error({
        content: data.message || `请求失败: ${response.status}`,
        ...defaultMessageConfig,
      });
      return { error: true, data };
    }
    
    // 处理业务逻辑错误
    if (data.status !== 1 || data.code !== "0") {
      return { error: true, data };
    }
    
    return { error: false, data };
  } catch (error) {
    // 统一错误处理
    message.error({
      content: error.message || '请求失败',
      ...defaultMessageConfig,
    });
    console.error('API request failed:', error);
    return { error: true, data: { message: error.message } };
  }
};

// 导出配置对象，供其他组件使用
export const config = {
  apiBaseUrl: API_BASE_URL,
  maxConcurrentUploads: 3,
}; 