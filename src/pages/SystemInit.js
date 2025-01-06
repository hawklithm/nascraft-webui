import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Card, Button, Steps, Typography, message, Result, Table, Form, Input,  Select } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, MinusCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { apiFetch } from '../utils/apiFetch';
import {readTextFile,mkdir, exists, BaseDirectory,writeTextFile } from '@tauri-apps/plugin-fs';
import * as path from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';
import { open } from '@tauri-apps/plugin-dialog';
import { startWatching } from '../utils/fileWatcher';
import { audioDir, appDataDir, documentDir, downloadDir, pictureDir, videoDir } from '@tauri-apps/api/path';
import { sep } from '@tauri-apps/api/path';

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
  const [pathOptions, setPathOptions] = useState([]);

  useEffect(() => {
    checkSystemStatus();
  }, []);

  useEffect(() => {
    const fetchPaths = async () => {
      const paths = await Promise.all([
        { name: '音频目录', path: await audioDir() },
        { name: '应用数据目录', path: await appDataDir() },
        { name: '文档目录', path: await documentDir() },
        { name: '下载目录', path: await downloadDir() },
        { name: '图片目录', path: await pictureDir() },
        { name: '视频目录', path: await videoDir() },
      ]);
      setPathOptions(paths);
    };
    fetchPaths();
  }, []);

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
        const values = form.getFieldsValue();
        if (values.interval === undefined) {
          message.error('请选择检查间隔时间');
          return;
        }
        if (values.watchDir === undefined || values.watchDir.length === 0) {
          values.watchDir = [];
          console.log("values.watchDir setting missing");
        }
        // 处理 watchDir，将 select 和 input 组合成完整路径
        const processedWatchDir = values.watchDir.map(dir => {
          const select = dir.select || '';
          const input = dir.input || '';
          return `${select}${sep()}${input}`;
        });
        const newConfig = {
          watchDir: processedWatchDir,
          interval: values.interval
        };
        const dir_exists = await exists('', {
          baseDir: BaseDirectory.AppConfig,
        });
        if (!dir_exists) {
          await mkdir('', {
            baseDir: BaseDirectory.AppConfig,
          });
        }
        await writeTextFile(
          sysConfName,
           JSON.stringify(newConfig, null, 2),
           { baseDir: BaseDirectory.AppConfig }
        );
      }
      message.success('系统初始化成功！');
      await startWatching();
      setIsInitialized(true);
    } catch (error) {
      message.error('初始化过程中出现错误：' + error.message);
      console.log(error)
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (values) => {
    const newConfig = {
      watchDir: values.watchDir,
      interval: values.interval
    };
    await writeTextFile(
      sysConfName,
      JSON.stringify(newConfig, null, 2),
      { baseDir: BaseDirectory.AppConfig }
    );
    message.success('配置文件已更新！');
    setShowConfigForm(false);
    setInitStatus(prev => ({ ...prev, config: true }));
  };

  const handleSelectFolder = async (fieldKey) => {
    const appDataDir = await path.appDataDir();
    console.log("appDataDir=", appDataDir);
    const appLocalDataDir = await path.appLocalDataDir();
    console.log("appLocalDataDir=", appLocalDataDir);
    const folder = await open({
      multiple: false,
      directory: true,
      filters: [
        { name: appDataDir, extensions: ['*']},
        { name: appLocalDataDir, extensions: ['*']},
      ],
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
            {showConfigForm && (
              <Form form={form} layout="vertical">
                <Form.List name="watchDir">
                  {(fields, { add, remove }) => (
                    <div>
                      {fields.map(({ key, name, fieldKey, ...restField }) => (
                        <Form.Item
                          {...restField}
                          name={[name]}
                          label={`配置需要同步的文件夹路径`}
                          rules={[{ required: true, message: '请选择文件夹路径' }]}
                        >
                          <FolderPathInput fieldKey={fieldKey} form={form} options={pathOptions} />
                          <Button type="dashed" onClick={() => remove(name)}>删除</Button>
                        </Form.Item>
                      ))}
                      <Button type="dashed" onClick={() => add()} block>添加文件夹路径</Button>
                    </div>
                  )}
                </Form.List>
                <Form.Item
                  name="interval"
                  label="检查间隔时间"
                  rules={[{ required: true, message: '请选择检查间隔时间' }]}
                >
                  <Select style={{ width: '100%' }}>
                    <Select.Option value={1}>高性能（1秒）</Select.Option>
                    <Select.Option value={60}>平衡（60秒）</Select.Option>
                    <Select.Option value={300}>节能（300秒）</Select.Option>
                  </Select>
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

export const checkSysConf = async () => {
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

const FolderPathInput = ({ fieldKey, form, options }) => {
  const [combinedPath, setCombinedPath] = useState('');

  const handleSelectChange = (value) => {
    const currentInput = form.getFieldValue(['watchDir', fieldKey, 'input']) || '';
    const combined = `${value}${sep()}${currentInput}`;
    form.setFieldsValue({
      watchDir: {
        [fieldKey]: {
          select: value,
          input: currentInput,
        },
      },
    });
    setCombinedPath(combined);
  };

  const handleInputChange = (e) => {
    const currentSelect = form.getFieldValue(['watchDir', fieldKey, 'select']) || options.find(option => option.name === '文档目录')?.path;
    const combined = `${currentSelect}${sep()}${e.target.value}`;
    form.setFieldsValue({
      watchDir: {
        [fieldKey]: {
          select: currentSelect,
          input: e.target.value,
        },
      },
    });
    setCombinedPath(combined);
  };

  useEffect(() => {
    const defaultOption = options.find(option => option.name === '文档目录');
    if (defaultOption) {
      const currentInput = form.getFieldValue(['watchDir', fieldKey, 'input']) || '';
      const combined = `${defaultOption.path}${sep()}${currentInput}`;
      form.setFieldsValue({
        watchDir: {
          [fieldKey]: {
            select: defaultOption.path,
            input: currentInput,
          },
        },
      });
      setCombinedPath(combined);
    }
  }, [options, fieldKey, form]);

  return (
    <div>
      <Input.Group compact>
        <Select
          style={{ width: '30%' }}
          onChange={handleSelectChange}
          placeholder="选择路径"
          defaultValue={options.find(option => option.name === '文档目录')?.path}
        >
          {options.map((option, index) => (
            <Select.Option key={option.name} value={option.path}>{option.name}</Select.Option>
          ))}
        </Select>
        <Input
          style={{ width: '70%' }}
          placeholder="输入路径"
          onChange={handleInputChange}
        />
      </Input.Group>
      <div style={{ marginTop: 8 }}>
        <Typography.Text type="secondary">完整路径: {combinedPath}</Typography.Text>
      </div>
    </div>
  );
};

export default SystemInit; 