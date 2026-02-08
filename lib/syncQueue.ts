// lib/syncQueue.ts - Queue for backup to local when offline
/**
 * ARCHITECTURE:
 * - Supabase is PRIMARY database (online)
 * - Local DB is BACKUP (when offline)
 * - Queue holds data to sync back to Supabase when reconnecting
 */
import { connectivityService } from './connectivityService';
import { syncToSupabase } from './supabaseClient';

interface SyncItem {
  id: string;
  table: string;
  data: any;
  timestamp: Date;
  retries: number;
  maxRetries: number;
}

class SyncQueue {
  private queue: SyncItem[] = [];
  private isSyncing = false;
  private storageKey = 'pharmacy_sync_queue';

  constructor() {
    this.loadFromStorage();
    this.subscribeToConnectivity();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load sync queue from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue to storage:', error);
    }
  }

  private subscribeToConnectivity() {
    connectivityService.subscribe((status) => {
      // When back online, sync queued data from local to Supabase
      if (status.isOnline && status.useSupabase && !this.isSyncing && this.queue.length > 0) {
        console.log('🌐 Back online! Syncing local changes to Supabase...');
        this.processSyncQueue();
      }
    });
  }

  public addToQueue(table: string, data: any, maxRetries = 3) {
    const item: SyncItem = {
      id: `${table}_${Date.now()}_${Math.random()}`,
      table,
      data,
      timestamp: new Date(),
      retries: 0,
      maxRetries,
    };

    this.queue.push(item);
    this.saveToStorage();

    console.log(`📝 Queued for Supabase sync: ${table}`, item.id);

    // Try to sync immediately if online
    if (connectivityService.shouldUseSupabase()) {
      this.processSyncQueue();
    }
  }

  private async processSyncQueue() {
    if (this.isSyncing || this.queue.length === 0) return;

    this.isSyncing = true;
    console.log(`🔄 Syncing ${this.queue.length} items from local to Supabase...`);

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];

      try {
        const success = await syncToSupabase(item.table, item.data, 'upsert');

        if (success) {
          this.queue.splice(i, 1);
          console.log(`✅ Synced to Supabase: ${item.table} (${item.id})`);
        } else {
          item.retries++;

          if (item.retries >= item.maxRetries) {
            console.error(`❌ Max retries exceeded: ${item.table} (${item.id})`);
          }
        }
      } catch (error) {
        item.retries++;
        console.error(`⚠️ Sync error: ${item.table}`, error);

        if (item.retries >= item.maxRetries) {
          console.error(`❌ Max retries exceeded: ${item.table} (${item.id})`);
        }
      }
    }

    this.saveToStorage();
    this.isSyncing = false;

    if (this.queue.length === 0) {
      console.log('✨ All local changes synced to Supabase!');
    } else {
      console.log(`⏳ ${this.queue.length} items still waiting to sync`);
    }
  }

  public getQueueSize(): number {
    return this.queue.length;
  }

  public getQueue(): SyncItem[] {
    return [...this.queue];
  }

  public clearQueue() {
    this.queue = [];
    this.saveToStorage();
    console.log('🗑️ Sync queue cleared');
  }

  public async retryAll() {
    console.log('🔄 Retrying all failed syncs to Supabase...');
    for (const item of this.queue) {
      item.retries = 0;
    }
    await this.processSyncQueue();
  }
}

export const syncQueue = new SyncQueue();
export type { SyncItem };
