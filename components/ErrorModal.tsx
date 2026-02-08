import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';

interface ErrorModalProps {
  isOpen: boolean;
  errorCode?: string;
  title?: string;
  message: string;
  actionText?: string;
  onClose: () => void;
  onAction?: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  errorCode,
  title,
  message,
  actionText = 'OK',
  onClose,
  onAction,
}) => {
  if (!isOpen) return null;

  const handleActionClick = () => {
    if (onAction) {
      onAction();
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 flex-1">
            <div className="bg-white rounded-full p-2 flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex flex-col">
              {errorCode && (
                <p className="text-white text-sm font-bold uppercase tracking-wide">Error Code: {errorCode}</p>
              )}
              <h3 className="font-extrabold text-lg text-white">
                {title || 'Error'}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="hover:bg-white/20 p-1 rounded-full transition-colors flex-shrink-0"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        <div className="p-8">
          <p className="text-slate-700 text-base font-medium leading-relaxed text-center">
            {message}
          </p>

          <button
            onClick={handleActionClick}
            className="w-full mt-8 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-lg shadow-md transition-all hover:shadow-lg"
          >
            {actionText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ErrorModal;
