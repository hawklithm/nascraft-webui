import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, message, Tag } from 'antd';
import { apiFetch } from '../utils/apiFetch';
import withSystemCheck from '../components/withSystemCheck';

const { Title } = Typography;

function UploadedFiles() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchUploadedFiles(currentPage, pageSize);
  }, [currentPage]);

  const fetchUploadedFiles = async (page, pageSize) => {
    try {
      const data = await apiFetch(`/uploaded_files?page=${page}&page_size=${pageSize}&status=2&sort_by=size&order=des`, {
        method: 'GET',
      });

      setFiles(data.files);
      setTotalFiles(data.total_files);
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
      message.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
    {
      title: 'Action',
      key: 'action',
      render: (text, record) => (
        <Tag color="blue" onClick={() => downloadFile(record.file_id, record.filename)} style={{ cursor: 'pointer' }}>
          Download
        </Tag>
      ),
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
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: totalFiles,
          onChange: (page) => setCurrentPage(page),
        }}
      />
    </Card>
  );
}

export default withSystemCheck(UploadedFiles); 