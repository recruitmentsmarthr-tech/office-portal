import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Trash, Loader, FileText } from 'lucide-react';
import ConfirmationDialog from '../common/ConfirmationDialog';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function ManageIngestedMeetings() {
    const { user, token } = useAuth();
    const [ingestedDocuments, setIngestedDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [docToDeleteId, setDocToDeleteId] = useState(null);
    const [docToDeleteName, setDocToDeleteName] = useState('');

    const fetchIngestedDocuments = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            // Fetch only documents belonging to the 'meetings' collection
            const response = await axios.get(`${API_BASE_URL}/api/documents?collection=meetings`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setIngestedDocuments(response.data);
        } catch (err) {
            console.error("Error fetching ingested documents:", err);
            setError(err.message || "Failed to fetch ingested documents.");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        // Only fetch if user is admin
        if (user && user.role === 'admin') {
            fetchIngestedDocuments();
        } else if (!user || user.role !== 'admin') {
            setError("You do not have permission to view this page.");
            setLoading(false);
        }
    }, [fetchIngestedDocuments, user]);

    const handleDeleteClick = (docId, docName) => {
        setDocToDeleteId(docId);
        setDocToDeleteName(docName);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!token || !docToDeleteId) return;

        setError(null);
        try {
            await axios.delete(`${API_BASE_URL}/api/documents/${docToDeleteId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            // Refresh the list after successful deletion
            fetchIngestedDocuments();
            setShowDeleteConfirm(false);
            setDocToDeleteId(null);
            setDocToDeleteName('');
        } catch (err) {
            console.error("Error deleting document:", err);
            setError(err.message || "Failed to delete document.");
            setShowDeleteConfirm(false);
            setDocToDeleteId(null);
            setDocToDeleteName('');
        }
    };

    const handleCloseDeleteConfirm = () => {
        setShowDeleteConfirm(false);
        setDocToDeleteId(null);
        setDocToDeleteName('');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader className="animate-spin text-blue-500" size={30} />
                <p className="ml-3 text-gray-700">Loading ingested meeting documents...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-600 p-6">
                <p className="font-bold">Error:</p>
                <p>{error}</p>
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return (
            <div className="text-red-600 p-6">
                <p className="font-bold">Access Denied:</p>
                <p>You do not have the necessary permissions to view this page.</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                <FileText size={28} className="mr-3" /> Manage Ingested Meeting Documents
            </h1>

            {ingestedDocuments.length === 0 ? (
                <p className="text-gray-600">No meeting documents have been ingested yet.</p>
            ) : (
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Document Name
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Type
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Date Ingested
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Job ID
                                </th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">Delete</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {ingestedDocuments.map((doc) => (
                                <tr key={doc.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {doc.filename}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {doc.document_type ? doc.document_type.replace(/_/g, ' ') : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            doc.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                            doc.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                            doc.status === 'INDEXING' ? 'bg-blue-100 text-blue-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {doc.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(doc.upload_date).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {doc.source_transcription_id || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleDeleteClick(doc.id, doc.filename)}
                                            className="text-red-600 hover:text-red-900 ml-4 p-1 rounded-full hover:bg-red-50"
                                            title="Delete Document"
                                        >
                                            <Trash size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmationDialog
                isOpen={showDeleteConfirm}
                onClose={handleCloseDeleteConfirm}
                onConfirm={handleConfirmDelete}
                title="Confirm Document Deletion"
                confirmationText={docToDeleteName ? `delete document "${docToDeleteName}"` : ''}
            >
                <p>Are you sure you want to delete the ingested document <strong>{docToDeleteName}</strong>?</p>
                <p className="text-sm text-gray-500">This will remove it from the RAG chat knowledge base. This action cannot be undone.</p>
            </ConfirmationDialog>
        </div>
    );
}

export default ManageIngestedMeetings;
