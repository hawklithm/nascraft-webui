import React from 'react';
import { Layout, Typography } from 'antd';

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header = () => {
  return (
    <AntHeader style={{ background: '#fff', padding: '0 24px' }}>
      <Title level={3} style={{ margin: 0, lineHeight: '64px' }}>
        Nascraft 管理系统
      </Title>
    </AntHeader>
  );
};

export default Header; 