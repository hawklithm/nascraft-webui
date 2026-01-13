import React, { useMemo, useState } from 'react';
import { Grid, Layout, Menu } from 'antd';
import { useHistory, useLocation } from 'react-router-dom';
import { 
  UploadOutlined, 
  FileOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const Navigation = () => {
  const history = useHistory();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = useMemo(() => !screens.md, [screens.md]);

  const menuItems = [
    {
      key: '/welcome',
      icon: <HomeOutlined />,
      label: '首页',
    },
    {
      key: '/upload',
      icon: <UploadOutlined />,
      label: '上传文件',
    },
    {
      key: '/uploaded-files',
      icon: <FileOutlined />,
      label: '已上传文件',
    },
    {
      key: '/videos',
      icon: <PlayCircleOutlined />,
      label: '视频列表',
    },
  ];

  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <Menu
          className="mobile-bottom-nav"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => history.push(key)}
          style={{
            display: 'flex',
            borderBottom: 0,
          }}
        />
      </div>
    );
  }

  return (
    <Sider 
      width={200} 
      collapsible 
      collapsed={collapsed}
      onCollapse={(value) => setCollapsed(value)}
      style={{ 
        background: '#fff',
      }}
      trigger={
        <div style={{ 
          backgroundColor: '#f0f5ff',
          height: '48px',
          lineHeight: '48px',
          textAlign: 'center',
          cursor: 'pointer',
          color: '#597ef7',
          transition: 'all 0.3s',
          borderTop: '1px solid #f0f0f0',
        }}>
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      }
      collapsedWidth={80}
      breakpoint="lg"
    >
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ 
          height: '100%', 
          borderRight: 0,
        }}
        items={menuItems}
        onClick={({ key }) => history.push(key)}
      />
    </Sider>
  );
};

export default Navigation; 