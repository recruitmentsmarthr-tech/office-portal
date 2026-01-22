import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext'; // Corrected import
import {
    Upload,
    Play,
    FileText,
    List,
    RefreshCw,
    Download,
    BookOpen,
    ArrowRight,
    Loader
} from 'lucide-react'; // Example icons, adjust as needed

import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import remarkGfm from 'remark-gfm'; // Import GFM plugin

function Transcribe() {
    const { user, token } = useAuth(); // Get user and token from auth context/hook
    const [selectedFile, setSelectedFile] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [activeJobId, setActiveJobId] = useState(null); // ID of the job currently displayed in the right panel
    const [currentJobDetails, setCurrentJobDetails] = useState(null); // Full details of the activeJobId
    const [isLoading, setIsLoading] = useState(false); // For general loading states like initial fetches
    const [error, setError] = useState(null);
    const [isGeneratingMinutes, setIsGeneratingMinutes] = useState(false); // For minutes generation specific loading

    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

    // Fetch details for a specific job (memoized)
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
            // Update the jobs list with the latest status of this job
            setJobs(prevJobs => prevJobs.map(job => (job.id === jobId ? data : job)));
        } catch (err) {
            setError(err.message);
            console.error(`Error fetching details for job ${jobId}:`, err);
        }
    }, [token, API_BASE_URL]);

    // Fetch all jobs for the current user (memoized)
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
                // If there's an in-progress job, ensure it's the activeJobId
                setActiveJobId(inProgressJob.id);
            } else if (!activeJobId && data.length > 0) {
                // If no job is in progress AND no job is currently selected (e.g., on first load or after all jobs complete),
                // then select the latest job (which should be completed or failed).
                setActiveJobId(data[0].id);
            } else if (activeJobId && !data.some(job => job.id === activeJobId)) {
                // If the previously activeJobId is no longer in the list (e.g., deleted)
                // or if it refers to a job that's not the latest.
                // Re-select latest if current active is gone.
                setActiveJobId(data.length > 0 ? data[0].id : null);
            }
            // If activeJobId refers to a completed/failed job that is still in the list, keep it selected.
            // This ensures the user continues to see the results of their last selected job.

        } catch (err) {
            setError(err.message);
            console.error("Error fetching jobs:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token, API_BASE_URL, activeJobId]); // activeJobId needs to be a dependency if its state is used to determine selection logic

    // Effect for initial fetch of all jobs and periodic refresh
    useEffect(() => {
        fetchJobs(); // Initial fetch
        const intervalId = setInterval(fetchJobs, 5000); // Poll every 5 seconds
        return () => clearInterval(intervalId);
    }, [fetchJobs]);

    // Effect to fetch details for the currently active job whenever activeJobId changes
    useEffect(() => {
        if (activeJobId) {
            // Set loading state for details fetch
            setIsLoading(true);
            fetchJobDetails(activeJobId).finally(() => setIsLoading(false));
        } else {
            setCurrentJobDetails(null); // Clear details if no job is active
        }
    }, [activeJobId, fetchJobDetails]);

    // Effect for polling the details of the currently selected job IF it's in progress
    useEffect(() => {
        let detailsPollingInterval;
        if (currentJobDetails && (currentJobDetails.status === 'PENDING' || currentJobDetails.status === 'PROCESSING')) {
            detailsPollingInterval = setInterval(() => {
                fetchJobDetails(currentJobDetails.id);
            }, 5000); // Poll every 5 seconds for details of an active job
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

        setIsLoading(true);
        setError(null);
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // 'Content-Type': 'multipart/form-data' is NOT needed with FormData, browser sets it
                },
                body: formData
            });

            if (response.status === 409) { // Conflict - job already running
                const errData = await response.json();
                setError(errData.detail);
            } else if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || `Failed to start transcription: ${response.statusText}`);
            }

            const newJob = await response.json();
            setJobs(prevJobs => [newJob, ...prevJobs]);
            setActiveJobId(newJob.id);
            setCurrentJobDetails(newJob); // Set details for the newly created job
            setSelectedFile(null); // Clear selected file
            fetchJobs(); // Re-fetch all jobs to update list and ensure consistency

        } catch (err) {
            setError(err.message);
            console.error("Error starting transcription:", err);
        } finally {
            setIsLoading(false);
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

            // Minutes generation is async, so the job status needs to be polled
            // The API response for starting minutes generation is just a confirmation
            // We should immediately update the local job status to reflect this
            setCurrentJobDetails(prevDetails => ({
                ...prevDetails,
                status: 'PROCESSING', // Assuming backend sets it to PROCESSING or a similar state
                progress_text: 'Minutes generation started...'
            }));
            // The polling useEffect for currentJobDetails will now pick this up
            // No need to force re-fetch here if polling is active
            // fetchJobDetails(currentJobDetails.id); 

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

    // Corrected logic for isUploadDisabled
    const hasActiveJob = jobs.some(job => job.status === 'PENDING' || job.status === 'PROCESSING');
    const isUploadDisabled = isLoading || hasActiveJob; // Disable upload if busy or any job is active
    return (
        <div className="flex flex-col h-full">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Audio Transcription & Minutes</h1>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <strong className="font-bold">Error! </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            {/* Top Controls */}
            <div className="bg-white shadow-md rounded-lg p-6 mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <label htmlFor="audioUpload" className={`
                        px-4 py-2 border rounded-md cursor-pointer
                        ${isUploadDisabled ? 'bg-gray-200 text-gray-500' : 'bg-blue-500 text-white hover:bg-blue-600'}
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
                            px-4 py-2 rounded-md font-semibold flex items-center
                            ${(!selectedFile || isUploadDisabled) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600'}
                        `}
                    >
                        {isLoading && !activeJobId ? <Loader size={18} className="animate-spin mr-2" /> : <Play size={18} className="mr-2" />}
                        Start Transcription
                    </button>
                </div>
                {activeJobId && (
                    <div className="text-sm text-gray-600">
                        <p>Active Job: <strong>{activeJobId}</strong></p>
                        <p>Status: <span className="font-semibold">{currentJobDetails?.status || 'N/A'}</span></p>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 space-x-6">
                {/* Left Panel: Job List */}
                <div className="w-1/4 bg-white shadow-md rounded-lg p-4 flex flex-col overflow-hidden">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                        <List size={20} className="mr-2" /> My Transcription Jobs
                    </h2>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {isLoading && jobs.length === 0 ? (
                            <p className="text-gray-500 text-center flex items-center justify-center">
                                <Loader size={18} className="animate-spin mr-2" /> Loading jobs...
                            </p>
                        ) : jobs.length === 0 ? (
                            <p className="text-gray-500 text-center">No jobs yet. Upload an audio file to start!</p>
                        ) : (
                            jobs.map(job => (
                                <div
                                    key={job.id}
                                    className={`
                                        p-3 rounded-md cursor-pointer border
                                        ${job.id === activeJobId ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}
                                    `}
                                    onClick={() => setActiveJobId(job.id)}
                                >
                                    <p className="font-medium text-gray-800 truncate">{job.original_filename}</p>
                                    <p className={`text-sm ${job.status === 'COMPLETED' ? 'text-green-600' : job.status === 'FAILED' ? 'text-red-600' : 'text-blue-500'}`}>
                                        Status: {job.status} ({job.progress_percent}%)
                                    </p>
                                    <p className="text-xs text-gray-500">Created: {new Date(job.created_at).toLocaleString()}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Panel: Job Details (Transcription & Minutes) */}
                <div className="w-3/4 flex flex-col space-y-6">
                    {currentJobDetails ? (
                        <>
                            {/* Transcription View */}
                            <div className="bg-white shadow-md rounded-lg p-6 flex-1 flex flex-col">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                                    <FileText size={20} className="mr-2" /> Transcription
                                    {currentJobDetails.status === 'PROCESSING' && (
                                        <span className="ml-3 text-blue-500 flex items-center text-sm">
                                            <Loader size={16} className="animate-spin mr-1" />
                                            {currentJobDetails.progress_text} ({currentJobDetails.progress_percent}%)
                                        </span>
                                    )}
                                </h2>
                                <div className="flex-1 bg-gray-50 p-4 rounded-md overflow-y-auto text-gray-800 text-sm font-mono whitespace-pre-wrap">
                                    {currentJobDetails.full_transcript || 'Transcription will appear here...'}
                                </div>
                                {currentJobDetails.full_transcript && (
                                    <button
                                        onClick={() => downloadText(currentJobDetails.full_transcript, `transcript_${currentJobDetails.id}.txt`)}
                                        className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center justify-center w-fit self-end"
                                    >
                                        <Download size={18} className="mr-2" /> Download Transcript
                                    </button>
                                )}
                            </div>

                            {/* Minutes View */}
                            <div className="bg-white shadow-md rounded-lg p-6 flex-1 flex flex-col">
                                <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                                    <BookOpen size={20} className="mr-2" /> Meeting Minutes
                                    {isGeneratingMinutes && (
                                        <span className="ml-3 text-blue-500 flex items-center text-sm">
                                            <Loader size={16} className="animate-spin mr-1" />
                                            Generating minutes...
                                        </span>
                                    )}
                                </h2>
                                <div className="flex-1 bg-gray-50 p-4 rounded-md overflow-y-auto prose max-w-none">
                                    {currentJobDetails.meeting_minutes ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {currentJobDetails.meeting_minutes}
                                        </ReactMarkdown>
                                    ) : (
                                        <em>The summary will generate here...</em>
                                    )}
                                </div>
                                <div className="mt-4 flex justify-end space-x-4">
                                    <button
                                        onClick={handleGenerateMinutes}
                                        disabled={currentJobDetails.status !== 'COMPLETED' || isGeneratingMinutes || currentJobDetails.meeting_minutes}
                                        className={`
                                            px-4 py-2 rounded-md font-semibold flex items-center
                                            ${(currentJobDetails.status !== 'COMPLETED' || isGeneratingMinutes || currentJobDetails.meeting_minutes) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}
                                        `}
                                    >
                                        {isGeneratingMinutes ? <Loader size={18} className="animate-spin mr-2" /> : <ArrowRight size={18} className="mr-2" />}
                                        Generate Minutes
                                    </button>
                                    {currentJobDetails.meeting_minutes && (
                                        <button
                                            onClick={() => downloadText(currentJobDetails.meeting_minutes, `minutes_${currentJobDetails.id}.txt`)}
                                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center justify-center"
                                        >
                                            <Download size={18} className="mr-2" /> Download Minutes
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="bg-white shadow-md rounded-lg p-6 flex-1 flex items-center justify-center text-gray-500 text-lg">
                            Select a job from the left or start a new transcription.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Transcribe;
