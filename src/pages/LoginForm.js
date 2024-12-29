import React from 'react';
import { Form, Input, Button, Card, Typography } from 'antd';
import { useHistory } from 'react-router-dom';

const { Title } = Typography;

function LoginForm() {
  const history = useHistory();

  const onFinish = (values) => {
    console.log('Success:', values);
    history.push('/welcome');
  };

  const onFinishFailed = (errorInfo) => {
    console.log('Failed:', errorInfo);
  };

  return (
    <div className="container">
      <Card className="login-card">
        <Title level={2} className="text-center">
          登录系统
        </Title>
        <Form
          name="basic"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          initialValues={{ remember: true }}
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>

          <Form.Item wrapperCol={{ span: 24 }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default LoginForm; 