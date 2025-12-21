import React, { useState, useEffect } from 'react';
import { Card, List, Typography, Breadcrumb, Row, Col, message, Dropdown, Menu, Modal } from 'antd';
import { FolderOutlined, PlayCircleOutlined, HomeOutlined, MoreOutlined, PlayCircleFilled, EyeInvisibleOutlined, CheckOutlined } from '@ant-design/icons';
import { apiFetch } from '../utils/apiFetch';
import withSystemCheck from '../components/withSystemCheck';

const { Title } = Typography;

function VideoList() {
  const [loading, setLoading] = useState(true);
  const [currentData, setCurrentData] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState("0");
  const [devices, setDevices] = useState([]);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(false);

  const fetchFolderContent = async (id = "0") => {
    try {
      setLoading(true);
      const response = await apiFetch('/dlna/browse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      setCurrentData(response);
      setBreadcrumbs(response.breadcrumbs || []);
      setCurrentFolderId(id);
    } catch (error) {
      console.error('Error fetching folder content:', error);
      message.error('获取文件夹内容失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      setDeviceLoading(true);
      const deviceList = await apiFetch('/dlna/devices', {
        method: 'GET'
      });
      setDevices(deviceList|| []);
    } catch (error) {
      console.error('获取设备列表失败:', error);
      message.error('获取设备列表失败');
    } finally {
      setDeviceLoading(false);
    }
  };

  useEffect(() => {
    fetchFolderContent();
  }, []);

  const handleFolderClick = (id) => {
    fetchFolderContent(id);
  };

  const handleBreadcrumbClick = (id) => {
    if (id === currentFolderId) {
      return;
    }
    fetchFolderContent(id);
  };

  const handlePlay = async (deviceId) => {
    if (!selectedVideo || !deviceId) return;

    try {
      await apiFetch('/dlna/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: deviceId,
          media_id: selectedVideo.id
        }),
      });
      message.success('开始投屏播放');
      setDeviceModalVisible(false);
    } catch (error) {
      console.error('投屏失败:', error);
      message.error('投屏失败');
    }
  };

  const handleVideoAction = (action, item) => {
    switch (action) {
      case 'play':
        setSelectedVideo(item);
        setDeviceModalVisible(true);
        fetchDevices();
        break;
      case 'hide':
        message.info(`隐藏: ${item.name}`);
        break;
      default:
        break;
    }
  };

  const getVideoMenu = (item) => (
    <Menu onClick={({ key }) => handleVideoAction(key, item)}>
      <Menu.Item key="play" icon={<PlayCircleFilled />}>播放</Menu.Item>
      <Menu.Item key="hide" icon={<EyeInvisibleOutlined />}>隐藏</Menu.Item>
    </Menu>
  );

  const renderMediaSection = (title, items) => {
    if (!items || items.length === 0) return null;

    return (
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>{title}</Title>
        <List
          grid={{ gutter: 24, xs: 1, sm: 2, md: 3, lg: 4 }}
          dataSource={items}
          renderItem={item => (
            <List.Item>
              <Card
                hoverable
                style={{ 
                  height: '100%',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  transition: 'all 0.3s',
                }}
                cover={
                  <div style={{ 
                    height: 180, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
                    position: 'relative',
                  }}>
                    <PlayCircleOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(255, 255, 255, 0.9)',
                      padding: '8px',
                      backdropFilter: 'blur(4px)',
                    }}>
                      <Typography.Text
                        style={{
                          color: '#1f1f1f',
                          fontSize: '14px',
                          fontWeight: 500,
                        }}
                        ellipsis={{ tooltip: item.name }}
                      >
                        {item.name}
                      </Typography.Text>
                    </div>
                  </div>
                }
              >
                <Card.Meta title={item.name} />
              </Card>
            </List.Item>
          )}
        />
      </div>
    );
  };

  const isHomePage = currentFolderId === "0";

  return (
    <>
      <Card loading={loading} bodyStyle={{ padding: '24px' }}>
        <Breadcrumb style={{ marginBottom: 24 }}>
          <Breadcrumb.Item 
            onClick={() => handleBreadcrumbClick("0")}
            style={{ 
              cursor: isHomePage ? 'default' : 'pointer',
              color: isHomePage ? 'rgba(0, 0, 0, 0.45)' : '#1890ff',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <HomeOutlined style={{ 
              fontSize: '16px',
              transition: 'all 0.3s',
              color: isHomePage ? 'rgba(0, 0, 0, 0.45)' : '#1890ff'
            }} />
            <span style={{ 
              fontWeight: isHomePage ? 'normal' : 500
            }}>
              首页
            </span>
          </Breadcrumb.Item>
          {breadcrumbs
            .filter(item => item.id !== "0" && !(isHomePage && item.name === "root"))
            .map((item, index) => (
              <Breadcrumb.Item 
                key={index}
                onClick={() => handleBreadcrumbClick(item.id)}
                style={{ 
                  cursor: item.id === currentFolderId ? 'default' : 'pointer',
                  color: item.id === currentFolderId ? 'rgba(0, 0, 0, 0.45)' : undefined
                }}
              >
                {item.name}
              </Breadcrumb.Item>
            ))}
        </Breadcrumb>

        <Row gutter={24}>
          {/* 左侧文件夹列表 */}
          <Col span={6} style={{ 
            borderRight: '1px solid #f0f0f0', 
            paddingRight: 16,
            height: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }}>
            <List
              dataSource={currentData?.folders || []}
              renderItem={folder => (
                <List.Item style={{ padding: '4px 0' }}>
                  <Card
                    hoverable
                    onClick={() => handleFolderClick(folder.id)}
                    style={{ 
                      width: '100%',
                      borderRadius: '8px',
                      transition: 'all 0.3s',
                    }}
                    bodyStyle={{
                      padding: '12px',
                      background: '#fafafa',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: '#e6f7ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                      }}>
                        <FolderOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                      </div>
                      <Typography.Text
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          flex: 1,
                        }}
                        ellipsis={{ tooltip: folder.name }}
                      >
                        {folder.name}
                      </Typography.Text>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          </Col>

          {/* 右侧内容区域 */}
          <Col span={18} style={{ 
            height: 'calc(100vh - 200px)',
            overflowY: 'auto',
            paddingLeft: 16 
          }}>
            {isHomePage ? (
              // 首页显示媒体选择
              currentData?.mediasSelections && (
                <>
                  {renderMediaSection('最近添加', currentData.mediasSelections.recentlyAdded)}
                  {renderMediaSection('最近播放', currentData.mediasSelections.recentlyPlayed)}
                  {renderMediaSection('播放中', currentData.mediasSelections.inProgress)}
                  {renderMediaSection('最多播放', currentData.mediasSelections.mostPlayed)}
                </>
              )
            ) : (
              // 非首页显示视频文件列表
              <List
                grid={{ gutter: 24, xs: 1, sm: 2, md: 3, lg: 4 }}
                dataSource={currentData?.medias || []}
                renderItem={item => (
                  <List.Item>
                    <Card
                      hoverable
                      style={{ 
                        height: '100%',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        transition: 'all 0.3s',
                      }}
                      bodyStyle={{
                        padding: '12px',
                      }}
                      cover={
                        <div style={{ 
                          height: 180, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
                          position: 'relative',
                        }}>
                          <PlayCircleOutlined 
                            style={{ 
                              fontSize: 48, 
                              color: '#1890ff',
                              transition: 'all 0.3s',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleVideoAction('play', item)}
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(255, 255, 255, 0.9)',
                            padding: '8px',
                            backdropFilter: 'blur(4px)',
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <Typography.Text
                                style={{
                                  color: '#1f1f1f',
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  flex: 1,
                                  marginRight: '8px'
                                }}
                                ellipsis={{ tooltip: item.name }}
                              >
                                {item.name}
                              </Typography.Text>
                              <Dropdown 
                                overlay={getVideoMenu(item)} 
                                trigger={['click']}
                                placement="bottomRight"
                              >
                                <MoreOutlined 
                                  style={{ 
                                    fontSize: '18px', 
                                    cursor: 'pointer',
                                    color: '#1f1f1f',
                                    transition: 'all 0.3s',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    ':hover': {
                                      background: 'rgba(0, 0, 0, 0.04)'
                                    }
                                  }} 
                                />
                              </Dropdown>
                            </div>
                          </div>
                        </div>
                      }
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                          ID: {item.id}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                          更新: {item.updateId}
                        </Typography.Text>
                      </div>
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </Col>
        </Row>
      </Card>

      <Modal
        title="选择投屏设备"
        open={deviceModalVisible}
        onCancel={() => setDeviceModalVisible(false)}
        footer={null}
        width={480}
      >
        <List
          loading={deviceLoading}
          dataSource={devices}
          renderItem={device => (
            <List.Item
              style={{ 
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '8px',
                transition: 'all 0.3s',
                ':hover': {
                  background: '#f5f5f5'
                }
              }}
              onClick={() => handlePlay(device.id)}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                width: '100%'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '20px',
                  background: '#e6f7ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px'
                }}>
                  <PlayCircleOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <Typography.Text strong>{device.name}</Typography.Text>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                      {device.address}
                    </Typography.Text>
                    {device.is_active && (
                      <Typography.Text type="success" style={{ fontSize: '12px', marginLeft: '8px' }}>
                        <CheckOutlined /> 在线
                      </Typography.Text>
                    )}
                  </div>
                </div>
              </div>
            </List.Item>
          )}
          locale={{
            emptyText: '没有找到可用的投屏设备'
          }}
        />
      </Modal>
    </>
  );
}

export default withSystemCheck(VideoList); 