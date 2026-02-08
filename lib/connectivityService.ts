// lib/connectivityService.ts - Detect internet connectivity and manage fallback
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_BASE_URL: string;
}

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

interface ConnectivityStatus {
  isOnline: boolean;
  useSupabase: boolean;
  lastChecked: Date;
}

class ConnectivityService {
  private isOnline: boolean = navigator.onLine;
  private supabaseClient: SupabaseClient | null = null;
  private listeners: ((status: ConnectivityStatus) => void)[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private lastSuccessfulSupabaseCheck: Date = new Date();
  private consecutiveFailures: number = 0;
  private isChecking: boolean = false;
  private lastOfflineTime: number = 0;
  private readonly BACKOFF_DELAY_MS = 30000; // 30 seconds - don't check Supabase after detecting offline

  constructor() {
    // Set initial state based on browser
    this.isOnline = navigator.onLine;
    console.log(`🔍 Initial status: ${this.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
    
    this.initializeListeners();
    this.initializeSupabase();
    this.suppressSupabaseConnectivityErrors();
    this.startConnectivityCheck();
  }

  private initializeListeners() {
    // Listen for online/offline events with proper binding
    const handleOnline = () => this.handleOnline();
    const handleOffline = () => this.handleOffline();
    
    window.addEventListener('online', handleOnline, false);
    window.addEventListener('offline', handleOffline, false);
    
    console.log('✅ Event listeners registered');
  }

  private initializeSupabase() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabaseClient = createClient(supabaseUrl, supabaseKey);
        console.log('✅ Supabase client initialized');
      } catch (error) {
        console.warn('Failed to initialize Supabase client:', error);
      }
    }
  }

  private suppressSupabaseConnectivityErrors() {
    // Suppress network errors from Supabase connectivity checks
    // These are expected when offline and just clutter the console
    if (typeof window !== 'undefined') {
      // Intercept console.error to filter Supabase network errors
      const originalError = console.error;
      
      console.error = function(...args: any[]) {
        // Convert all args to string for comparison
        const fullMessage = JSON.stringify(args).toLowerCase();
        
        // SUPPRESS these specific error patterns from Supabase library:
        if (
          fullMessage.includes('supabase.co') ||
          fullMessage.includes('err_name_not_resolved') ||
          fullMessage.includes('failed to fetch') ||
          fullMessage.includes('@supabase_supabase-js')
        ) {
          // Suppress Supabase network errors
          return;
        }
        
        // Otherwise, use original console.error for other errors
        return originalError.apply(console, arguments);
      };
      
      // Suppress unhandled promise rejections from connectivity checks
      (window as any).addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        const reason = event.reason?.message || String(event.reason);
        if (
          reason?.includes('Failed to fetch') ||
          reason?.includes('ERR_NAME_NOT_RESOLVED') ||
          reason?.includes('categories')
        ) {
          event.preventDefault();
        }
      }, true);
    }
  }

  private handleOnline() {
    const wasOffline = !this.isOnline;
    this.isOnline = true;
    this.consecutiveFailures = 0; // Reset backoff
    this.lastOfflineTime = 0; // Clear backoff timer
    console.log('🟢 ONLINE - Internet connection detected by browser');
    // Immediately try to verify with Supabase
    this.checkConnectivity();
    if (wasOffline) {
      this.notifyListeners();
    }
  }

  private handleOffline() {
    const wasOnline = this.isOnline;
    this.isOnline = false;
    console.log('🔴 OFFLINE - Internet connection lost');
    if (wasOnline) {
      this.notifyListeners();
    }
  }

  private startConnectivityCheck() {
    // Initial check immediately
    this.checkConnectivity();
    
    // Adaptive polling: faster when online, slower when offline or failing
    // When we're offline or failing, use longer intervals (15s) to reduce spam
    this.checkInterval = setInterval(() => {
      if (!this.isChecking) {
        this.checkConnectivity();
      }
    }, this.isOnline && this.consecutiveFailures === 0 ? 5000 : 15000);
  }

  private async checkConnectivity() {
    // Prevent multiple simultaneous checks
    if (this.isChecking) {
      return;
    }

    this.isChecking = true;

    try {
      // CRITICAL: Check browser offline status FIRST
      const browserIsOnline = navigator.onLine;
      
      if (!browserIsOnline) {
        // Browser says we're offline - STOP HERE, don't make any network requests
        if (this.isOnline) {
          this.isOnline = false;
          this.lastOfflineTime = Date.now();
          console.log('🔴 OFFLINE - Browser reports offline');
          this.notifyListeners();
        }
        this.isChecking = false;
        return; // EXIT EARLY - don't make any network requests
      }

      // Check if we're in backoff period (after we detected offline)
      // If so, skip Supabase check to avoid network spam
      const timeSinceOffline = Date.now() - this.lastOfflineTime;
      const inBackoff = this.consecutiveFailures > 0 && timeSinceOffline < this.BACKOFF_DELAY_MS;
      
      if (inBackoff) {
        // Still in backoff period - skip Supabase check
        // Only try again after 30 seconds of no failures
        this.isChecking = false;
        return;
      }

      // ONLY reach here if browser says we're online AND we're not in backoff
      // Now try Supabase connectivity check
      if (this.supabaseClient) {
        try {
          // Suppress all console during Supabase check
          const originalError = console.error;
          const originalWarn = console.warn;
          console.error = () => {};
          console.warn = () => {};

          try {
            // QUICK timeout: 1 second (fail fast when offline)
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 1000)
            );

            const queryPromise = this.supabaseClient
              .from('categories')
              .select('category_code')
              .limit(1);

            const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

            if (!error && data !== null) {
              // Supabase succeeded
              console.error = originalError;
              console.warn = originalWarn;
              
              if (!this.isOnline) {
                this.isOnline = true;
                this.consecutiveFailures = 0;
                this.lastOfflineTime = 0;
                console.log('🟢 ONLINE - Supabase connection verified');
                this.notifyListeners();
              }
              this.isChecking = false;
              return;
            } else {
              throw new Error('Supabase error response');
            }
          } finally {
            console.error = originalError;
            console.warn = originalWarn;
          }
        } catch (error: any) {
          // Supabase failed - mark offline immediately and start backoff
          this.consecutiveFailures++;
          this.lastOfflineTime = Date.now();
          if (this.isOnline) {
            this.isOnline = false;
            console.log('🔴 OFFLINE - Supabase unreachable');
            this.notifyListeners();
          }
          this.isChecking = false;
          return;
        }
      }
    } finally {
      this.isChecking = false;
    }
  }

  private notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  public getStatus(): ConnectivityStatus {
    return {
      isOnline: this.isOnline,
      useSupabase: this.isOnline && this.supabaseClient !== null,
      lastChecked: new Date(),
    };
  }

  public getSupabaseClient(): SupabaseClient | null {
    return this.supabaseClient;
  }

  public isConnected(): boolean {
    return this.isOnline;
  }

  public shouldUseSupabase(): boolean {
    return this.isOnline && this.supabaseClient !== null;
  }

  /**
   * Report a network error - immediately marks system as offline
   * This is called by supabaseClient when network requests fail
   */
  public reportNetworkError(error: any): void {
    const isNetworkError = error?.message?.includes('Failed to fetch') || 
                          error?.message?.includes('ERR_NAME_NOT_RESOLVED') ||
                          error?.message?.includes('timeout') ||
                          error?.message?.includes('Network') ||
                          error?.name === 'TypeError';
    
    if (isNetworkError && this.isOnline) {
      console.log('🔴 OFFLINE - Network error detected, marking offline immediately:', error?.message);
      this.isOnline = false;
      this.consecutiveFailures = 3; // Set high to prevent immediate recovery attempts
      this.notifyListeners();
    }
  }

  public subscribe(listener: (status: ConnectivityStatus) => void) {
    this.listeners.push(listener);
    // Immediately call with current status
    listener(this.getStatus());

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.listeners = [];
  }
}

export const connectivityService = new ConnectivityService();
export type { ConnectivityStatus };
