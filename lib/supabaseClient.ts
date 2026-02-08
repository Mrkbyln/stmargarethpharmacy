// lib/supabaseClient.ts - PRIMARY data source (Supabase)
import { createClient } from '@supabase/supabase-js';
import { connectivityService } from './connectivityService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * SUPABASE IS PRIMARY DATA SOURCE
 * Fetch data from Supabase (primary)
 */
export async function fetchFromSupabase<T>(table: string, query?: any): Promise<T[]> {
  try {
    console.log(`📡 Fetching from Supabase table: ${table}`);
    let q = supabase.from(table).select('*');

    if (query?.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        q = q.eq(key, value);
      }
    }

    const { data, error } = await q;
    
    if (error) {
      // Only log error if we were expecting Supabase to work
      // Suppress error logging if system is already marked offline (these are expected)
      if (connectivityService.shouldUseSupabase()) {
        console.error(`❌ Supabase error for table ${table}:`, error);
      }
      // Don't log anything if offline - these are expected network errors
      
      // Report network error to connectivity service
      connectivityService.reportNetworkError(error);
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    const recordCount = Array.isArray(data) ? data.length : 0;
    console.log(`✅ Supabase ${table}: ${recordCount} records fetched`);
    return (data as T[]) || [];
  } catch (error) {
    // Only log detailed error if we were expecting Supabase to work
    if (connectivityService.shouldUseSupabase()) {
      console.error(`❌ Failed to fetch from Supabase (PRIMARY): ${table}`, error);
    } else {
      console.log(`⏭️  Supabase ${table} failed (expected - system offline, using local API)`);
    }
    
    // Report network error to connectivity service immediately
    connectivityService.reportNetworkError(error);
    throw error; // Let caller handle fallback
  }
}

/**
 * Sync data TO Supabase (primary database)
 */
export async function syncToSupabase(table: string, data: any, mode: 'insert' | 'upsert' = 'insert') {
  try {
    // Map field names to match Supabase schema
    let mappedData = data;
    let syncMode = mode;
    
    // Define which tables support upsert and what their conflict keys are
    const upsertTables: { [key: string]: string } = {
      'products': 'product_id',
      'users': 'user_id',
      'settings': 'setting_key',
      'discounts': 'discount_id',
      'stock_entries': 'stock_entry_id',
    };

    // Tables that should ALWAYS use insert (never upsert)
    const insertOnlyTables = ['backups', 'auditlogs', 'pos_sales', 'salestransaction', 'reports', 'receipts', 'notifications', 'damageditems', 'changeitem', 'inventorytransactions'];
    
    if (table === 'auditlogs') {
      // auditlogs uses: log_id (pk, auto-generated), user_id, action_performed, timestamp
      mappedData = {
        user_id: data.user_id || data.userId || 1,
        action_performed: data.action_performed || data.action,
        timestamp: data.timestamp
      };
      syncMode = 'insert';
    }

    // Force insert mode for insert-only tables
    if (insertOnlyTables.includes(table)) {
      syncMode = 'insert';
    }

    if (syncMode === 'upsert' && upsertTables[table]) {
      const conflictColumn = upsertTables[table];
      const { error } = await supabase
        .from(table)
        .upsert(mappedData, { onConflict: conflictColumn });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from(table)
        .insert(mappedData);
      if (error) throw error;
    }
    console.log(`✅ Data saved to Supabase (PRIMARY): ${table}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to save to Supabase (PRIMARY): ${table}`, error);
    return false;
  }
}

/**
 * Backup data to local database (fallback)
 */
export async function backupToLocal(table: string, data: any): Promise<boolean> {
  try {
    const endpoint = `/api/${table}/create.php`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.success) {
      console.log(`💾 Backup saved to XAMPP (LOCAL): ${table}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`⚠️ Failed to backup to local: ${table}`, error);
    return false;
  }
}

export default supabase;
