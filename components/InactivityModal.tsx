import React, { useState, useEffect } from 'react';

interface InactivityModalProps {
  isOpen: boolean;
  countdown: number;
  onStay: () => void;
  onLogout: () => void;
}

const InactivityModal: React.FC<InactivityModalProps> = ({ isOpen, countdown, onStay, onLogout }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Are you still there?</h2>
        <p className="text-slate-600 mb-6">You've been inactive for a while. For your security, we'll log you out automatically.</p>
        <p className="text-slate-600 mb-2">You will be logged out in...</p>
        <p className="text-5xl font-extrabold text-[var(--color-primary)] mb-8">{countdown}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onLogout}
            className="px-6 py-3 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Logout Now
          </button>
          <button
            onClick={onStay}
            className="px-6 py-3 text-sm font-semibold text-white bg-[var(--color-primary)] hover:opacity-90 rounded-lg transition-opacity"
          >
            I'm Still Here
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactivityModal;
