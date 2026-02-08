import React, { useState } from 'react';
import { useConnectivity } from '../lib/useConnectivity';

/**
 * ConnectivityIndicator - Compact dot showing online/offline status
 * Shows on all pages via App component - minimal UI
 */
const ConnectivityIndicator: React.FC = () => {
  const { isOnline, shouldUseSupabase } = useConnectivity();
  const [showTooltip, setShowTooltip] = useState(false);

  const statusText = isOnline ? 'ONLINE - Supabase' : 'OFFLINE - Local';
  const dotColor = isOnline ? '#22c55e' : '#ef4444';
  const glowColor = isOnline ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';

  return (
    <div 
      className="fixed top-4 right-4 z-[999] cursor-pointer group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={statusText}
    >
      {/* Indicator Dot */}
      <div 
        className="w-3 h-3 md:w-4 md:h-4 rounded-full animate-pulse shadow-lg transition-all duration-300"
        style={{
          backgroundColor: dotColor,
          boxShadow: `0 0 12px ${glowColor}, 0 0 6px ${dotColor}`
        }}
      />
      
      {/* Desktop Tooltip - Shows on hover */}
      {showTooltip && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 animate-in fade-in duration-150">
          {statusText}
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900" style={{clipPath: 'polygon(0 100%, 100% 100%, 50% 0)'}} />
        </div>
      )}

      {/* Mobile Status Indicator - Quick peek */}
      <div className="md:hidden absolute -bottom-6 right-0 bg-gray-900 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
        {isOnline ? '🟢' : '🔴'}
      </div>
    </div>
  );
};

export default ConnectivityIndicator;
