import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, message, Tag } from 'antd';
import { apiFetch } from '../utils/apiFetch';
import withSystemCheck from '../components/withSystemCheck';
import dayjs from 'dayjs';

const { Title } = Typography;

function UploadedFiles() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    sortBy: 'date',
    order: 'desc'
  });
  const pageSize = 10;

  useEffect(() => {
    fetchUploadedFiles(currentPage, pageSize, sortConfig.sortBy, sortConfig.order);
  }, [currentPage, sortConfig]);

  const fetchUploadedFiles = async (page, pageSize, sortBy, order) => {
    try {
      const data = await apiFetch(
        `/uploaded_files?page=${page}&page_size=${pageSize}&status=2&sort_by=${sortBy}&order=${order}`,
        { method: 'GET' }
      );

      setFiles(data.files);
      setTotalFiles(data.total_files);
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
      message.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (pagination, filters, sorter) => {
    let sortBy = 'date';
    let order = 'desc';

    if (sorter.field === 'total_size') {
      sortBy = 'size';
    } else if (sorter.field === 'file_id') {
      sortBy = 'id';
    } else if (sorter.field === 'last_updated') {
      sortBy = 'date';
    }

    if (sorter.order === 'ascend') {
      order = 'asc';
    } else if (sorter.order === 'descend') {
      order = 'desc';
    }

    setSortConfig({ sortBy, order });
    setCurrentPage(pagination.current);
  };

  const downloadFile = async (fileId, filename) => {
    try {
      const response = await fetch(`/api/download/${fileId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      message.error(`Download failed: ${error.message}`);
    }
  };

  const columns = [
    {
      title: '文件ID',
      dataIndex: 'file_id',
      key: 'file_id',
      sorter: true,
      sortOrder: sortConfig.sortBy === 'id' && `${sortConfig.order}end`,
      width: 160,
      fixed: 'left',
    },
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      width: 220,
    },
    {
      title: '文件大小 (MB)',
      dataIndex: 'total_size',
      key: 'total_size',
      render: (size) => (size / (1024 * 1024)).toFixed(2),
      sorter: true,
      sortOrder: sortConfig.sortBy === 'size' && `${sortConfig.order}end`,
      width: 140,
    },
    {
      title: '校验和',
      dataIndex: 'checksum',
      key: 'checksum',
      width: 220,
    },
    {
      title: '上传时间',
      dataIndex: 'last_updated',
      key: 'last_updated',
      render: (timestamp) => dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
      sorter: true,
      sortOrder: sortConfig.sortBy === 'date' && `${sortConfig.order}end`,
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (status === 2 ? '已完成' : '处理中'),
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (text, record) => (
        <Tag color="blue" onClick={() => downloadFile(record.file_id, record.filename)} style={{ cursor: 'pointer' }}>
          下载
        </Tag>
      ),
    },
  ];

  return (
    <Card>
      <Title level={2}>已上传文件</Title>
      <Table
        columns={columns}
        dataSource={files}
        rowKey="file_id"
        loading={loading}
        onChange={handleTableChange}
        tableLayout="fixed"
        scroll={{ x: 'max-content' }}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: totalFiles,
          showSizeChanger: false,
        }}
      />
    </Card>
  );
}

export default withSystemCheck(UploadedFiles); 