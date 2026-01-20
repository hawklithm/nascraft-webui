import React, { useMemo, useState, useCallback } from 'react';
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

  // 使用useMemo缓存menuItems，避免不必要的重新渲染
  const menuItems = useMemo(() => [
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
  ], []);

  // 使用useCallback缓存点击处理函数
  const handleMenuClick = useCallback(({ key }) => {
    history.push(key);
  }, [history]);

  if (isMobile) {
    return (
      <div className="mobile-bottom-nav-container">
        <Menu
          className="mobile-bottom-nav"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
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
        onClick={handleMenuClick}
      />
    </Sider>
  );
};

export default Navigation; 