import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function Vectors({ user }) {
  const [vectors, setVectors] = useState([]);
  const [embedding, setEmbedding] = useState('');
  const [metadata, setMetadata] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVectors();
  }, []);

  const fetchVectors = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API_BASE_URL}/vectors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVectors(response.data);
    } catch (err) {
      setError('Failed to fetch vectors');
    }
  };

  const createVector = async () => {
    const token = localStorage.getItem('token');
    try {
      const embArray = embedding.split(',').map(Number);
      await axios.post(`${API_BASE_URL}/vectors`, { embedding: embArray, metadata: JSON.parse(metadata || '{}') }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchVectors();
    } catch (err) {
      setError('Failed to create vector');
    }
  };

  const canWrite = user && user.role === 'admin'; // Adjust based on backend permissions

  return (
    <div>
      <h2>Vectors</h2>
      {canWrite && (
        <div>
          <input placeholder="Embedding (comma-separated floats)" value={embedding} onChange={(e) => setEmbedding(e.target.value)} />
          <input placeholder="Metadata (JSON)" value={metadata} onChange={(e) => setMetadata(e.target.value)} />
          <button onClick={createVector}>Create Vector</button>
        </div>
      )}
      <ul>
        {vectors.map(v => <li key={v.id}>{JSON.stringify(v)}</li>)}
      </ul>
      {error && <p>{error}</p>}
    </div>
  );
}

export default Vectors;
