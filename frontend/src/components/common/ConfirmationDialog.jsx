import React, { useState, useEffect } from 'react';
import Modal from './Modal';

function ConfirmationDialog({ isOpen, onClose, onConfirm, title, children, confirmationText }) {
  const [inputText, setInputText] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputText('');
      setIsConfirmed(false);
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    setIsConfirmed(e.target.value === confirmationText);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>{children}</div>
        <p className="text-sm text-gray-600">
          To confirm, please type "<strong className="text-gray-800">{confirmationText}</strong>" in the box below.
        </p>
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmed}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmationDialog;
