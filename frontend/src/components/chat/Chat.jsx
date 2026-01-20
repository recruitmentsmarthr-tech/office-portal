import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Send, Bot, Loader2, Plus, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';


const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const suggestions = [
  "Summarize the Q4 financial report",
  "What is the company's vacation policy?",
  "List all active marketing campaigns",
  "Who is the point of contact for HR issues?",
];

// --- Sub-components for a cleaner structure ---

const SuggestionChip = ({ text, onClick }) => (
  <button
    onClick={() => onClick(text)}
    className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200"
  >
    {text}
  </button>
);

const Message = ({ msg }) => {
  const isUser = msg.sender === 'user';
  return (
    <div className={`flex items-start gap-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Bot size={20} className="text-white" />
        </div>
      )}
      <div
        className={`prose prose-sm max-w-xl p-4 rounded-2xl shadow-md ${ 
          isUser
            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-none'
            : 'bg-white text-gray-800 rounded-bl-none'
        }`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
      </div>
    </div>
  );
};


function Chat({ currentSessionId, setCurrentSessionId, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);

  const [recentChats, setRecentChats] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState('');

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
    
  const fetchChatSessions = useCallback(async () => {
    if (!user) return; // Only fetch if user is logged in
    setLoadingSessions(true);
    setSessionsError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/chat/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecentChats(response.data);
    } catch (err) {
      console.error('Failed to fetch chat sessions:', err);
      setSessionsError('Failed to load chat sessions.');
    } finally {
      setLoadingSessions(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChatSessions();
  }, [fetchChatSessions]);


  const fetchChatHistory = useCallback(async (sessionId) => {
    if (!sessionId) {
        setMessages([{ text: 'Hello! How can I assist you with your documents today?', sender: 'ai' }]);
        return;
    }
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/chat/history/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(response.data.map(msg => ({
        text: msg.content,
        sender: msg.role === 'assistant' ? 'ai' : 'user',
      })));
    } catch (err) {
      console.error('Error fetching chat history:', err);
      setError('Failed to load chat history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleNewChat = () => {
    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    const newChat = {
      id: tempId,
      created_at: new Date().toISOString(),
      title: "New Chat...", // Placeholder title
    };
    setRecentChats(prev => [newChat, ...prev]);

    // Clear current chat view
    setCurrentSessionId(null);
    setMessages([{ text: 'Hello! How can I assist you with your documents today?', sender: 'ai' }]);
    
    // The first message sent will create the chat on the backend.
    // The optimistic new chat will be replaced once a message is sent
    // and the sessions are re-fetched.
  };

  const handleDeleteChat = async (sessionId) => {
    // Optimistic UI update
    setRecentChats(prev => prev.filter(chat => chat.id !== sessionId));

    try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_BASE_URL}/api/chat/sessions/${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        // If the deleted chat was the active one, start a new chat
        if (currentSessionId === sessionId) {
            setCurrentSessionId(null);
            setMessages([{ text: 'Hello! How can I assist you with your documents today?', sender: 'ai' }]);
        }
    } catch (err) {
        console.error('Failed to delete chat session:', err);
        // Revert UI if API call fails (optional, but good practice)
        fetchChatSessions(); 
    }
  };

  useEffect(() => {
    // If a session ID is passed via prop, load its history
    if (currentSessionId) {
      fetchChatHistory(currentSessionId);
    } else {
      // Otherwise, start a new chat
      setMessages([{ text: 'Hello! How can I assist you with your documents today?', sender: 'ai' }]);
    }
  }, [currentSessionId, fetchChatHistory]);

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async (messageText) => {
    const text = messageText || input;
    if (text.trim() === '' || isLoading) return;

    setIsLoading(true);
    const userMessage = { text, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError('');

    let sessionIdToUse = currentSessionId;

    // If this is the first message of a new chat, the session ID will be null.
    // The backend will create a new session.
    if (!sessionIdToUse) {
      // Find our temporary chat and remove it, ready for the real one.
      setRecentChats(prev => prev.filter(chat => !chat.id.toString().startsWith('temp-')));
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        message: text,
        session_id: sessionIdToUse, 
      };
      const response = await axios.post(`${API_BASE_URL}/chat`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { session_id: newSessionId, response: aiResponseText } = response.data;

      if (newSessionId && newSessionId !== currentSessionId) {
        setCurrentSessionId(newSessionId);
      }
      
      // Refresh the chat list to get the new session from the backend
      fetchChatSessions();

      setMessages((prev) => [
        ...prev,
        { text: aiResponseText, sender: 'ai' },
      ]);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Sorry, I couldn\'t process your message.';
      setError(errorMsg);
      setMessages((prev) => [
        ...prev,
        { text: `Error: ${errorMsg}`, sender: 'ai' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showSuggestions = messages.length <= 1 && !currentSessionId;

  return (
    <div className="flex h-full bg-gray-100">
      <aside className="w-64 bg-white/80 backdrop-blur-md p-4 flex-col border-r border-gray-200 hidden md:flex">
        <button 
          onClick={handleNewChat}
          className="w-full btn btn-primary mb-6 flex items-center justify-center"
        >
          <Plus size={16} className="mr-2" /> New Chat
        </button>
        <div className="flex-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Chats</h3>
          {loadingSessions && <p className="text-gray-500 text-sm p-2">Loading chats...</p>}
          {sessionsError && <p className="text-red-500 text-sm p-2">{sessionsError}</p>}
          {!loadingSessions && recentChats.length === 0 && (
            <p className="text-gray-500 text-sm p-2">No chat sessions.</p>
          )}
          <div className="space-y-1">
            {recentChats.map((session) => (
              <div key={session.id} className="group flex items-center">
                  <button
                    onClick={() => setCurrentSessionId(session.id)}
                    className={`w-full text-left p-2 rounded-md transition-colors text-sm ${
                        currentSessionId === session.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                     <span className="font-medium text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                       {session.title || `Chat - ${format(new Date(session.created_at), 'MMM dd, HH:mm')}`}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteChat(session.id)}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    title="Delete Chat"
                  >
                    <Trash2 size={16} />
                  </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full">
        {/* Main Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, index) => (
              <Message key={index} msg={msg} />
            ))}
            {isLoading && <Message msg={{ sender: 'ai', text: '...' }} />} 
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Floating Command Bar Area */}
        <div className="sticky bottom-0 w-full bg-transparent pb-4">
          <div className="max-w-3xl mx-auto px-4">
            {showSuggestions && (
              <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                {suggestions.map((s) => <SuggestionChip key={s} text={s} onClick={sendMessage} />)}
              </div>
            )}
            <div className="card flex items-center p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your documents..."
                rows="1"
                className="flex-grow bg-transparent border-none focus:ring-0 resize-none px-4 py-2 text-gray-800 placeholder-gray-500"
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
                className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 transition-all duration-200 flex-shrink-0"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Chat;
