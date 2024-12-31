import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Card, Button, Steps, Typography, message, Result, Table } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, MinusCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { apiFetch } from '../utils/apiFetch';

const { Title } = Typography;
const { Step } = Steps;

const SystemInit = () => {
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initStatus, setInitStatus] = useState({
    database: false,
    config: false,
    users: false
  });
  const [errorData, setErrorData] = useState([]);

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const { error, data } = await apiFetch('/check_table_structure', {
        method: 'GET'
      });
      
      if (!error && data.status === 1) {
        setIsInitialized(true);
        setInitStatus({
          database: true,
          config: true,
          users: true
        });
      } else if (data.status === 0) {
        setErrorData(data.data || []);
      }
    } catch (error) {
      message.error('检查系统状态失败：' + error.message);
    } finally {
      setChecking(false);
    }
  };

  const handleInitialize = async () => {
    setLoading(true);
    try {
      const { error, data } = await apiFetch('/ensure_table_structure', {
        method: 'POST'
      });

      if (!error && data.status === 1) {
        message.success('系统初始化成功！');
        setIsInitialized(true);
        history.push('/welcome');
      } else {
        message.error(data.message || '初始化失败');
      }
    } catch (error) {
      message.error('初始化过程中出现错误：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeSystem = async () => {
    // TODO: 添加实际的初始化接口调用
    return new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
  };

  const getStepStatus = (key) => {
    if (loading) return 'process';
    return initStatus[key] ? 'finish' : 'wait';
  };

  const getStepIcon = (key) => {
    if (loading) return <LoadingOutlined />;
    return initStatus[key] ? <CheckCircleOutlined /> : <MinusCircleOutlined />;
  };

  const columns = [
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      render: (text) => (
        <span>
          <ExclamationCircleOutlined style={{ color: 'red', marginRight: 8 }} />
          {text}
        </span>
      ),
    },
  ];

  if (checking) {
    return (
      <div style={{ maxWidth: 800, margin: '50px auto', padding: '0 20px' }}>
        <Card>
          <Result
            icon={<LoadingOutlined />}
            title="正在检查系统状态..."
          />
        </Card>
      </div>
    );
  }

  if (isInitialized) {
    return (
      <div style={{ maxWidth: 800, margin: '50px auto', padding: '0 20px' }}>
        <Card>
          <Result
            status="success"
            title="系统已完成初始化"
            subTitle="您可以开始使用所有功能"
            extra={[
              <Button 
                type="primary" 
                key="console" 
                onClick={() => history.push('/welcome')}
              >
                返回首页
              </Button>
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '50px auto', padding: '0 20px' }}>
      <Card>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 40 }}>
          系统初始化
        </Title>

        {errorData.length > 0 && (
          <Table
            dataSource={errorData.map((error, index) => ({ key: index, error }))}
            columns={columns}
            pagination={false}
            style={{ marginBottom: 20, backgroundColor: '#fff5f5', border: '1px solid #ffccc7' }}
          />
        )}

        <Steps
          direction="vertical"
          current={Object.values(initStatus).filter(Boolean).length}
          style={{ maxWidth: 600, margin: '0 auto 40px' }}
        >
          <Step 
            title="数据库初始化" 
            status={getStepStatus('database')}
            icon={getStepIcon('database')}
            description="初始化系统数据库和表结构"
          />
          <Step 
            title="系统配置" 
            status={getStepStatus('config')}
            icon={getStepIcon('config')}
            description="配置系统基本参数和运行环境"
          />
          <Step 
            title="用户初始化" 
            status={getStepStatus('users')}
            icon={getStepIcon('users')}
            description="创建管理员账户和基本用户结构"
          />
        </Steps>

        <div style={{ textAlign: 'center' }}>
          <Button 
            type="primary" 
            size="large"
            onClick={handleInitialize}
            loading={loading}
            disabled={isInitialized}
          >
            {loading ? '初始化中...' : '开始初始化'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SystemInit; 