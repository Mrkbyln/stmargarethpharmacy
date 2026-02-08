/**
 * useRule3DataFetch.ts - Rule 3: Connectivity-Aware Data Fetching
 * 
 * RULE 3 (DATA DISPLAY IN TABLES):
 * - ONLINE: All table data should come from Supabase
 * - OFFLINE: All table data should come from local XAMPP
 * 
 * This hook determines the correct data source based on connectivity
 * and provides unified data fetching interface.
 */

import { useConnectivity } from './useConnectivity';
import { fetchFromSupabase } from './supabaseClient';
import apiClient from './apiClient';

interface Rule3Options {
  table: string; // Supabase table name
  apiEndpoint: string; // Local PHP API endpoint (e.g., '/products/read.php')
  filters?: Record<string, any>; // Optional filters
}

interface Rule3Result<T> {
  data: T[];
  source: 'supabase_only' | 'local_only';
  isOnline: boolean;
  error?: string;
}

/**
 * Hook to fetch data based on connectivity status
 * Returns data from Supabase when online, from local XAMPP when offline
 * 
 * Usage:
 * const [data, source, isOnline] = useRule3DataFetch('products', '/products/read.php');
 */
export function useRule3DataFetch<T = any>(
  table: string,
  apiEndpoint: string,
  filters?: Record<string, any>
): [T[], 'supabase_only' | 'local_only', boolean] {
  const { isOnline } = useConnectivity();

  // Determine the data source based on connectivity
  // The parent component should use this with useEffect and fetchDataRule3() for actual data fetching
  const dataSource = isOnline ? 'supabase_only' : 'local_only';

  return [[], dataSource, isOnline];
}

/**
 * Async function to fetch data based on connectivity
 * Call this inside useEffect in components
 */
export async function fetchDataRule3<T = any>(
  options: Rule3Options
): Promise<Rule3Result<T>> {
  // Check connectivity first (outside try block to ensure it's always defined)
  const isOnline = navigator.onLine;
  
  try {
    console.log(
      `[Rule 3] ${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'} | Fetching ${options.table} from ${
        isOnline ? 'Supabase' : 'Local XAMPP'
      }`
    );

    if (isOnline) {
      // Rule 3 ONLINE: Fetch from Supabase
      try {
        const data = await fetchFromSupabase<T>(options.table, {
          filters: options.filters,
        });
        console.log(`✅ Rule 3: Data fetched from Supabase (${data.length} records)`);
        return {
          data,
          source: 'supabase_only',
          isOnline: true,
        };
      } catch (supabaseError) {
        console.error('❌ Failed to fetch from Supabase:', supabaseError);
        // Fallback to local XAMPP if Supabase fails
        console.log('⚠️ Falling back to local XAMPP...');
        try {
          const response = await apiClient.fetchEndpoint<T>(`${options.apiEndpoint}`);
          const responseData = Array.isArray(response.data) ? response.data : [];
          return {
            data: responseData,
            source: 'local_only',
            isOnline: true,
            error: `Supabase fetch failed, using local fallback`,
          };
        } catch (fallbackError) {
          console.error('❌ Fallback fetch also failed:', fallbackError);
          return {
            data: [] as T[],
            source: 'local_only',
            isOnline: true,
            error: `Both Supabase and fallback failed: ${fallbackError}`,
          };
        }
      }
    } else {
      // Rule 3 OFFLINE: Fetch from local XAMPP
      try {
        const response = await apiClient.fetchEndpoint<T>(`${options.apiEndpoint}`);
        const responseData = Array.isArray(response.data) ? response.data : [];
        console.log(
          `✅ Rule 3: Data fetched from local XAMPP (${
            responseData.length || 0
          } records)`
        );
        return {
          data: responseData,
          source: 'local_only',
          isOnline: false,
        };
      } catch (error) {
        console.error('❌ Failed to fetch from local XAMPP:', error);
        return {
          data: [] as T[],
          source: 'local_only',
          isOnline: false,
          error: `Failed to fetch data from local XAMPP: ${error}`,
        };
      }
    }
  } catch (error) {
    console.error('❌ Rule 3 fetch error:', error);
    return {
      data: [] as T[],
      source: isOnline ? 'supabase_only' : 'local_only',
      isOnline: isOnline,
      error: String(error),
    };
  }
}

export default {
  useRule3DataFetch,
  fetchDataRule3,
};
