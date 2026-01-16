import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function Chat() {
  const [messages, setMessages] = useState([
    { text: 'Hello! How can I assist you with your documents today?', sender: 'ai' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (input.trim() && !isLoading) {
      setIsLoading(true);
      const userMessage = { text: input, sender: 'user' };
      setMessages(prev => [...prev, userMessage]);
      setInput('');

      try {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_BASE_URL}/chat`, { message: userMessage.text }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(prev => [
          ...prev,
          { text: response.data.response, sender: 'ai' },
        ]);
      } catch (error) {
        console.error('Error sending message:', error);
        setMessages(prev => [
          ...prev,
          { text: 'Sorry, I couldn\'t process your message. Please try again.', sender: 'ai' },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
          {messages.map((msg, index) => (
            <div key={index} className="flex items-start space-x-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.sender === 'user' ? 'bg-gray-200' : 'bg-blue-500 text-white'}`}>
                {msg.sender === 'user' ? <User size={20} /> : <Sparkles size={20} />}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{msg.sender === 'user' ? 'You' : 'AI'}</p>
                <div className="prose prose-lg max-w-none text-gray-600 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input "Capsule" Area */}
      <div className="sticky bottom-0 left-0 right-0 w-full bg-white bg-opacity-80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto p-4">
          <div className="flex items-center bg-gray-100 rounded-3xl p-2 shadow-sm focus-within:shadow-md transition-shadow">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              rows="1"
              className="flex-grow bg-transparent border-none focus:ring-0 px-4 py-2 resize-none"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
