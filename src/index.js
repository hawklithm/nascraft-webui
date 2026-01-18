import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';
import enUS from 'antd/lib/locale/en_US';
import './index.css';
import './App.css';

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

const language = navigator.language.split(/[-_]/)[0]; // 获取浏览器语言
const locale = language === 'zh' ? zhCN : enUS;

ReactDOM.render(
  <ConfigProvider locale={locale}>
    <App />
  </ConfigProvider>,
  document.getElementById('root')
);
