import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { Card, Button, Steps, Typography, message, Result, Table, Form, Input, Select, FloatButton, Drawer, List, Progress, Badge, Switch } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, MinusCircleOutlined, ExclamationCircleOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { isTauriRuntime } from '../utils/apiFetch';
import { readTextFile, mkdir, exists, BaseDirectory, writeTextFile } from '@tauri-apps/plugin-fs';
import * as path from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';
import { open } from '@tauri-apps/plugin-dialog';
import { startWatching } from '../utils/fileWatcher';
import { audioDir, appDataDir, documentDir, downloadDir, pictureDir, videoDir } from '@tauri-apps/api/path';
import { sep } from '@tauri-apps/api/path';
import { setUploadProgressCallback } from '../utils/fileWatcher';
import { getAlbumUploadManager } from '../utils/AlbumUploadManager';

const { Title } = Typography;
const { Step } = Steps;

const sysConfName = 'sys.conf';
const SystemInit = () => {
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [reconfigMode, setReconfigMode] = useState(false);
  const [initStatus, setInitStatus] = useState({
    database: false,
    config: false,
  });
  const [errorData, setErrorData] = useState([]);
  const [form] = Form.useForm();
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [pathOptions, setPathOptions] = useState([]);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [uploadList, setUploadList] = useState([]);
  const [isMobileTauri, setIsMobileTauri] = useState(false);

  useEffect(() => {
    (async () => {
      const isTauri = await isTauriRuntime();
      if (!isTauri) {
        setIsMobileTauri(false);
        return;
      }
      try {
        const p = await platform();
        setIsMobileTauri(p === 'android' || p === 'ios');
      } catch (e) {
        setIsMobileTauri(false);
      }
    })();

    checkSystemStatus();
  }, []);

  useEffect(() => {
    const fetchPaths = async () => {
      const isTauri = await isTauriRuntime();
      if (!isTauri) {
        setPathOptions([]);
        return;
      }

      const paths = await Promise.all([
        { name: '音频目录', path: await audioDir(), baseDir: BaseDirectory.Audio },
        { name: '应用数据目录', path: await appDataDir(), baseDir: BaseDirectory.AppData },
        { name: '文档目录', path: await documentDir(), baseDir: BaseDirectory.Document },
        { name: '下载目录', path: await downloadDir(), baseDir: BaseDirectory.Download },
        { name: '图片目录', path: await pictureDir(), baseDir: BaseDirectory.Picture },
        { name: '视频目录', path: await videoDir(), baseDir: BaseDirectory.Video },
      ]);
      setPathOptions(paths);
    };
    fetchPaths();
  }, []);

  useEffect(() => {
    setUploadProgressCallback((progressList) => {
      setUploadList(progressList);
    });
  }, []);

  const prefillFormFromSysConf = useCallback(async () => {
    const sysConfContent = await readTextFile(sysConfName, { baseDir: BaseDirectory.AppConfig });
    const sysConfJson = JSON.parse(sysConfContent);

    const watchDir = Array.isArray(sysConfJson.watchDir) ? sysConfJson.watchDir : [];
    const interval = typeof sysConfJson.interval === 'number' ? sysConfJson.interval : undefined;
    const host = typeof sysConfJson.host === 'string' ? sysConfJson.host : undefined;
    const autoUploadAlbum = typeof sysConfJson.autoUploadAlbum === 'boolean' ? sysConfJson.autoUploadAlbum : false;

    form.setFieldsValue({
      watchDir,
      interval,
      host,
      autoUploadAlbum,
    });
  }, [form]);

  useEffect(() => {
    if (!reconfigMode) return;
    if (pathOptions.length === 0) return;
    (async () => {
      try {
        await prefillFormFromSysConf();
      } catch (e) {
        console.log('prefill sys.conf failed', e);
      }
    })();
  }, [reconfigMode, pathOptions, prefillFormFromSysConf]);

  const writeConfigFromFormValues = async (values) => {
    const isTauri = await isTauriRuntime();
    if (!isTauri) {
      message.warning('当前不在桌面应用环境中，配置文件不会写入本地。');
      return true;
    }

    if (values.interval === undefined) {
      message.error('请选择检查间隔时间');
      return false;
    }
    if (values.host === undefined) {
      message.error('请输入后端服务地址');
      return false;
    }
    if (values.watchDir === undefined || values.watchDir.length === 0) {
      values.watchDir = [];
      console.log('values.watchDir setting missing');
    }

    const processedWatchDir = (values.watchDir || []).filter((p) => typeof p === 'string' && p.trim());

    const newConfig = {
      watchDir: processedWatchDir,
      interval: values.interval,
      host: values.host,
      autoUploadAlbum: values.autoUploadAlbum || false,
    };

    await writeTextFile(sysConfName, JSON.stringify(newConfig, null, 2), { baseDir: BaseDirectory.AppConfig });
    return true;
  };

  const checkSystemStatus = async () => {
    try {
      // Check table structure
      // await apiFetch('/check_table_structure', {
      //   method: 'GET'
      // },false);
      setInitStatus(prev => ({ ...prev, database: true }));
      const isTauri = await isTauriRuntime();
      if (isTauri) {
        // Check sys.conf file
        await checkSysConf();
        setInitStatus(prev => ({ ...prev, config: true }));
      } else {
        // If not running in Tauri, skip config file check
        setInitStatus(prev => ({ ...prev, config: true }));
      }

      // setIsInitialized(true);
    } catch (error) {
      console.log('检查系统状态失败：' + error);
      setErrorData([error.message]);
      setShowConfigForm(true);
    } finally {
      setChecking(false);
    }
  };

  const handleInitialize = async () => {
    setLoading(true);
    try {
      // await apiFetch('/ensure_table_structure', {
      //   method: 'POST'
      // });

      // 创建或更新 sys.conf 文件
      if (reconfigMode) {
        const values = form.getFieldsValue();
        const ok = await writeConfigFromFormValues(values);
        if (!ok) return;
        message.success('配置已更新！');
      } else {
        try {
          await checkSysConf();
        } catch (error) {
          const values = form.getFieldsValue();
          const ok = await writeConfigFromFormValues(values);
          if (!ok) return;
        }
        message.success('系统初始化成功！');
      }
      await startWatching();

      // 启动相册自动上传（仅移动端）
      if (isMobileTauri) {
        await startAlbumAutoUpload();
      }

      // setIsInitialized(true);
      setReconfigMode(false);
      setShowConfigForm(false);
      setInitStatus(prev => ({ ...prev, config: true }));
    } catch (error) {
      message.error('初始化过程中出现错误：' + error.message);
      console.log(error)
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (values) => {
    const ok = await writeConfigFromFormValues(values);
    if (!ok) return;
    message.success('配置文件已更新！');
    setShowConfigForm(false);
    setInitStatus(prev => ({ ...prev, config: true }));
    await startWatching();
    // setIsInitialized(true);
    setReconfigMode(false);

    // 如果开启了自动上传相册，重新启动上传
    if (isMobileTauri && values.autoUploadAlbum) {
      await startAlbumAutoUpload();
    }
  };

  const startAlbumAutoUpload = async () => {
    try {
      const manager = getAlbumUploadManager();
      const isEnabled = await manager.checkAutoUploadConfig();
      if (!isEnabled) {
        console.log('Album auto upload is disabled');
        return;
      }

      console.log('Starting album auto upload...');
      await manager.startAlbumUpload();
      message.success('开始自动上传相册图片');
    } catch (error) {
      console.error('Failed to start album auto upload:', error);
      message.error('启动相册自动上传失败：' + error.message);
    }
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

  // 修复：重构FolderPathInput组件，移除内部的form.setFieldsValue调用
  const FolderPathInput = React.memo(({ value, onChange, options }) => {
    // 将完整路径拆分为select和input两部分
    const parsePath = (path) => {
      if (!path) return { select: '', input: '' };

      // 查找匹配的基础路径
      const matchedOption = options.find(option => path.startsWith(option.path));
      if (matchedOption) {
        const subPath = path.substring(matchedOption.path.length);
        // 移除开头的路径分隔符
        const cleanedSubPath = subPath.startsWith(sep()) ? subPath.substring(sep().length) : subPath;
        return { select: matchedOption.path, input: cleanedSubPath };
      }

      // 如果没有匹配的基础路径，则使用文档目录作为默认
      const defaultOption = options.find(option => option.name === '文档目录');
      return { select: defaultOption?.path || '', input: path };
    };

    const { select: selectValue, input: inputValue } = parsePath(value);
    const combinedPath = value || '';

    const handleSelectChange = (newSelect) => {
      const newPath = newSelect + (inputValue ? sep() + inputValue : '');
      onChange(newPath);
    };

    const handleInputChange = (e) => {
      const newInput = e.target.value;
      const newPath = selectValue + (newInput ? sep() + newInput : '');
      onChange(newPath);
    };

    return (
      <div>
        <Input.Group compact>
          <Select
            style={{ width: '30%' }}
            onChange={handleSelectChange}
            placeholder="选择路径"
            value={selectValue}
          >
            {options.map((option) => (
              <Select.Option key={option.name} value={option.path}>
                {option.name}
              </Select.Option>
            ))}
          </Select>
          <Input
            style={{ width: '70%' }}
            placeholder="输入路径"
            onChange={handleInputChange}
            value={inputValue}
          />
        </Input.Group>
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary">完整路径: {combinedPath}</Typography.Text>
        </div>
      </div>
    );
  });

  const Step0Content = React.memo(({ errorData }) => (
    <Card>
      <Title level={4}>系统初始化</Title>
      <p>初始化系统配置</p>
      {errorData.length > 0 && (
        <Table
          dataSource={errorData.map((error, index) => ({ key: index, error }))}
          columns={columns}
          pagination={false}
          style={{ marginTop: 16, backgroundColor: '#fff5f5', border: '1px solid #ffccc7' }}
        />
      )}
    </Card>
  ));

  const Step1Content = React.memo(({ showConfigForm, form, isMobileTauri, pathOptions }) => {
    const handleSelectFolder = useCallback(async (fieldKey) => {
      const folder = await open({
        multiple: false,
        directory: true,
      });
      if (folder) {
        const currentWatchDir = form.getFieldValue('watchDir') || [];
        currentWatchDir[fieldKey] = folder;
        form.setFieldsValue({ watchDir: currentWatchDir });
      }
    }, [form]);

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
                      key={key}
                    >
                      {!isMobileTauri ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Input
                            readOnly
                            placeholder="请选择需要监听的文件夹"
                            value={form.getFieldValue(['watchDir', fieldKey])}
                            style={{ flex: 1 }}
                          />
                          <Button onClick={() => handleSelectFolder(fieldKey)}>选择</Button>
                          <Button type="dashed" onClick={() => remove(name)}>删除</Button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <FolderPathInput
                            value={form.getFieldValue(['watchDir', fieldKey])}
                            onChange={(newValue) => {
                              form.setFieldsValue({
                                watchDir: {
                                  [fieldKey]: newValue
                                }
                              });
                            }}
                            options={pathOptions}
                          />
                          <Button type="dashed" onClick={() => remove(name)}>删除</Button>
                        </div>
                      )}
                    </Form.Item>
                  ))}
                  {!isMobileTauri ? (
                    <Button type="dashed" onClick={() => add('')} block>
                      添加文件夹路径
                    </Button>
                  ) : (
                    <Button type="dashed" onClick={() => add('')} block>
                      添加文件夹路径
                    </Button>
                  )}
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
            <Form.Item
              name="host"
              label="配置后端服务地址"
              rules={[{ required: true, message: '请检查服务地址' }]}
            >
              <Input
                style={{ width: '70%' }}
                placeholder="输入服务地址"
              />
            </Form.Item>
            <Form.Item
              name="autoUploadAlbum"
              valuePropName="checked"
              label="自动上传相册图片"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
          </Form>
        )}
      </Card>
    );
  });

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return <Step0Content errorData={errorData} />;
      case 1:
        return (
          <Step1Content
            showConfigForm={showConfigForm}
            form={form}
            isMobileTauri={isMobileTauri}
            pathOptions={pathOptions}
          />
        );
      default:
        return null;
    }
  };

  const renderUploadStatus = (status) => {
    switch (status) {
      case 'uploading':
        return <Badge status="processing" text="上传中" />;
      case 'success':
        return <Badge status="success" text="已完成" />;
      case 'error':
        return <Badge status="error" text="失败" />;
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

  if (/*isInitialized &&*/ !reconfigMode) {
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
              ,
              <Button
                size="small"
                key="reconfig"
                onClick={() => {
                  setReconfigMode(true);
                  setShowConfigForm(true);
                  setInitStatus((prev) => ({ ...prev, config: false }));
                }}
              >
                修改配置
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
          {loading ? (reconfigMode ? '保存中...' : '初始化中...') : (reconfigMode ? '保存配置' : '开始初始化')}
        </Button>
      </div>

      <FloatButton
        icon={<CloudUploadOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24 }}
        onClick={() => setShowUploadProgress(true)}
        badge={{ count: uploadList.filter(([_, { status }]) => status === 'uploading').length }}
      />

      <Drawer
        title="文件上传进度"
        placement="right"
        onClose={() => setShowUploadProgress(false)}
        open={showUploadProgress}
        width={400}
      >
        <List
          dataSource={uploadList}
          renderItem={([filePath, { progress, status }]) => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text ellipsis style={{ maxWidth: '80%' }}>
                    {filePath.split('/').pop()}
                  </Typography.Text>
                  {renderUploadStatus(status)}
                </div>
                <Progress percent={progress} status={status === 'error' ? 'exception' : undefined} />
              </div>
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
};

export const checkSysConf = async () => {
  const sysConfExists = await exists(sysConfName, { baseDir: BaseDirectory.AppConfig });
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
    throw new Error('sys.conf file need initialization');
  }
};

export default SystemInit;
