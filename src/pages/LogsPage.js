import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Button, Grid, Layout, Typography, Spin } from 'antd';
import { useHistory, useLocation } from 'react-router-dom';

const { Content } = Layout;
const { Title } = Typography;

const LogsPage = () => {
  const history = useHistory();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [logText, setLogText] = useState('');
  const [err, setErr] = useState(null);
  const [logFile, setLogFile] = useState('');
  const logContainerRef = useRef(null);

  const screens = Grid.useBreakpoint();
  const isMobile = useMemo(() => !screens.md, [screens.md]);

  const goBack = () => {
    const from = location && location.state && location.state.from;
    if (from) {
      history.push(from);
      return;
    }
    history.goBack();
  };

  // 滚动到日志底部
  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  // 自动滚动到底部
  useEffect(() => {
    if (logText && !loading) {
      scrollToBottom();
    }
  }, [logText, loading]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { isTauriRuntime } = await import('../utils/apiFetch');
        const tauri = await isTauriRuntime();
        if (!tauri) {
          throw new Error('Log viewer is only available in the Tauri app');
        }

        const { invoke } = await import('@tauri-apps/api/core');
        try {
          const info = await invoke('get_app_log_info');
          if (mounted && info && info.log_file) setLogFile(String(info.log_file));
        } catch (e) {
          // ignore
        }
        const text = await invoke('read_app_log', { max_bytes: 512 * 1024 });
        if (mounted) {
          setLogText(String(text || ''));
        }
      } catch (e) {
        if (mounted) {
          setErr(e);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Layout style={{ background: 'transparent' }}>
      <Content style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            Logs
          </Title>
        </div>

        {logFile ? (
          <div style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>
            {logFile}
          </div>
        ) : null}

        <div
          ref={logContainerRef}
          style={{
            marginTop: 12,
            background: '#111827',
            color: '#e5e7eb',
            borderRadius: 8,
            padding: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            minHeight: 260,
            maxHeight: isMobile ? 'calc(100vh - 64px - 46px - 24px - 80px)' : '60vh',
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
          }}
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Spin />
            </div>
          ) : err ? (
            <div style={{ color: '#fca5a5' }}>{String(err && err.message ? err.message : err)}</div>
          ) : (
            logText || '(empty)'
          )}
        </div>

        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '12px 24px',
            background: '#fff',
            borderTop: '1px solid #f0f0f0',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
            zIndex: 1100,
            display: 'flex',
            gap: '12px',
          }}
        >
          <Button 
            type="default" 
            onClick={scrollToBottom}
            style={{ flex: 1 }}
          >
            滚动到底部
          </Button>
          <Button type="primary" block onClick={goBack} style={{ flex: 1 }}>
            Back
          </Button>
        </div>
      </Content>
    </Layout>
  );
};

export default LogsPage;
