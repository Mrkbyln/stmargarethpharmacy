// components/ConnectivityStatus.tsx - Display and manage connectivity status
import React, { useState, useEffect } from 'react';
import { connectivityService, ConnectivityStatus as ConnectivityStatusType } from '../lib/connectivityService';
import { Wifi, WifiOff } from 'lucide-react';

export const ConnectivityStatus: React.FC = () => {
  const [status, setStatus] = useState<ConnectivityStatusType | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.log('🔌 ConnectivityStatus component mounted');
    
    // Subscribe to status changes
    const unsubscribe = connectivityService.subscribe((newStatus) => {
      console.log('📡 Status updated:', newStatus);
      setStatus(newStatus);
    });

    return () => {
      console.log('🔌 ConnectivityStatus component unmounted');
      unsubscribe();
    };
  }, []);

  if (!status) {
    return <div className="fixed bottom-4 left-4 z-50 text-gray-500">Loading...</div>;
  }

  const isOnline = status.isOnline;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Status Badge */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all ${
          isOnline
            ? 'bg-green-500 hover:bg-green-600'
            : 'bg-amber-500 hover:bg-amber-600'
        }`}
      >
        {isOnline ? (
          <Wifi size={16} />
        ) : (
          <WifiOff size={16} />
        )}
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </button>

      {/* Details Panel */}
      {showDetails && (
        <div className="absolute bottom-full mb-2 left-0 bg-gray-900 text-white rounded-lg p-3 shadow-lg text-xs w-72">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Connection Status:</span>
              <span className="font-bold">{isOnline ? '🟢 Online' : '🟡 Offline'}</span>
            </div>
            <div className="flex justify-between">
              <span>Primary Database:</span>
              <span className="font-bold">☁️ Supabase</span>
            </div>
            <div className="flex justify-between">
              <span>Fallback Database:</span>
              <span className="font-bold">🔌 XAMPP Local</span>
            </div>
            <div className="flex justify-between">
              <span>Current Mode:</span>
              <span className="font-bold">
                {isOnline ? '☁️ Primary (Supabase)' : '💾 Fallback (Local)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last Check:</span>
              <span>{status.lastChecked.toLocaleTimeString()}</span>
            </div>
            <div className="text-gray-300 mt-2 pt-2 border-t border-gray-700">
              {isOnline
                ? '✅ Using Supabase. Local data will sync when offline data is available.'
                : '⚠️ Using local database. Changes will sync to Supabase when online.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectivityStatus;
