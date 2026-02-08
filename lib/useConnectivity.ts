// lib/useConnectivity.ts - Hook to use connectivity status in components
import { useState, useEffect } from 'react';
import { connectivityService, ConnectivityStatus } from './connectivityService';

export function useConnectivity() {
  const [status, setStatus] = useState<ConnectivityStatus>(() => connectivityService.getStatus());

  useEffect(() => {
    const unsubscribe = connectivityService.subscribe(setStatus);
    return () => unsubscribe();
  }, []);

  return {
    isOnline: status.isOnline,
    useSupabase: status.useSupabase,
    shouldUseSupabase: connectivityService.shouldUseSupabase(),
    lastChecked: status.lastChecked,
  };
}
