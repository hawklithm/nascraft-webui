import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { BrowserRouter, Route, Switch, Redirect, Link, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  UploadOutlined,
  HomeOutlined,
  SettingOutlined,
  FileOutlined,
} from '@ant-design/icons';
import { geekblue } from '@ant-design/colors';
import Welcome from './pages/Welcome';
import LoginForm from './pages/LoginForm';
import UploadForm from './pages/UploadForm';
import SystemInit from './pages/SystemInit';
import UploadedFiles from './pages/UploadedFiles';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const location = useLocation();
  const selectedKey = location.pathname;

  useEffect(() => {
    const unlisten = listen('file-changed', (event) => {
      console.log('File changed:', event.payload);
      // Handle the file change event
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: geekblue[6], color: '#fff', padding: '0 16px' }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
          NASCraft 管理系统
        </div>
      </Header>
      <Layout>
        <Sider collapsible style={{ background: geekblue[6] }}>
          <div className="logo" />
          <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} style={{ background: geekblue[6] }}>
            <Menu.Item key="/welcome" icon={<HomeOutlined />}>
              <Link to="/welcome">Home</Link>
            </Menu.Item>
            <Menu.Item key="/upload" icon={<UploadOutlined />}>
              <Link to="/upload">Upload File</Link>
            </Menu.Item>
            <Menu.Item key="/uploaded-files" icon={<FileOutlined />}>
              <Link to="/uploaded-files">Uploaded Files</Link>
            </Menu.Item>
            <Menu.Item key="/system-init" icon={<SettingOutlined />}>
              <Link to="/system-init">System Initialization</Link>
            </Menu.Item>
          </Menu>
        </Sider>
        <Content style={{ margin: '16px', background: geekblue[2] }}>
          <Switch>
            <Route exact path="/" render={() => <Redirect to="/login" />} />
            <Route path="/login" component={LoginForm} />
            <Route path="/welcome" component={Welcome} />
            <Route path="/upload" component={UploadForm} />
            <Route path="/system-init" component={SystemInit} />
            <Route path="/uploaded-files" component={UploadedFiles} />
          </Switch>
        </Content>
      </Layout>
    </Layout>
  );
}

function AppWrapper() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

export default AppWrapper;
