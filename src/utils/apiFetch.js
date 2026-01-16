import { message } from 'antd';

const API_BASE_PATH = '/api';
const SYS_CONF_NAME = 'sys.conf';
const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedApiBaseUrl = API_BASE_PATH;
let lastLoadedAt = 0;
let isWatching = false;
let cachedIsTauri = null;

const normalizeHost = (host) => {
  if (!host || typeof host !== 'string') return null;
  let h = host.trim();
  if (!h) return null;
  if (!/^https?:\/\//i.test(h)) {
    h = `http://${h}`;
  }
  h = h.replace(/\/+$/, '');
  return h;
};

export const isTauriRuntime = async () => {
  if (cachedIsTauri !== null) return cachedIsTauri;
  try {
    const { platform } = await import('@tauri-apps/plugin-os');
    const p = await platform();
    cachedIsTauri = p !== 'unknown';
    return cachedIsTauri;
  } catch (e) {
    cachedIsTauri = false;
    return cachedIsTauri;
  }
};

export const tauriHttpFetch = async (url, options) => {
  const { invoke } = await import('@tauri-apps/api/core');
  const method = (options && options.method) ? options.method : 'GET';
  const headers = (options && options.headers) ? options.headers : {};

  let bodyBytes = null;
  if (options && options.body !== undefined && options.body !== null) {
    if (options.body instanceof Uint8Array) {
      bodyBytes = Array.from(options.body);
    } else if (typeof options.body === 'string') {
      bodyBytes = Array.from(new TextEncoder().encode(options.body));
    } else {
      bodyBytes = Array.from(new TextEncoder().encode(String(options.body)));
    }
  }

  const resp = await invoke('http_proxy_fetch', {
    req: {
      url,
      method,
      headers,
      body: bodyBytes,
    }
  });

  const bytes = new Uint8Array(resp.body || []);
  const ok = resp.status >= 200 && resp.status < 300;

  return {
    ok,
    status: resp.status,
    statusText: resp.status_text || '',
    headers: {
      get: (key) => {
        const k = String(key || '').toLowerCase();
        const entries = resp.headers ? Object.entries(resp.headers) : [];
        for (const [hk, hv] of entries) {
          if (String(hk).toLowerCase() === k) return hv;
        }
        return null;
      }
    },
    arrayBuffer: async () => bytes.buffer,
    text: async () => new TextDecoder().decode(bytes),
    json: async () => JSON.parse(new TextDecoder().decode(bytes)),
  };
};

const probeHello = async (host) => {
  const h = normalizeHost(host);
  if (!h) return false;
  const url = `${h}${API_BASE_PATH}/hello`;
  const timeoutMs = 2000;

  console.log('[nascraft] probeHello start:', url);

  const withTimeout = async (p) => {
    let t;
    try {
      return await Promise.race([
        p,
        new Promise((_, reject) => {
          t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
        }),
      ]);
    } finally {
      if (t) clearTimeout(t);
    }
  };
  try {
    const tauri = await isTauriRuntime();
    if (tauri) {
      const resp = await withTimeout(tauriHttpFetch(url, { method: 'GET' }));
      console.log('[nascraft] probeHello tauri response:', { url, status: resp && resp.status });
      return resp && resp.status === 200;
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { method: 'GET', signal: controller.signal });
      console.log('[nascraft] probeHello fetch response:', { url, status: resp && resp.status });
      return resp && resp.status === 200;
    } finally {
      clearTimeout(id);
    }
  } catch (e) {
    console.log('[nascraft] probeHello failed:', { url, error: String(e) });
    return false;
  }
};

const loadApiBaseUrlFromSysConf = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastLoadedAt < CACHE_TTL_MS) {
    return cachedApiBaseUrl;
  }

  lastLoadedAt = now;

  const tauri = await isTauriRuntime();
  if (!tauri) {
    cachedApiBaseUrl = API_BASE_PATH;
    return cachedApiBaseUrl;
  }

  try {
    const { readTextFile, writeTextFile, watch, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    if (!isWatching) {
      isWatching = true;
      try {
        await watch(
          SYS_CONF_NAME,
          async () => {
            lastLoadedAt = 0;
            await loadApiBaseUrlFromSysConf(true);
          },
          {
            baseDir: BaseDirectory.AppConfig,
            delayMs: 2 * 1000,
          }
        );
      } catch (e) {
        isWatching = false;
      }
    }

    const sysConfContent = await readTextFile(SYS_CONF_NAME, { baseDir: BaseDirectory.AppConfig });
    const sysConfJson = JSON.parse(sysConfContent);
    const host = normalizeHost(sysConfJson.host);
    console.log('[nascraft] sys.conf loaded:', { host: host || null });
    if (host) {
      console.log('[nascraft] probing configured host:', host);
      const ok = await probeHello(host);
      if (ok) {
        console.log('[nascraft] configured host is reachable:', host);
        cachedApiBaseUrl = `${host}${API_BASE_PATH}`;
        return cachedApiBaseUrl;
      }
      console.log('[nascraft] configured host is NOT reachable, will try discovery:', host);
    }

    // If host is not configured or not reachable, try to discover a nascraft server via mDNS.
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const list = await invoke('discover_nascraft_services', { timeout_ms: 1500 });
      console.log('[nascraft] discovery result:', { count: Array.isArray(list) ? list.length : null, list });
      if (Array.isArray(list) && list.length > 0) {
        const candidates = [];
        for (const svc of list) {
          const port = (svc && svc.port) ? svc.port : 8080;
          const ips = (svc && Array.isArray(svc.ip_v4)) ? svc.ip_v4 : [];
          for (const ip of ips) {
            if (ip) candidates.push(`http://${ip}:${port}`);
          }

          // Defensive fallback: if Rust side didn't include any IPs, try hostname.
          if ((!ips || ips.length === 0) && svc && svc.hostname) {
            candidates.push(`http://${svc.hostname}:${port}`);
          }
        }

        console.log('[nascraft] discovery candidates:', candidates);

        for (const candidateHost of candidates) {
          console.log('[nascraft] probing discovered candidate:', candidateHost);
          const ok = await probeHello(candidateHost);
          if (ok) {
            console.log('[nascraft] discovered candidate selected:', candidateHost);
            sysConfJson.host = candidateHost;
            try {
              await writeTextFile(SYS_CONF_NAME, JSON.stringify(sysConfJson, null, 2), { baseDir: BaseDirectory.AppConfig });
              console.log('[nascraft] sys.conf updated with host:', candidateHost);
            } catch (e) {
              console.log('write sys.conf host failed:', e);
            }
            cachedApiBaseUrl = `${candidateHost}${API_BASE_PATH}`;
            return cachedApiBaseUrl;
          }
        }
      }
    } catch (e) {
      // Ignore discovery errors and fall back to default.
      console.log('mDNS discovery failed:', e);
    }

    throw new Error('网络异常，服务端不在线');
  } catch (e) {
    cachedApiBaseUrl = API_BASE_PATH;
    throw e;
  }
};

export const getApiBaseUrl = async () => loadApiBaseUrlFromSysConf(false);

const defaultMessageConfig = {
  duration: 3,
  style: {
    marginTop: '20vh',
  },
};

export const apiFetch = async (endpoint, options = {},showError = true) => {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
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
    const tauri = await isTauriRuntime();
    const response = tauri ? await tauriHttpFetch(url, config) : await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok || data.status !== 1 || data.code !== "0") {
      const errorMessage = data.message || `请求失败: ${response.status}`;
      if (showError) {
        message.error({
          content: errorMessage,
          ...defaultMessageConfig,
        });
      }
      throw new Error(errorMessage);
    }
    
    return data.data; // 返回内部的 data 对象
  } catch (error) {
    if (showError) {
      message.error({
        content: error.message || '请求失败',
        ...defaultMessageConfig,
      });
    }
    console.error('API request failed:', error);
    throw error; // 继续抛出错误以便调用者处理
  }
};

// 导出配置对象，供其他组件使用
export const config = {
  apiBaseUrl: API_BASE_PATH,
  maxConcurrentUploads: 3,
};