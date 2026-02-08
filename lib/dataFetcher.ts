// lib/dataFetcher.ts - Fetch data from Supabase when ONLINE (ONLY), Local API when OFFLINE (ONLY)
import { connectivityService } from './connectivityService';
import { fetchFromSupabase } from './supabaseClient';
import apiClient from './apiClient';

/**
 * Fetch medicines - ONLY from Supabase when online, ONLY from local when offline
 */
export async function fetchMedicines() {
  if (connectivityService.shouldUseSupabase()) {
    // ONLINE: Use ONLY Supabase
    try {
      console.log('🟢 ONLINE - Fetching medicines from Supabase (PRIMARY ONLY)');
      const data = await fetchFromSupabase('products');
      console.log('✅ Medicines loaded from Supabase:', data.length);
      return data;
    } catch (error) {
      // Check if we're still online - if not, this is expected
      if (connectivityService.shouldUseSupabase()) {
        console.error('❌ Supabase fetch failed:', error);
        console.error('⚠️  Supabase is PRIMARY source when ONLINE. Returning empty array.');
      }
      return [];
    }
  } else {
    // OFFLINE: Use ONLY Local API
    try {
      console.log('🔴 OFFLINE - Fetching medicines from local API (FALLBACK ONLY)');
      const response = await apiClient.getProducts();
      console.log('✅ Medicines loaded from local API:', response.data?.length);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch medicines from local API:', error);
      return [];
    }
  }
}

/**
 * Fetch sales - ONLY from Supabase when online, ONLY from local when offline
 */
export async function fetchSales() {
  if (connectivityService.shouldUseSupabase()) {
    // ONLINE: Use ONLY Supabase
    try {
      console.log('🟢 ONLINE - Fetching sales from Supabase (PRIMARY ONLY)');
      const data = await fetchFromSupabase('pos_sales');
      console.log('✅ Sales loaded from Supabase:', data.length);
      return data;
    } catch (error) {
      if (connectivityService.shouldUseSupabase()) {
        console.error('❌ Supabase fetch failed:', error);
      }
      return [];
    }
  } else {
    // OFFLINE: Use ONLY Local API
    try {
      console.log('🔴 OFFLINE - Fetching sales from local API (FALLBACK ONLY)');
      const response = await apiClient.getSales();
      console.log('✅ Sales loaded from local API:', response.data?.length);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch sales:', error);
      return [];
    }
  }
}

/**
 * Fetch users - ONLY from Supabase when online, ONLY from local when offline
 */
export async function fetchUsers() {
  if (connectivityService.shouldUseSupabase()) {
    // ONLINE: Use ONLY Supabase
    try {
      console.log('🟢 ONLINE - Fetching users from Supabase (PRIMARY ONLY)');
      const data = await fetchFromSupabase('users');
      console.log('✅ Users loaded from Supabase:', data.length);
      return data;
    } catch (error) {
      if (connectivityService.shouldUseSupabase()) {
        console.error('❌ Supabase fetch failed:', error);
      }
      return [];
    }
  } else {
    // OFFLINE: Use ONLY Local API
    try {
      console.log('🔴 OFFLINE - Fetching users from local API (FALLBACK ONLY)');
      const response = await apiClient.getUsers();
      console.log('✅ Users loaded from local API:', response.data?.length);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch users:', error);
      return [];
    }
  }
}

/**
 * Fetch audit logs - ONLY from Supabase when online, ONLY from local when offline
 */
export async function fetchAuditLogs() {
  if (connectivityService.shouldUseSupabase()) {
    // ONLINE: Use ONLY Supabase with joined user info
    try {
      console.log('🟢 ONLINE - Fetching audit logs from Supabase (PRIMARY ONLY)');
      const supabase = (await import('./supabaseClient')).supabase;
      
      // First, fetch all audit logs
      const { data: auditData, error: auditError } = await supabase
        .from('auditlogs')
        .select(`log_id, user_id, action_performed, timestamp`)
        .order('timestamp', { ascending: false });
      
      if (auditError) throw auditError;
      
      if (!auditData || auditData.length === 0) {
        console.log('✅ Audit logs loaded from Supabase: 0 records');
        return [];
      }
      
      // Extract unique user IDs to fetch user details
      const userIds = [...new Set((auditData || []).map((log: any) => log.user_id).filter((id: any) => id))];
      
      // Fetch user details for those IDs
      let usersMap: any = {};
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('user_id, username, role')
          .in('user_id', userIds);
        
        if (usersError) {
          console.warn('Failed to fetch user details from Supabase, continuing without user info:', usersError);
        } else if (usersData) {
          // Create a map of user_id -> user info for quick lookup
          usersMap = usersData.reduce((acc: any, user: any) => {
            acc[user.user_id] = user;
            return acc;
          }, {});
        }
      }
      
      // Map audit logs and attach user information
      const mappedData = (auditData || []).map((log: any) => {
        const userInfo = usersMap[log.user_id];
        return {
          LogID: log.log_id,
          id: log.log_id,
          UserID: log.user_id,
          user_id: log.user_id,
          ActionPerformed: log.action_performed,
          action: log.action_performed,
          Timestamp: log.timestamp,
          timestamp: log.timestamp,
          UserName: userInfo?.username || 'Unknown',
          user: userInfo?.username || 'Unknown',
          Role: userInfo?.role || 'Unknown',
          role: userInfo?.role || 'Unknown'
        };
      });
      
      console.log('✅ Audit logs loaded from Supabase:', mappedData.length);
      return mappedData;
    } catch (error) {
      if (connectivityService.shouldUseSupabase()) {
        console.error('❌ Supabase fetch failed:', error);
      }
      return [];
    }
  } else {
    // OFFLINE: Use ONLY Local API
    try {
      console.log('🔴 OFFLINE - Fetching audit logs from local API (FALLBACK ONLY)');
      const response = await apiClient.getAuditLogs();
      
      // Map local API response to match Supabase response format
      const normalizedData = (response.data || []).map((log: any) => ({
        LogID: log.id,
        id: log.id,
        UserID: log.userId,
        user_id: log.userId,
        ActionPerformed: log.action,
        action: log.action,
        Timestamp: log.timestamp,
        timestamp: log.timestamp,
        UserName: log.username || 'Unknown',
        user: log.username || 'Unknown',
        Role: log.role || 'Unknown',
        role: log.role || 'Unknown',
        profileImage: log.profileImage
      }));
      
      console.log('✅ Audit logs loaded from local API:', normalizedData.length);
      return normalizedData;
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }
  }
}

/**
 * Fetch low stock items - ONLY from Supabase when online, ONLY from local when offline
 */
export async function fetchLowStockItems() {
  if (connectivityService.shouldUseSupabase()) {
    // ONLINE: Use ONLY Supabase
    try {
      console.log('🟢 ONLINE - Fetching low stock items from Supabase (PRIMARY ONLY)');
      const data = await fetchFromSupabase('products', {
        filters: { low_stock: true }
      });
      console.log('✅ Low stock items loaded from Supabase:', data.length);
      return data;
    } catch (error) {
      if (connectivityService.shouldUseSupabase()) {
        console.error('❌ Supabase fetch failed:', error);
      }
      return [];
    }
  } else {
    // OFFLINE: Use ONLY Local API
    try {
      console.log('🔴 OFFLINE - Fetching low stock items from local API (FALLBACK ONLY)');
      const response = await apiClient.getLowStockItems();
      console.log('✅ Low stock items loaded from local API:', response.data?.length);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch low stock items:', error);
      return [];
    }
  }
}

/**
 * Fetch expired items - ONLY from Supabase when online, ONLY from local when offline
 */
export async function fetchExpiredItems() {
  if (connectivityService.shouldUseSupabase()) {
    // ONLINE: Use ONLY Supabase
    try {
      console.log('🟢 ONLINE - Fetching expired items from Supabase (PRIMARY ONLY)');
      const data = await fetchFromSupabase('products', {
        filters: { expired: true }
      });
      console.log('✅ Expired items loaded from Supabase:', data.length);
      return data;
    } catch (error) {
      if (connectivityService.shouldUseSupabase()) {
        console.error('❌ Supabase fetch failed:', error);
      }
      return [];
    }
  } else {
    // OFFLINE: Use ONLY Local API
    try {
      console.log('🔴 OFFLINE - Fetching expired items from local API (FALLBACK ONLY)');
      const response = await apiClient.getExpiredItems();
      console.log('✅ Expired items loaded from local API:', response.data?.length);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch expired items:', error);
      return [];
    }
  }
}
