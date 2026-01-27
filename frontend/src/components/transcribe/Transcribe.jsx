import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    Upload,
    Play,
    FileText,
    List,
    Save,
    Download,
    BookOpen,
    ArrowRight,
    Loader,
    Trash,
    XCircle
} from 'lucide-react';
import axios from 'axios'; // Add axios import

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import Modal from '../../components/common/Modal';

function Transcribe() {
    const { user, token } = useAuth();
    const [selectedFile, setSelectedFile] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [activeJobId, setActiveJobId] = useState(null);
    const [currentJobDetails, setCurrentJobDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState(null);
    const [isGeneratingMinutes, setIsGeneratingMinutes] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editedTranscript, setEditedTranscript] = useState('');
    const [findSpeaker, setFindSpeaker] = useState('');
    const [replaceSpeaker, setReplaceSpeaker] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [jobToDeleteId, setJobToDeleteId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [newMeetingName, setNewMeetingName] = useState(''); // State for the new meeting name
    const [ingestionStatus, setIngestionStatus] = useState({ full_transcript: null, meeting_minutes: null });
    const [loadingIngestionStatus, setLoadingIngestionStatus] = useState(false);

    const [showMinutesModal, setShowMinutesModal] = useState(false);
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
    const [meetingName, setMeetingName] = useState('');
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
    const [meetingTime, setMeetingTime] = useState('');
    const [selectedTone, setSelectedTone] = useState('CEO');

    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

    const fetchJobDetails = useCallback(async (jobId) => {
        if (!token || !jobId) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/transcribe/status/${jobId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch job details: ${response.statusText}`);
            }
            const data = await response.json();
            setCurrentJobDetails(data);
            setEditedTranscript(data.full_transcript || '');
            setMeetingName(data.meeting_name || ''); // Set meeting name from fetched data
            setJobs(prevJobs => prevJobs.map(job => (job.id === jobId ? data : job)));

            // Fetch ingestion status for admin users
            if (user && user.role === 'admin') {
                setLoadingIngestionStatus(true);
                try {
                    const ingestionResponse = await axios.get(`${API_BASE_URL}/api/transcriptions/${jobId}/ingestion-status`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    setIngestionStatus(ingestionResponse.data);
                } catch (ingestionErr) {
                    console.error("Error fetching ingestion status (this is expected during initiation):", ingestionErr);
                    // Do not reset status on poll failure. A failed poll can be a transient issue,
                    // especially when ingestion is just starting. Let the optimistic 'PROCESSING' state persist
                    // until the next successful poll.
                } finally {
                    setLoadingIngestionStatus(false);
                }
            } else {
                setIngestionStatus({ full_transcript: null, meeting_minutes: null }); // Clear if not admin
            }
        } catch (err) {
            setError(err.message);
            console.error(`Error fetching details for job ${jobId}:`, err);
        }
    }, [token, API_BASE_URL, user]);

    const fetchJobs = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/api/transcribe/jobs`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch jobs: ${response.statusText}`);
            }
            const data = await response.json();
            setJobs(data);

            const inProgressJob = data.find(
                job => job.status === 'PENDING' || job.status === 'PROCESSING'
            );

            if (inProgressJob) {
                setActiveJobId(inProgressJob.id);
            } else if (!activeJobId && data.length > 0) {
                setActiveJobId(data[0].id);
            } else if (activeJobId && !data.some(job => job.id === activeJobId)) {
                setActiveJobId(data.length > 0 ? data[0].id : null);
            }

        } catch (err) {
            setError(err.message);
            console.error("Error fetching jobs:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, API_BASE_URL, activeJobId]);

    useEffect(() => {
        fetchJobs();
        const intervalId = setInterval(fetchJobs, 5000);
        return () => clearInterval(intervalId);
    }, [fetchJobs]);

    useEffect(() => {
        if (activeJobId) {
            setIsLoading(true);
            fetchJobDetails(activeJobId).finally(() => setIsLoading(false));
        } else {
            setCurrentJobDetails(null);
            setEditedTranscript('');
        }
    }, [activeJobId, fetchJobDetails]);

    useEffect(() => {
        let detailsPollingInterval;
        if (currentJobDetails && (currentJobDetails.status === 'PENDING' || currentJobDetails.status === 'PROCESSING')) {
            detailsPollingInterval = setInterval(() => {
                fetchJobDetails(currentJobDetails.id);
            }, 5000);
        }
        return () => {
            if (detailsPollingInterval) clearInterval(detailsPollingInterval);
        };
    }, [currentJobDetails?.id, currentJobDetails?.status, fetchJobDetails]);

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    const handleStartTranscription = async () => {
        if (!selectedFile) {
            setError("Please select an audio file to transcribe.");
            return;
        }
        if (!newMeetingName) {
            setError("Please enter a name for the meeting.");
            return;
        }
        if (!token) {
            setError("You must be logged in to start a transcription.");
            return;
        }

        setIsTranscribing(true);
        setError(null);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('meeting_name', newMeetingName);

        try {
            const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.status === 409) {
                const errData = await response.json();
                setError(errData.detail);
            } else if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || `Failed to start transcription: ${response.statusText}`);
            }

            const newJob = await response.json();
            setJobs(prevJobs => [newJob, ...prevJobs]);
            setActiveJobId(newJob.id);
            setCurrentJobDetails(newJob);
            setSelectedFile(null);
            setNewMeetingName(''); // Clear the input after successful start

        } catch (err) {
            setError(err.message);
            console.error("Error starting transcription:", err);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleGenerateMinutes = async () => {
        if (!currentJobDetails || !['COMPLETED', 'FAILED'].includes(currentJobDetails.status)) {
            setError("Minutes can only be generated for completed or failed jobs.");
            return;
        }
        if (!token) return;

        setIsGeneratingMinutes(true);
        setError(null);
        setShowMinutesModal(false);

        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/transcriptions/${currentJobDetails.id}/generate-minutes`,
                {
                    meeting_name: meetingName,
                    meeting_date: meetingDate,
                    meeting_time: meetingTime,
                    tone: selectedTone
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // No need for !response.ok check as axios throws for non-2xx status codes
            setCurrentJobDetails(prevDetails => ({
                ...prevDetails,
                status: 'PROCESSING',
                progress_text: 'Minutes generation started...'
            }));

        } catch (err) {
            setError(err.response?.data?.detail || err.message);
            console.error("Error generating minutes:", err);
        } finally {
            setIsGeneratingMinutes(false);
        }
    };

    const handleIngestDocument = async (documentType) => {
        if (!currentJobDetails || !token) return;
        if (!user || user.role !== 'admin') {
            setError("Not authorized to ingest documents.");
            return;
        }
        setError(null);

        // Optimistically set to PROCESSING. This will immediately disable the button.
        setIngestionStatus(prev => ({
            ...prev,
            [documentType]: 'PROCESSING'
        }));

        try {
            await axios.post(
                `${API_BASE_URL}/api/transcriptions/${currentJobDetails.id}/ingest`,
                { document_type: documentType },
                { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }}
            );

            // After successfully starting, schedule a poll to check the status.
            // This avoids the main polling loop dependency and ensures we get an update.
            setTimeout(() => {
                fetchJobDetails(currentJobDetails.id);
            }, 2000); // 2 second delay to give backend time to update its status

        } catch (err) {
            setError(err.response?.data?.detail || err.message);
            console.error(`Error ingesting ${documentType}:`, err);
            // If the initial POST fails, revert the optimistic status.
            setIngestionStatus(prev => ({
                ...prev,
                [documentType]: null
            }));
        }
    };

    const handleOpenGenerateMinutesModal = () => {
        if (!currentJobDetails || !['COMPLETED', 'FAILED'].includes(currentJobDetails.status)) {
            setError("Minutes can only be generated for completed or failed jobs.");
            return;
        }
        if (currentJobDetails.meeting_minutes) {
            setShowRegenerateConfirm(true);
        } else {
            setShowMinutesModal(true);
        }
    };

    const handleConfirmRegenerate = () => {
        setShowRegenerateConfirm(false);
        setShowMinutesModal(true);
    };

    const handleCloseRegenerateConfirm = () => {
        setShowRegenerateConfirm(false);
    };

    const handleCloseMinutesModal = () => {
        setShowMinutesModal(false);
    };

    const downloadText = (content, filename) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadMinutesDocx = async (jobId, filename) => {
        if (!token || !jobId) {
            setError("Authentication token or Job ID missing for download.");
            return;
        }
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/transcribe/jobs/${jobId}/download/docx`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob', // Important for downloading files
                }
            );

            // Extract filename from Content-Disposition header if available, otherwise use default
            const contentDisposition = response.headers['content-disposition'];
            let actualFilename = filename;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch && filenameMatch[1]) {
                    actualFilename = filenameMatch[1];
                }
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', actualFilename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error downloading DOCX minutes:", err);
            setError("Failed to download meeting minutes as DOCX.");
        }
    };
    
    const handleReplaceSpeakers = () => {
        if (!findSpeaker || !editedTranscript) {
            alert("Please enter text to find and ensure there is a transcript to edit.");
            return;
        }
        const regex = new RegExp(findSpeaker, 'g');
        const newTranscript = editedTranscript.replace(regex, replaceSpeaker);
        setEditedTranscript(newTranscript);
    };

    const handleSaveTranscript = async () => {
        if (!currentJobDetails || !token) return;
        setIsSaving(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/transcribe/jobs/${currentJobDetails.id}/transcript`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ new_transcript: editedTranscript })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Failed to save transcript.");
            }
            fetchJobDetails(currentJobDetails.id);
        } catch(err) {
            setError(err.message);
            console.error("Error saving transcript:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (jobId) => {
        setJobToDeleteId(jobId);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!token || !jobToDeleteId) return;

        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/api/transcribe/jobs/${jobToDeleteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || `Failed to delete job: ${response.statusText}`);
            }

            setJobs(prevJobs => prevJobs.filter(job => job.id !== jobToDeleteId));
            if (activeJobId === jobToDeleteId) {
                setActiveJobId(null);
                setCurrentJobDetails(null);
                setEditedTranscript('');
            }
            setShowDeleteConfirm(false);
            setJobToDeleteId(null);

        } catch (err) {
            setError(err.message);
            console.error("Error deleting job:", err);
            setShowDeleteConfirm(false);
            setJobToDeleteId(null);
        }
    };

    const handleCloseDeleteConfirm = () => {
        setShowDeleteConfirm(false);
        setJobToDeleteId(null);
    };

    const handleCancelJob = async (jobId) => {
        if (!token) return;
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/api/transcribe/jobs/${jobId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || `Failed to cancel job: ${response.statusText}`);
            }

            const cancelledJob = await response.json();
            setJobs(prevJobs => prevJobs.map(job => (job.id === jobId ? cancelledJob : job)));
            if (activeJobId === jobId) {
                setCurrentJobDetails(cancelledJob);
            }

        } catch (err) {
            setError(err.message);
            console.error("Error canceling job:", err);
        }
    };

    const hasActiveJob = jobs.some(job => job.status === 'PENDING' || job.status === 'PROCESSING');
    const isUploadDisabled = isTranscribing || hasActiveJob;
    
    const filteredJobs = jobs.filter(job =>
        job.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.status.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const canGenerateMinutes = currentJobDetails && ['COMPLETED', 'FAILED'].includes(currentJobDetails.status);

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Audio Transcription & Minutes</h1>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <strong className="font-bold">Error! </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            <div className="bg-white shadow-md rounded-lg p-6 mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <label htmlFor="audioUpload" className={`
                        px-4 py-2 border rounded-md cursor-pointer transition-colors duration-200
                        ${isUploadDisabled ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}
                    `}>
                        <Upload size={18} className="inline-block mr-2" />
                        {selectedFile ? selectedFile.name : 'Choose Audio File'}
                    </label>
                    <input
                        id="audioUpload"
                        type="file"
                        accept="audio/*"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={isUploadDisabled}
                    />
                    <input
                        type="text"
                        placeholder="Enter Meeting Name..."
                        value={newMeetingName}
                        onChange={(e) => setNewMeetingName(e.target.value)}
                        className={`
                            p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                            ${isUploadDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}
                        `}
                        disabled={isUploadDisabled}
                    />
                    <button
                        onClick={handleStartTranscription}
                        disabled={!selectedFile || !newMeetingName || isUploadDisabled}
                        className={`
                            px-4 py-2 rounded-md font-semibold flex items-center transition-colors duration-200
                            ${(!selectedFile || !newMeetingName || isUploadDisabled) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}
                        `}
                    >
                        {isTranscribing ? <Loader size={18} className="animate-spin mr-2" /> : <Play size={18} className="mr-2" />}
                        Start Transcription
                    </button>
                </div>
            </div>

            <div className="flex space-x-6 mb-6">
                <div className="w-1/3 bg-white shadow-md rounded-lg p-4 flex flex-col h-[500px] overflow-hidden flex-shrink-0">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center shrink-0">
                        <List size={20} className="mr-2" /> My Transcription Jobs
                    </h2>
                    <input
                        type="text"
                        placeholder="Search jobs..."
                        className="mb-4 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {isLoading && jobs.length === 0 ? (
                            <p className="text-gray-500 text-center flex items-center justify-center">
                                <Loader size={18} className="animate-spin mr-2" /> Loading jobs...
                            </p>
                        ) : filteredJobs.length === 0 ? (
                            <p className="text-gray-500 text-center">No matching jobs found.</p>
                        ) : (
                            filteredJobs.map(job => (
                                <div
                                    key={job.id}
                                    className={`
                                        p-3 rounded-md cursor-pointer border flex justify-between items-center transition-all duration-150 ease-in-out
                                        ${job.id === activeJobId ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}
                                    `}
                                    onClick={() => setActiveJobId(job.id)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-800 truncate">{job.meeting_name || job.original_filename}</p>
                                        <p className={`text-sm ${job.status === 'COMPLETED' ? 'text-green-600' : job.status === 'FAILED' ? 'text-red-600' : job.status === 'CANCELLED' ? 'text-orange-500' : 'text-blue-500'}`}>
                                            Status: {job.status} {job.status === 'PROCESSING' && `(${job.progress_percent}%)`}
                                        </p>
                                        {job.error_message && job.status === 'FAILED' && (
                                            <p className="text-xs text-red-500 italic mt-1 truncate">Error: {job.error_message}</p>
                                        )}
                                        <p className="text-xs text-gray-500">Created: {new Date(job.created_at).toLocaleString()}</p>
                                    </div>
                                    <div className="flex space-x-2 ml-4">
                                        {(job.status === 'PENDING' || job.status === 'PROCESSING') && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCancelJob(job.id); }}
                                                className="p-1 rounded-full text-orange-500 hover:bg-orange-100 transition-colors duration-200"
                                                title="Cancel Job"
                                            >
                                                <XCircle size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(job.id); }}
                                            className="p-1 rounded-full text-red-500 hover:bg-red-100 transition-colors duration-200"
                                            title="Delete Job"
                                        >
                                            <Trash size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="w-2/3 bg-white shadow-md rounded-lg p-4 flex flex-col h-[500px] overflow-hidden flex-shrink-0">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center shrink-0">
                        <FileText size={20} className="mr-2" /> Transcription
                        {currentJobDetails?.status === 'PROCESSING' && (
                            <span className="ml-3 text-blue-500 flex items-center text-sm">
                                <Loader size={16} className="animate-spin mr-1" />
                                {currentJobDetails.progress_text} ({currentJobDetails.progress_percent}%)
                            </span>
                        )}
                    </h2>
                    <div className="mb-4 p-2 bg-gray-50 rounded-md border border-gray-200 shrink-0">
                        <p className="text-sm font-medium text-gray-700 mb-2">Replace Speakers:</p>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                placeholder="Find Speaker (e.g., Speaker 1)"
                                className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                value={findSpeaker}
                                onChange={(e) => setFindSpeaker(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Replace with (e.g., John Doe)"
                                className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                value={replaceSpeaker}
                                onChange={(e) => setReplaceSpeaker(e.target.value)}
                            />
                            <button
                                onClick={handleReplaceSpeakers}
                                className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 transition-colors duration-200"
                            >
                                Replace
                            </button>
                        </div>
                    </div>
                    <div className="relative flex-1">
                        <textarea
                            className="absolute inset-0 w-full h-full overflow-y-auto border border-gray-200 bg-gray-50 p-4 rounded-md text-gray-800 text-sm font-mono whitespace-pre-wrap resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={editedTranscript}
                            onChange={(e) => setEditedTranscript(e.target.value)}
                            readOnly={!currentJobDetails?.full_transcript}
                            placeholder="Transcription will appear here..."
                        >
                        </textarea>
                    </div>
                    <div className="mt-4 flex justify-end space-x-2 shrink-0">
                        {currentJobDetails?.full_transcript && (
                            <>
                                <button
                                    onClick={handleSaveTranscript}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center w-fit self-end transition-colors duration-200 disabled:bg-gray-400"
                                >
                                    {isSaving ? <Loader size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                                    Save Transcript
                                </button>
                                <button
                                    onClick={() => downloadText(editedTranscript, `transcript_${currentJobDetails.id}.txt`)}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center justify-center w-fit self-end transition-colors duration-200"
                                >
                                    <Download size={18} className="mr-2" /> Download Transcript
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Panel: Meeting Minutes */}
            <div className="mt-6 bg-white shadow-md rounded-lg p-4 h-[600px] flex flex-col overflow-hidden flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center shrink-0">
                    <BookOpen size={20} className="mr-2" /> Meeting Minutes
                    {isGeneratingMinutes && (
                        <span className="ml-3 text-blue-500 flex items-center text-sm">
                            <Loader size={16} className="animate-spin mr-1" />
                            Generating minutes...
                        </span>
                    )}
                </h2>
                <div className="flex-1 overflow-y-auto border border-gray-200 bg-gray-50 p-4 rounded-md prose max-w-none">
                    {currentJobDetails?.meeting_minutes ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {currentJobDetails.meeting_minutes}
                        </ReactMarkdown>
                    ) : (
                        <em>The summary will generate here...</em>
                    )}
                </div>
                <div className="mt-4 flex justify-end space-x-4 shrink-0">
                    {user && user.role === 'admin' && (
                        <>
                            {currentJobDetails?.full_transcript && (
                                <button
                                    onClick={() => handleIngestDocument('full_transcript')}
                                    disabled={
                                        loadingIngestionStatus ||
                                        ingestionStatus.full_transcript === 'COMPLETED' ||
                                        ingestionStatus.full_transcript === 'PROCESSING'
                                    }
                                    className={`
                                        px-4 py-2 rounded-md font-semibold flex items-center transition-colors duration-200
                                        ${
                                            (loadingIngestionStatus || ingestionStatus.full_transcript === 'COMPLETED' || ingestionStatus.full_transcript === 'PROCESSING')
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }
                                    `}
                                >
                                    {(ingestionStatus.full_transcript === 'PROCESSING' || loadingIngestionStatus) ? <Loader size={18} className="animate-spin mr-2" /> : <BookOpen size={18} className="mr-2" />}
                                    {ingestionStatus.full_transcript === 'COMPLETED' ? 'Ingested' : 'Ingest Raw Transcript'}
                                </button>
                            )}

                            <button
                                onClick={handleOpenGenerateMinutesModal}
                                disabled={!canGenerateMinutes || isGeneratingMinutes}
                                className={`
                                    px-4 py-2 rounded-md font-semibold flex items-center transition-colors duration-200
                                    ${(!canGenerateMinutes || isGeneratingMinutes) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}
                                `}
                            >
                                {isGeneratingMinutes ? <Loader size={18} className="animate-spin mr-2" /> : <ArrowRight size={18} className="mr-2" />}
                                {currentJobDetails?.meeting_minutes ? 'Regenerate Minutes' : 'Generate Minutes'}
                            </button>

                            {currentJobDetails?.meeting_minutes && (
                                <button
                                    onClick={() => handleIngestDocument('meeting_minutes')}
                                    disabled={
                                        loadingIngestionStatus ||
                                        ingestionStatus.meeting_minutes === 'COMPLETED' ||
                                        ingestionStatus.meeting_minutes === 'PROCESSING'
                                    }
                                    className={`
                                        px-4 py-2 rounded-md font-semibold flex items-center transition-colors duration-200
                                        ${
                                            (loadingIngestionStatus || ingestionStatus.meeting_minutes === 'COMPLETED' || ingestionStatus.meeting_minutes === 'PROCESSING')
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-green-600 text-white hover:bg-green-700'
                                        }
                                    `}
                                >
                                    {(ingestionStatus.meeting_minutes === 'PROCESSING' || loadingIngestionStatus) ? <Loader size={18} className="animate-spin mr-2" /> : <BookOpen size={18} className="mr-2" />}
                                    {ingestionStatus.meeting_minutes === 'COMPLETED' ? 'Ingested' : 'Ingest Meeting Minutes'}
                                </button>
                            )}

                            {currentJobDetails?.meeting_minutes && (
                                <button
                                    onClick={() => handleDownloadMinutesDocx(currentJobDetails.id, `minutes_${currentJobDetails.id}.docx`)}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center justify-center transition-colors duration-200"
                                >
                                    <Download size={18} className="mr-2" /> Download .docx
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <ConfirmationDialog
                isOpen={showDeleteConfirm}
                onClose={handleCloseDeleteConfirm}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
                confirmationText={jobToDeleteId ? `delete job ${jobToDeleteId}` : ''}
            >
                <p>Are you sure you want to delete transcription job <strong>{jobToDeleteId}</strong>?</p>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
            </ConfirmationDialog>

            <ConfirmationDialog
                isOpen={showRegenerateConfirm}
                onClose={handleCloseRegenerateConfirm}
                onConfirm={handleConfirmRegenerate}
                title="Confirm Regeneration"
                confirmationText="overwrite"
            >
                <p>Are you sure you want to regenerate the minutes? This will overwrite the existing content.</p>
            </ConfirmationDialog>

            <Modal isOpen={showMinutesModal} onClose={handleCloseMinutesModal} title="Generate Meeting Minutes">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="meetingName" className="block text-sm font-medium text-gray-700">Meeting Name</label>
                        <input
                            type="text"
                            id="meetingName"
                            value={meetingName}
                            onChange={(e) => setMeetingName(e.target.value)}
                            placeholder="e.g., Q4 Tech Strategy"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="meetingDate" className="block text-sm font-medium text-gray-700">Meeting Date</label>
                        <input
                            type="date"
                            id="meetingDate"
                            value={meetingDate}
                            onChange={(e) => setMeetingDate(e.g.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="meetingTime" className="block text-sm font-medium text-gray-700">Meeting Times</label>
                        <input
                            type="text"
                            id="meetingTime"
                            value={meetingTime}
                            onChange={(e) => setMeetingTime(e.target.value)}
                            placeholder="e.g., 9:00 AM - 10:30 AM"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="tone" className="block text-sm font-medium text-gray-700">Tone of Voice</label>
                        <select
                            id="tone"
                            value={selectedTone}
                            onChange={(e) => setSelectedTone(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                            <option value="CEO">CEO</option>
                            <option value="SHORT_TO_THE_POINT">Short to the Point</option>
                        </select>
                    </div>
                    <div className="flex justify-end space-x-4">
                        <button
                            onClick={handleCloseMinutesModal}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleGenerateMinutes}
                            disabled={isGeneratingMinutes}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                        >
                            {isGeneratingMinutes ? 'Generating...' : 'Confirm & Generate'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default Transcribe;