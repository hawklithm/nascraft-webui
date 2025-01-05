import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Card, Button, Steps, Typography, message, Result, Table, Form, Input, InputNumber } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, MinusCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { apiFetch } from '../utils/apiFetch';
import {readTextFile, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import * as path from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';
import { writeFile } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';

const { Title } = Typography;
const { Step } = Steps;

const sysConfName = 'sys.conf';
const SystemInit = () => {
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initStatus, setInitStatus] = useState({
    database: false,
    config: false,
  });
  const [errorData, setErrorData] = useState([]);
  const [form] = Form.useForm();
  const [showConfigForm, setShowConfigForm] = useState(false);

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSysConf = async () => {
    const sysConfExists = await exists(sysConfName, { baseDir: BaseDirectory.AppConfig });
    const appConfigDir = await path.appConfigDir();
      console.log("appConfigDir=", appConfigDir);
    if (sysConfExists) {
      const sysConfContent = await readTextFile(sysConfName, { baseDir: BaseDirectory.AppConfig });
      try {
        const sysConfJson = JSON.parse(sysConfContent);
        if (!Array.isArray(sysConfJson.watchDir) || typeof sysConfJson.interval !== 'number') {
          throw new Error('sys.conf file is missing required fields');
        }
        return true;
      } catch (e) {
        throw new Error('sys.conf file is not valid JSON');
      }
    } else {
      throw new Error('sys.conf file is missing');
    }
  };

  const checkSystemStatus = async () => {
    try {
      // Check table structure
      await apiFetch('/check_table_structure', {
        method: 'GET'
      });
      setInitStatus(prev => ({ ...prev, database: true }));
      let platform_name = "unknown";
      try{
        platform_name = await platform();
      }catch(e){
        console.log("no in tauri");
      }
      console.log("platform=",platform_name);
      // Check if running in Tauri
      if (platform_name!=="unknown") {
        // Check sys.conf file
        await checkSysConf();
        setInitStatus(prev => ({ ...prev, config: true }));
      } else {
        // If not running in Tauri, skip config file check
        setInitStatus(prev => ({ ...prev, config: true }));
      }

      setIsInitialized(true);
    } catch (error) {
      message.error('检查系统状态失败：' + error);
      setErrorData(error.data || []);
      setShowConfigForm(true);
    } finally {
      setChecking(false);
    }
  };

  const handleInitialize = async () => {
    setLoading(true);
    try {
      await apiFetch('/ensure_table_structure', {
        method: 'POST'
      });

      // 创建或更新 sys.conf 文件
      try {
        await checkSysConf();
      } catch (error) {
        // 如果 sys.conf 文件不存在或不符合要求，则创建文件
        const defaultConfig = {
          watchDir: [],
          interval: 60
        };
        await writeFile(
          sysConfName,
           JSON.stringify(defaultConfig, null, 2),
           { baseDir: BaseDirectory.AppConfig }
        );
      }
      message.success('系统初始化成功！');
      setIsInitialized(true);
      history.push('/welcome');
    } catch (error) {
      message.error('初始化过程中出现错误：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (values) => {
    const newConfig = {
      watchDir: values.watchDir,
      interval: values.interval
    };
    await writeFile(
      sysConfName,
      JSON.stringify(newConfig, null, 2),
      { baseDir: BaseDirectory.AppConfig }
    );
    message.success('配置文件已更新！');
    setShowConfigForm(false);
    setInitStatus(prev => ({ ...prev, config: true }));
  };

  const handleSelectFolder = async (fieldKey) => {
    const folder = await open({
      multiple: false,
      directory: true,
    });
    if (folder) {
      const currentWatchDir = form.getFieldValue('watchDir') || [];
      currentWatchDir[fieldKey] = folder;
      form.setFieldsValue({ watchDir: currentWatchDir });
    }
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

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Card>
            <Title level={4}>数据库初始化</Title>
            <p>初始化系统数据库和表结构。</p>
          </Card>
        );
      case 1:
        return (
          <Card>
            <Title level={4}>配置文件检查</Title>
            <p>检查 sys.conf 配置文件。</p>
            {showConfigForm && (
              <Form form={form} onFinish={handleFormSubmit} layout="vertical">
                <Form.List name="watchDir">
                  {(fields, { add, remove }) => (
                    <div>
                      {fields.map(({ key, name, fieldKey, ...restField }) => (
                        <Form.Item
                          {...restField}
                          name={[name]}
                          fieldKey={[fieldKey]}
                          rules={[{ required: true, message: '请选择文件夹路径' }]}
                        >
                          <Input
                            placeholder="文件夹路径"
                            style={{ width: '80%', marginRight: 8 }}
                            value={form.getFieldValue(['watchDir', fieldKey])}
                            readOnly
                          />
                          <Button type="dashed" onClick={() => handleSelectFolder(fieldKey)}>选择文件夹</Button>
                          <Button type="dashed" onClick={() => remove(name)}>删除</Button>
                        </Form.Item>
                      ))}
                      <Button type="dashed" onClick={() => add()} block>添加文件夹路径</Button>
                    </div>
                  )}
                </Form.List>
                <Form.Item
                  name="interval"
                  label="检查间隔时间（秒）"
                  rules={[{ required: true, message: '请输入检查间隔时间' }]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">提交</Button>
                </Form.Item>
              </Form>
            )}
          </Card>
        );
      default:
        return null;
    }
  };

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
          description={renderStepContent(0)}
        />
        <Step 
          title="配置文件检查"
          status={getStepStatus('config')}
          icon={getStepIcon('config')}
          description={renderStepContent(1)}
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
    </div>
  );
};

export default SystemInit; 