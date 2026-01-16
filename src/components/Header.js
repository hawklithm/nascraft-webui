import React, { useMemo, useState } from 'react';
import { Layout, Typography, Button, Drawer, Grid, Space } from 'antd';
import { EllipsisOutlined, CloudUploadOutlined, FileTextOutlined } from '@ant-design/icons';
import { useHistory, useLocation } from 'react-router-dom';

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header = () => {
  const history = useHistory();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = useMemo(() => !screens.md, [screens.md]);

  const onOpenUploadProgress = () => {
    window.dispatchEvent(new Event('nascraft:openUploadProgress'));
    setOpen(false);
  };

  const onOpenLogs = () => {
    history.push('/logs', { from: location.pathname });
    setOpen(false);
  };

  return (
    <>
      <AntHeader style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0, lineHeight: '64px' }}>
          Nascraft 管理系统
        </Title>

        <Button
          type="text"
          icon={<EllipsisOutlined />}
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        />
      </AntHeader>

      <Drawer
        title="Menu"
        placement="right"
        open={open}
        onClose={() => setOpen(false)}
        width={isMobile ? '100%' : 360}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button icon={<CloudUploadOutlined />} block onClick={onOpenUploadProgress}>
            Upload Progress
          </Button>
          <Button icon={<FileTextOutlined />} block onClick={onOpenLogs}>
            View Logs
          </Button>
        </Space>
      </Drawer>
    </>
  );
};

export default Header; 