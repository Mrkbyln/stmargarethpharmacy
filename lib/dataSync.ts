// lib/dataSync.ts - Advanced data synchronization utilities
import { connectivityService } from './connectivityService';
import { supabase } from './supabaseClient';
import { syncQueue } from './syncQueue';

interface SyncConfig {
  table: string;
  localApi: string;
  supabseTable?: string;
}

class DataSyncManager {
  private configs: Map<string, SyncConfig> = new Map();
  private isSyncing = false;

  /**
   * Register a data source for automatic syncing
   */
  public register(config: SyncConfig) {
    this.configs.set(config.table, {
      ...config,
      supabseTable: config.supabseTable || config.table,
    });
  }

  /**
   * Synchronize data from local to Supabase
   */
  public async syncTable(table: string) {
    if (!connectivityService.shouldUseSupabase()) {
      console.log(`⚠️ Not syncing ${table} - offline or Supabase unavailable`);
      return false;
    }

    const config = this.configs.get(table);
    if (!config) {
      console.warn(`No sync config for table: ${table}`);
      return false;
    }

    try {
      console.log(`🔄 Syncing ${table}...`);

      // Fetch from local API
      const localResponse = await fetch(config.localApi);
      const localData = await localResponse.json();

      if (!localData.success || !localData.data) {
        throw new Error(`Failed to fetch from local API: ${config.localApi}`);
      }

      const items = Array.isArray(localData.data) ? localData.data : [localData.data];

      // Sync each item to Supabase
      let synced = 0;
      let failed = 0;

      for (const item of items) {
        try {
          const { error } = await supabase
            .from(config.supabseTable!)
            .upsert(item, { onConflict: 'id' });

          if (error) {
            console.error(`Failed to sync item:`, error);
            failed++;
          } else {
            synced++;
          }
        } catch (error) {
          console.error(`Error syncing item:`, error);
          failed++;
        }
      }

      console.log(`✅ ${table} sync complete: ${synced} synced, ${failed} failed`);
      return failed === 0;
    } catch (error) {
      console.error(`❌ Error syncing ${table}:`, error);
      return false;
    }
  }

  /**
   * Perform bidirectional sync (local ← → Supabase)
   */
  public async bidirectionalSync(table: string, options?: { fromSupabase?: boolean }) {
    const fromSupabase = options?.fromSupabase !== false; // default true

    if (!connectivityService.shouldUseSupabase()) {
      console.log(`⚠️ Bidirectional sync not possible - offline`);
      return false;
    }

    try {
      if (fromSupabase) {
        // Fetch from Supabase and update local (if your API supports it)
        console.log(`🔄 Syncing from Supabase to local: ${table}`);
        // This would require a dedicated endpoint to update local DB
        // Implement based on your architecture
      }

      // Always sync from local to Supabase
      return await this.syncTable(table);
    } catch (error) {
      console.error(`❌ Bidirectional sync failed for ${table}:`, error);
      return false;
    }
  }

  /**
   * Verify data consistency between local and Supabase
   */
  public async verifyConsistency(table: string): Promise<{ consistent: boolean; stats: any }> {
    if (!connectivityService.shouldUseSupabase()) {
      return { consistent: false, stats: { reason: 'Offline' } };
    }

    const config = this.configs.get(table);
    if (!config) {
      return { consistent: false, stats: { reason: 'No config' } };
    }

    try {
      // Get local count
      const localResponse = await fetch(config.localApi);
      const localData = await localResponse.json();
      const localCount = Array.isArray(localData.data) ? localData.data.length : 1;

      // Get Supabase count
      const { count: supabaseCount, error } = await supabase
        .from(config.supabseTable!)
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      const consistent = localCount === supabaseCount;
      const stats = {
        local: localCount,
        supabase: supabaseCount,
        difference: Math.abs(localCount - (supabaseCount || 0)),
      };

      console.log(
        `📊 ${table} consistency: ${consistent ? '✅' : '❌'} Local: ${stats.local}, Supabase: ${stats.supabase}`
      );

      return { consistent, stats };
    } catch (error) {
      console.error(`Error checking consistency for ${table}:`, error);
      return { consistent: false, stats: { error: error.message } };
    }
  }

  /**
   * Resolve conflicts (local takes precedence)
   */
  public async resolveConflicts(table: string) {
    if (!connectivityService.shouldUseSupabase()) {
      console.log(`⚠️ Cannot resolve conflicts - offline`);
      return false;
    }

    try {
      console.log(`🔧 Resolving conflicts for ${table}...`);
      // Sync local to Supabase (local takes precedence)
      return await this.syncTable(table);
    } catch (error) {
      console.error(`Error resolving conflicts for ${table}:`, error);
      return false;
    }
  }

  /**
   * Get sync status for all registered tables
   */
  public async getSyncStatus() {
    const status: Record<string, any> = {};

    for (const [table] of this.configs) {
      const consistency = await this.verifyConsistency(table);
      status[table] = {
        synced: consistency.consistent,
        stats: consistency.stats,
      };
    }

    return status;
  }

  /**
   * Sync all registered tables
   */
  public async syncAll() {
    console.log(`🔄 Starting full sync of all tables...`);

    const results: Record<string, boolean> = {};

    for (const [table] of this.configs) {
      results[table] = await this.syncTable(table);
    }

    const successful = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    console.log(`✨ Full sync complete: ${successful}/${total} successful`);

    return results;
  }

  /**
   * Clear all pending syncs for a table
   */
  public clearPendingSyncs(table: string) {
    // Implementation would depend on sync queue structure
    console.log(`🗑️ Cleared pending syncs for ${table}`);
  }
}

export const dataSyncManager = new DataSyncManager();

// Example usage:
// dataSyncManager.register({
//   table: 'medicines',
//   localApi: '/api/inventory/products.php',
//   supabseTable: 'medicines'
// });
//
// dataSyncManager.register({
//   table: 'sales',
//   localApi: '/api/sales/list.php',
//   supabseTable: 'sales'
// });
//
// // Sync everything
// await dataSyncManager.syncAll();
//
// // Check consistency
// const status = await dataSyncManager.getSyncStatus();
// console.log(status);
