import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    Upload,
    Play,
    FileText,
    List,
    RefreshCw,
    Download,
    BookOpen,
    ArrowRight,
    Loader,
    Trash,
    XCircle
} from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';

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
            setJobs(prevJobs => prevJobs.map(job => (job.id === jobId ? data : job)));
        } catch (err) {
            setError(err.message);
            console.error(`Error fetching details for job ${jobId}:`, err);
        }
    }, [token, API_BASE_URL]);

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
        if (!token) {
            setError("You must be logged in to start a transcription.");
            return;
        }

        setIsTranscribing(true);
        setError(null);
        const formData = new FormData();
        formData.append('file', selectedFile);

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

        } catch (err) {
            setError(err.message);
            console.error("Error starting transcription:", err);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleGenerateMinutes = async () => {
        if (!currentJobDetails || currentJobDetails.status !== 'COMPLETED') {
            setError("Minutes can only be generated for completed jobs.");
            return;
        }
        if (!token) return;

        setIsGeneratingMinutes(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/generate-minutes/${currentJobDetails.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || `Failed to generate minutes: ${response.statusText}`);
            }

            setCurrentJobDetails(prevDetails => ({
                ...prevDetails,
                status: 'PROCESSING',
                progress_text: 'Minutes generation started...'
            }));

        } catch (err) {
            setError(err.message);
            console.error("Error generating minutes:", err);
        } finally {
            setIsGeneratingMinutes(false);
        }
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
    
    const handleReplaceSpeakers = () => {
        if (!findSpeaker || !editedTranscript) {
            alert("Please enter text to find and ensure there is a transcript to edit.");
            return;
        }
        const regex = new RegExp(findSpeaker, 'g');
        const newTranscript = editedTranscript.replace(regex, replaceSpeaker);
        setEditedTranscript(newTranscript);
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
                    <button
                        onClick={handleStartTranscription}
                        disabled={!selectedFile || isUploadDisabled}
                        className={`
                            px-4 py-2 rounded-md font-semibold flex items-center transition-colors duration-200
                            ${(!selectedFile || isUploadDisabled) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}
                        `}
                    >
                        {isTranscribing ? <Loader size={18} className="animate-spin mr-2" /> : <Play size={18} className="mr-2" />}
                        Start Transcription
                    </button>
                </div>
            </div>

            <div className="flex space-x-6 mb-6"> {/* This is the top row containing Jobs and Transcription */}
                {/* Left Panel: Transcription Tasks */}
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
                                        <p className="font-medium text-gray-800 truncate">{job.original_filename}</p>
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

                {/* Right Panel: Transcription */}
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
                    {currentJobDetails?.full_transcript && (
                        <button
                            onClick={() => downloadText(currentJobDetails.full_transcript, `transcript_${currentJobDetails.id}.txt`)}
                            className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center justify-center w-fit self-end transition-colors duration-200 shrink-0"
                        >
                            <Download size={18} className="mr-2" /> Download Transcript
                        </button>
                    )}
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
                    <button
                        onClick={handleGenerateMinutes}
                        disabled={currentJobDetails?.status !== 'COMPLETED' || isGeneratingMinutes || currentJobDetails?.meeting_minutes}
                        className={`
                            px-4 py-2 rounded-md font-semibold flex items-center transition-colors duration-200
                            ${(!currentJobDetails || currentJobDetails.status !== 'COMPLETED' || isGeneratingMinutes || currentJobDetails.meeting_minutes) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}
                        `}
                    >
                        {isGeneratingMinutes ? <Loader size={18} className="animate-spin mr-2" /> : <ArrowRight size={18} className="mr-2" />}
                        Generate Minutes
                    </button>
                    {currentJobDetails?.meeting_minutes && (
                        <button
                            onClick={() => downloadText(currentJobDetails.meeting_minutes, `minutes_${currentJobDetails.id}.txt`)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center justify-center transition-colors duration-200"
                        >
                            <Download size={18} className="mr-2" /> Download Minutes
                        </button>
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
        </div>
    );
}

export default Transcribe;