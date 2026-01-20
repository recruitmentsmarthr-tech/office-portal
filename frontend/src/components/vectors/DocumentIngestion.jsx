import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function DocumentIngestion({ user }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const canIngest = user && user.role === 'admin'; // Based on backend permission check

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocuments(response.data);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setError('Failed to fetch documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 10000); // Poll every 10 seconds for status updates
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);

      await axios.post(`${API_BASE_URL}/api/ingest`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setSelectedFile(null); // Clear selected file after upload
      fetchDocuments(); // Refresh the list to show the new document (status pending)
    } catch (err) {
      console.error("File upload failed:", err.response ? err.response.data : err);
      setError(`Failed to upload file: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchDocuments(); // Refresh the list
    } catch (err) {
      console.error("Failed to delete document:", err.response ? err.response.data : err);
      setError(`Failed to delete document: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      setSelectedFile(event.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Document Ingestion Hub</h2>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
      {loading && <div className="text-blue-500 mb-4">Loading...</div>}

      {canIngest ? (
        <div className="mb-8">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-gray-600">
              {selectedFile ? `Selected: ${selectedFile.name}` : 'Drag and drop files here or click to upload'}
            </p>
          </div>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || loading}
            className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Upload Document
          </button>
        </div>
      ) : (
        <p className="text-red-500">You do not have permission to ingest documents.</p>
      )}

      <h3 className="text-xl font-semibold mb-3">Ingested Documents</h3>
      {documents.length === 0 ? (
        <p className="text-gray-500">No documents ingested yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Filename</th>
                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Upload Date</th>
                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Indexing Status</th>
                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="py-2 px-4 text-sm text-gray-800">{doc.filename}</td>
                  <td className="py-2 px-4 text-sm text-gray-800">{format(new Date(doc.upload_date), 'yyyy-MM-dd HH:mm')}</td>
                  <td className="py-2 px-4 text-sm text-gray-800">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      doc.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      doc.status === 'INDEXING' ? 'bg-yellow-100 text-yellow-800' :
                      doc.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-sm text-gray-800">
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-600 hover:text-red-900"
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DocumentIngestion;