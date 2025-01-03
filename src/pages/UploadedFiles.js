import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, message } from 'antd';
import { apiFetch } from '../utils/apiFetch';

const { Title } = Typography;

function UploadedFiles() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  const fetchUploadedFiles = async () => {
    try {
      const filesData = await apiFetch('/uploaded_files?page=1&page_size=10&status=2&sort_by=size&order=des', {
        method: 'GET',
      });

      setFiles(filesData);
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
      message.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'File ID',
      dataIndex: 'file_id',
      key: 'file_id',
    },
    {
      title: 'Filename',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: 'Total Size (MB)',
      dataIndex: 'total_size',
      key: 'total_size',
      render: (size) => (size / (1024 * 1024)).toFixed(2),
    },
    {
      title: 'Checksum',
      dataIndex: 'checksum',
      key: 'checksum',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (status === 2 ? 'Completed' : 'Pending'),
    },
  ];

  return (
    <Card>
      <Title level={2}>Uploaded Files</Title>
      <Table
        columns={columns}
        dataSource={files}
        rowKey="file_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}

export default UploadedFiles; 