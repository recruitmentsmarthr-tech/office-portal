import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { Search, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function DocumentTable({ documentType }) {
  const { token } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Create a stable ID for the component instance for unique form input IDs
  const tableId = Array.isArray(documentType) ? documentType.join('-') : documentType;

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [perPage, setPerPage] = useState(10);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    // Manually build query string to ensure correct array serialization
    const params = new URLSearchParams();
    if (Array.isArray(documentType)) {
      documentType.forEach(type => params.append('document_type', type));
    } else {
      params.append('document_type', documentType);
    }
    
    params.append('page', page);
    params.append('per_page', perPage);
    
    if (debouncedSearchTerm) {
      params.append('q', debouncedSearchTerm);
    }
    if (startDate) {
      params.append('start_date', startDate);
    }
    if (endDate) {
      params.append('end_date', endDate);
    }

    const queryString = params.toString();

    try {
      const response = await axios.get(`${API_BASE_URL}/api/documents?${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocuments(response.data.items);
      setTotalPages(response.data.pages);
    } catch (err) {
      console.error(`Failed to fetch ${documentType} documents:`, err);
      setError(`Failed to fetch documents. ${err.response?.data?.detail || ''}`);
    } finally {
      setLoading(false);
    }
  }, [token, documentType, page, perPage, debouncedSearchTerm, startDate, endDate]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Set up polling for status updates
  useEffect(() => {
    // Check if there are any documents currently being processed
    const isProcessing = documents.some(doc => ['PENDING', 'INDEXING'].includes(doc.status));

    // If no documents are processing, we don't need to poll
    if (!isProcessing) {
      return;
    }

    // Set up an interval to poll for updates
    const intervalId = setInterval(() => {
      fetchDocuments();
    }, 5000); // Poll every 5 seconds

    // Clean up the interval when the component unmounts or dependencies change
    return () => clearInterval(intervalId);
  }, [documents, fetchDocuments]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, startDate, endDate, documentType]);


  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    if (!token) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchDocuments(); // Refresh the list
    } catch (err) {
      console.error("Failed to delete document:", err.response ? err.response.data : err);
      setError(`Failed to delete document: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-4 mt-6 flex flex-col h-96">
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
      
      {/* Search and Filter Controls */}
      <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="md:col-span-2">
            <label htmlFor={`search-${tableId}`} className="sr-only">Search by filename</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    id={`search-${tableId}`}
                    placeholder="Search by filename..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
            </div>
        </div>
        <div>
            <label htmlFor={`start_date-${tableId}`} className="sr-only">Start Date</label>
            <input
                type="date"
                id={`start_date-${tableId}`}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
        </div>
        <div>
            <label htmlFor={`end_date-${tableId}`} className="sr-only">End Date</label>
            <input
                type="date"
                id={`end_date-${tableId}`}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
        </div>
        <button onClick={handleClearFilters} className="text-sm text-gray-600 hover:text-gray-900 md:col-start-4">Clear Filters</button>
      </div>

      {/* Table */}
      <div className="flex-grow overflow-y-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Filename</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Upload Date</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Indexing Status</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
                <tr><td colSpan="4" className="text-center py-4">Loading...</td></tr>
            ) : documents.length === 0 ? (
              <tr><td colSpan="4" className="text-center py-4 text-gray-500">No documents found.</td></tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="py-2 px-4 text-sm text-gray-800">{doc.filename}</td>
                  <td className="py-2 px-4 text-sm text-gray-800">{format(new Date(doc.upload_date), 'yyyy-MM-dd HH:mm')}</td>
                  <td className="py-2 px-4 text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      doc.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      doc.status === 'INDEXING' ? 'bg-yellow-100 text-yellow-800' :
                      doc.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-sm">
                    <button onClick={() => handleDeleteDocument(doc.id)} className="text-red-600 hover:text-red-900"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex-shrink-0 flex items-center justify-between mt-4">
        <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
        <div className="flex items-center space-x-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"><ChevronsLeft size={16}/></button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"><ChevronLeft size={16}/></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"><ChevronRight size={16}/></button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"><ChevronsRight size={16}/></button>
        </div>
      </div>
    </div>
  );
}

export default DocumentTable;
