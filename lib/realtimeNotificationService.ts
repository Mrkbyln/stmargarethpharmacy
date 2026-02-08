// lib/realtimeNotificationService.ts

interface RealtimeListener {
  onNotificationAdded: (notification: any) => void;
  onNotificationRemoved: (notificationId: number) => void;
  onNotificationsRefreshed: (notifications: any[]) => void;
  onExpiredProductsChanged?: (expiredProducts: any[]) => void;
  onLowStockChanged?: (lowStockProducts: any[]) => void;
}

class RealtimeNotificationService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private listeners: RealtimeListener[] = [];
  private lastFetchedNotifications: Map<number, any> = new Map();
  private lastFetchedLowStockProducts: Set<number> = new Set();
  private pollingInterval_ms = 3000; // Poll every 3 seconds for real-time feel
  private isPolling = false;

  subscribe(listener: RealtimeListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  async startPolling(apiClient: any) {
    if (this.isPolling) return;
    
    this.isPolling = true;
    console.log('🔄 Starting real-time notification polling...');

    this.pollingInterval = setInterval(async () => {
      try {
        // First, generate new notifications (checks for inventory changes)
        await apiClient.generateNotifications();
        
        // Then fetch updated notifications
        const response = await apiClient.getNotifications();
        
        if (response.success && Array.isArray(response.data)) {
          const currentNotifications = response.data;
          
          // Check for NEW notifications
          for (const notif of currentNotifications) {
            if (!this.lastFetchedNotifications.has(notif.NotificationID)) {
              // New notification detected!
              console.log('✨ New notification:', notif.Message);
              this.lastFetchedNotifications.set(notif.NotificationID, notif);
              
              // Notify all listeners
              this.listeners.forEach(listener => {
                listener.onNotificationAdded(notif);
              });
            }
          }
          
          // Check for REMOVED notifications
          const currentIds = new Set(currentNotifications.map(n => n.NotificationID));
          for (const [notifId] of this.lastFetchedNotifications) {
            if (!currentIds.has(notifId)) {
              console.log('❌ Notification removed:', notifId);
              this.lastFetchedNotifications.delete(notifId);
              
              this.listeners.forEach(listener => {
                listener.onNotificationRemoved(notifId);
              });
            }
          }
          
          // Also notify about full refresh
          this.listeners.forEach(listener => {
            listener.onNotificationsRefreshed(currentNotifications);
          });
        }

        // Fetch and monitor low stock items (quantity 1-10)
        try {
          const stockResponse = await apiClient.getStockEntries();
          if (stockResponse.success && Array.isArray(stockResponse.data)) {
            const lowStockProducts = stockResponse.data.filter((item: any) => {
              const qty = item.Quantity || 0;
              return qty >= 1 && qty <= 10;
            });

            // Notify listeners about low stock products
            this.listeners.forEach(listener => {
              if (listener.onLowStockChanged) {
                listener.onLowStockChanged(lowStockProducts);
              }
            });
          }
        } catch (error) {
          console.error('Error fetching low stock products:', error);
        }

      } catch (error) {
        console.error('Error in real-time notification polling:', error);
      }
    }, this.pollingInterval_ms);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
      console.log('⏹️  Stopped real-time notification polling');
    }
  }

  reset() {
    this.lastFetchedNotifications.clear();
    this.lastFetchedLowStockProducts.clear();
    this.stopPolling();
  }
}

export default new RealtimeNotificationService();
