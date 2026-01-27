import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import DocumentTable from './DocumentTable'; // Import the new component

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function DocumentIngestion() {
  const { user, token } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef(null);
  const [uploadVersion, setUploadVersion] = useState(0);

  const canIngest = user && user.role === 'admin';

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
    if (!token) {
      setError('You must be logged in to upload files.');
      return;
    }

    setLoading(true);
    setError('');
    setUploadSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(`${API_BASE_URL}/api/ingest`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setUploadSuccess(`Successfully uploaded ${response.data.filename}. Processing in background.`);
      setSelectedFile(null);
      // Increment the version to force re-mount of the DocumentTable
      setUploadVersion(v => v + 1);
    } catch (err) {
      console.error("File upload failed:", err.response ? err.response.data : err);
      setError(`Failed to upload file: ${err.response?.data?.detail || err.message}`);
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
      {uploadSuccess && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{uploadSuccess}</div>}
      
      {canIngest ? (
        <div className="mb-8 p-6 bg-white shadow-md rounded-lg">
          <h3 className="text-xl font-semibold mb-3">Upload New Document</h3>
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
            className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      ) : (
        <p className="text-red-500 my-4">You do not have permission to ingest new documents.</p>
      )}

      {/* Render two separate tables instead of using tabs */}
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-semibold mb-3">Uploaded Documents</h3>
          <DocumentTable key={`general-${uploadVersion}`} documentType="general_document" />
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-3">Meeting Documents</h3>
          <DocumentTable key={`meetings-${uploadVersion}`} documentType={['full_transcript', 'meeting_minutes']} />
        </div>
      </div>

    </div>
  );
}

export default DocumentIngestion;