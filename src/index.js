import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';
import enUS from 'antd/lib/locale/en_US';
import './index.css';
import './App.css';

// 检查相册权限
const checkPhotoPermissions = async () => {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    
    return await invoke('plugin:photo|checkAndRequestPermissions');
  } catch (error) {
    console.error('检查权限时出错:', error);
    return { granted: false, message: '检查权限时出错' };
  }
};

// 打开应用设置页面
const openAppSettings = async () => {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    
    // 使用Tauri的插件机制打开应用设置页面
    // 这里我们需要检查是否在Tauri环境中运行
    const { isTauriRuntime } = await import('./utils/apiFetch');
    const tauri = await isTauriRuntime();
    
    if (tauri) {
      // 在Tauri环境中，通过插件调用Android原生代码打开设置
      try {
        await invoke('plugin:photo|openAppSettings');
        return true;
      } catch (error) {
        console.warn('通过插件打开设置失败:', error);
        // 如果插件调用失败，尝试使用备用方案
        try {
          // 在Tauri环境中，我们无法使用Web Intent，直接提示用户手动设置
          console.log('无法自动打开设置页面，请用户手动前往系统设置');
          
          // 显示详细的操作指南
          const manualInstructions = `无法自动打开设置页面，请手动设置：
1. 退出当前应用
2. 进入手机"设置"应用
3. 找到并点击"应用管理"或"应用权限"
4. 找到"${document.title || '当前应用'}"
5. 点击进入应用详情
6. 找到并点击"权限管理"
7. 授予"存储"或"相册"相关权限`;
          
          alert(manualInstructions);
          return false;
        } catch (e) {
          console.warn('备用方案也失败:', e);
        }
      }
    }
    
    // 如果不在Tauri环境，说明是普通Web环境
    // 显示通用提示
    alert('请在系统设置中为应用授予相册访问权限');
    
    return false;
  } catch (error) {
    console.error('打开应用设置时出错:', error);
    alert('无法打开设置页面，请手动在系统设置中为应用授予相册访问权限');
    return false;
  }
};

// 请求权限
const requestPhotoPermissions = async () => {
  try {
    const result = await checkPhotoPermissions();
    
    if (!result.granted && result.requiredPermissions) {
      // 尝试使用dialog插件显示提示
      try {
        const { ask } = await import('@tauri-apps/plugin-dialog');
        
        const confirmed = await ask(
          '需要相册访问权限',
          '应用需要访问您的相册来显示照片。请在设置中授予权限。',
          { title: '前往设置', type: 'YesNo' }
        );
        
        if (confirmed) {
          // 打开应用设置页面
          console.log('用户确认前往设置页面');
          await openAppSettings();
        }
      } catch (dialogError) {
        // 如果dialog插件不可用，使用window.confirm
        console.warn('Dialog插件不可用，使用window.confirm提示');
        const userConfirmed = window.confirm('需要相册访问权限，请在应用设置中授予权限。是否现在打开设置？');
        if (userConfirmed) {
          await openAppSettings();
        }
      }
    }
    
    return result.granted;
  } catch (error) {
    console.error('请求权限时出错:', error);
    return false;
  }
};

const initTauriWebviewLogging = async () => {
  console.log("Init Tauri webview logging");
  try {
    // if (!window || !window.__TAURI__) return;

    const { invoke } = await import('@tauri-apps/api/core');

    const queue = [];
    let flushTimer = null;

    const flush = async () => {
      flushTimer = null;
      if (!queue.length) return;

      const batch = queue.splice(0, queue.length);
      const msg = batch.join('\n');
      try {
        await invoke('append_web_log', {
          payload: { level: 'log', message: `[webview:batch] ${msg}` },
        });
      } catch (e) {
        // ignore
      }
    };

    const enqueue = (line) => {
      queue.push(line);
      if (!flushTimer) {
        flushTimer = setTimeout(flush, 250);
      }
    };

    const orig = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    const wrap = (fnName) => (...args) => {
      try {
        orig[fnName](...args);
      } catch (e) {
        // ignore
      }

      try {
        const msg = args
          .map((a) => {
            if (typeof a === 'string') return a;
            try {
              return JSON.stringify(a);
            } catch (e) {
              return String(a);
            }
          })
          .join(' ');
        enqueue(`[webview:${fnName}] ${msg}`);
      } catch (e) {
        // ignore
        orig.error(e);
      }
    };

    console.log = wrap('log');
    console.info = wrap('info');
    console.warn = wrap('warn');
    console.error = wrap('error');

    orig.log('[nascraft] Tauri webview logging initialized');
  } catch (e) {
    // ignore
    console.error(e);
  }
};

initTauriWebviewLogging();

// 应用启动时检查相册权限
requestPhotoPermissions().then(granted => {
  if (granted) {
    console.log('相册权限已授予');
  } else {
    console.warn('相册权限未授予，部分功能可能无法使用');
  }
}).catch(error => {
  console.error('权限检查失败:', error);
});

const language = navigator.language.split(/[-_]/)[0]; // 获取浏览器语言
const locale = language === 'zh' ? zhCN : enUS;

ReactDOM.render(
  <ConfigProvider locale={locale}>
    <App />
  </ConfigProvider>,
  document.getElementById('root')
);
