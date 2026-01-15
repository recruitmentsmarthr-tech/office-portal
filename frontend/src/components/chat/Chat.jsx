import React, { useState } from 'react';
import axios from 'axios';

function Chat() {
  const [messages, setMessages] = useState([
    { text: 'Hello! How can I assist you today?', sender: 'ai' },
  ]);
  const [input, setInput] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

  const sendMessage = async () => {
    if (input.trim()) {
      // Add user message
      setMessages([...messages, { text: input, sender: 'user' }]);
      const userMessage = input;
      setInput('');

      try {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_BASE_URL}/chat`, { message: userMessage }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        // Add AI response
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
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div className="relative flex flex-col h-full bg-gray-50">
      {/* Messages Area (Fixed Width) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`w-80 px-4 py-2 rounded-lg ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-800 shadow-md'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area (Fixed at Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
