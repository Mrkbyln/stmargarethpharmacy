
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Medicine, Sale, User, CartItem, SaleItem, AuditLog } from '../types';
import apiClient from '../lib/apiClient';
import realtimeNotificationService from '../lib/realtimeNotificationService';
import { fetchMedicines, fetchSales, fetchUsers, fetchAuditLogs, fetchLowStockItems, fetchExpiredItems } from '../lib/dataFetcher';
import { connectivityService } from '../lib/connectivityService';
import { syncQueue } from '../lib/syncQueue';
import { getPhilippineTimestamp } from '../lib/timezoneHelper';
import {
  saveProductToSupabase,
  saveSaleToSupabase,
  saveSaleTransactionToSupabase,
  saveUserToSupabase,
  saveAuditLogToSupabase,
  saveStockEntryToSupabase,
  updateStockEntryInSupabase,
  saveDamagedItemToSupabase,
  saveChangeItemToSupabase,
  saveInventoryTransactionToSupabase,
  deleteProductFromSupabase,
  updateProductInSupabase,
  saveSettingToSupabase,
  saveNotificationToSupabase,
  markNotificationAsReadInSupabase,
} from '../lib/supabaseOperations';

interface PharmacyContextType {
  user: User | null;
  registeredUsers: User[];
  medicines: Medicine[];
  sales: Sale[];
  lowStockItems: Medicine[];
  expiredItems: Medicine[];
  auditLogs: AuditLog[];
  notifications: any[];
  unreadNotificationCount: number;
  currencySymbol: string;
  themeColor: string;
  fontFamily: string;
  pharmacyName: string;
  readNotificationIds: string[];
  isSidebarCollapsed: boolean;
  getRoleBadgeColor: (role: string) => string;
  login: (user: User) => void;
  logout: () => void;
  addMedicine: (medicine: Omit<Medicine, 'id'>) => void;
  updateMedicine: (id: string, updates: Partial<Medicine>) => void;
  updateStock: (id: string, newQty: number) => void;
  processSale: (cartItems: CartItem[]) => void;
  deleteMedicine: (id: string) => void;
  updateSettings: (settings: { currencySymbol?: string; themeColor?: string; fontFamily?: string; pharmacyName?: string }) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  removeUser: (id: string) => void;
  markAllAsRead: () => void;
  markAllAsUnread: () => void;
  markNotificationAsRead: (notificationId: number) => void;
  addAuditLog: (action: string, details: string) => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  updateCurrentUser: (updates: Partial<User>) => void;
  refreshUserProfile: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

export const PharmacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pharmacy_user');
    return saved ? JSON.parse(saved) : null;
  });

  // User Management State
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('pharmacy_users');
    return saved ? JSON.parse(saved) : [
      { id: '1', username: 'admin', password: 'admin123', role: 'admin', email: 'admin@pharmacy.com' },
      { id: '2', username: 'staff', password: 'staff123', role: 'staff', email: 'staff@pharmacy.com' }
    ];
  });

  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem('pharmacy_medicines');
    return saved ? JSON.parse(saved) : [];
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('pharmacy_sales');
    return saved ? JSON.parse(saved) : [];
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('pharmacy_audit_logs');
    return saved ? JSON.parse(saved) : [
      { id: '1', action: 'System Init', details: 'System initialized', user: 'System', role: 'admin', timestamp: new Date().toLocaleString() }
    ];
  });

  const [currencySymbol, setCurrencySymbol] = useState<string>(() => {
    return localStorage.getItem('pharmacy_currency') || '₱';
  });

  const [themeColor, setThemeColor] = useState<string>(() => {
    return localStorage.getItem('pharmacy_theme_color') || 'amber';
  });

  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem('pharmacy_font_family') || 'font-nunito';
  });

  const [pharmacyName, setPharmacyName] = useState<string>(() => {
    return localStorage.getItem('pharmacy_name') || 'St. Margareth Pharmacy';
  });

    const [isSidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('pharmacy_sidebar_collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Notification Read State
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('pharmacy_read_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);

  const unreadNotificationCount = useMemo(() => {
    const count = notifications.filter(n => {
      const isRead = parseInt(n.IsRead, 10);
      return isRead === 0;
    }).length;
    if (count > 0) {
      console.log('📢 Unread notification count:', count);
    }
    return count;
  }, [notifications]);

  // Derived state for alerts
  const lowStockItems = useMemo(() => {
    return medicines.filter(m => m.stock_qty < 10);
  }, [medicines]);

  const expiredItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const expired = medicines.filter(m => {
      // Handle both API response formats (expiry_date and expirationDate)
      const expiryDate = m.expiry_date || (m as any).ExpirationDate;
      
      if (!expiryDate) {
        return false;
      }
      
      const itemDate = new Date(expiryDate);
      itemDate.setHours(0, 0, 0, 0);
      const isExpired = itemDate < today;
      
      return isExpired;
    });
    
    return expired;
  }, [medicines]);

  // Persist data
  useEffect(() => {
    localStorage.setItem('pharmacy_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('pharmacy_users', JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  useEffect(() => {
    localStorage.setItem('pharmacy_medicines', JSON.stringify(medicines));
  }, [medicines]);

  useEffect(() => {
    localStorage.setItem('pharmacy_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('pharmacy_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('pharmacy_currency', currencySymbol);
  }, [currencySymbol]);

  useEffect(() => {
    localStorage.setItem('pharmacy_theme_color', themeColor);
  }, [themeColor]);

  useEffect(() => {
    localStorage.setItem('pharmacy_font_family', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem('pharmacy_name', pharmacyName);
  }, [pharmacyName]);

    useEffect(() => {
    localStorage.setItem('pharmacy_sidebar_collapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('pharmacy_read_notifications', JSON.stringify(readNotificationIds));
  }, [readNotificationIds]);


  const fetchNotifications = async () => {
    try {
      // Fetch all existing notifications from database
      const res = await apiClient.getNotifications();
      if (res.success && Array.isArray(res.data)) {
        // Ensure IsRead is always a number for consistent comparison
        const normalizedData = res.data.map((n: any) => ({
          ...n,
          IsRead: parseInt(n.IsRead, 10) // Convert to integer
        }));
        setNotifications(normalizedData);
        const unreadCount = normalizedData.filter((n: any) => n.IsRead === 0).length;
        console.log('✓ Fetched', normalizedData.length, 'notifications,', unreadCount, 'unread');
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const refreshNotificationsWithGeneration = async () => {
    try {
      console.log('🔄 Starting notification refresh with generation...');
      
      // Generate new notifications based on current inventory conditions
      const genRes = await apiClient.generateNotifications();
      console.log('✓ Generation completed:', genRes);
      
      if (!genRes.success) {
        console.warn('⚠️ Generation returned non-success:', genRes.message);
      }
      
      // Small delay to ensure DB is updated
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Then fetch all notifications
      console.log('📡 Fetching notifications after generation...');
      await fetchNotifications();
    } catch (error) {
      console.error('❌ Failed to refresh notifications:', error);
    }
  };

  // Fetch real data from API on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🔄 Loading pharmacy data...');
        const status = connectivityService.getStatus();
        console.log(`📡 Online status: ${status.isOnline ? '🟢 ONLINE (using Supabase)' : '🔴 OFFLINE (using Local API)'}`);

        // Fetch medicines - uses Supabase if online, fallback to local API
        const medicinesData = await fetchMedicines();
        if (medicinesData.length > 0) {
          const productsData: Medicine[] = medicinesData.map((item: any) => ({
            id: String(item.id || item.ProductID),
            name: item.name || item.ProductName,
            category: item.category || item.CategoryName || item.CategoryCode,
            price: parseFloat(item.price || item.UnitPrice) || 0,
            stock_qty: parseInt(item.quantity || item.stock_qty || item.CurrentStock) || 0,
            expiry_date: item.expiry_date || item.ExpiryDate || ''
          }));
          setMedicines(productsData);
        }

        // Fetch sales - uses Supabase if online, fallback to local API
        const salesData = await fetchSales();
        if (salesData.length > 0) {
          setSales(salesData);
        }

        // Fetch users - uses Supabase if online, fallback to local API
        const usersData = await fetchUsers();
        if (usersData.length > 0) {
          const userData: User[] = usersData.map((item: any) => ({
            id: String(item.id || item.UserID),
            username: item.username || item.Username,
            role: (item.role === 'Admin' || item.role === 'admin' || item.Role === 'Admin') ? 'admin' : 'staff',
            email: item.email || item.Email,
            fullName: item.fullName || item.FullName,
            isActive: item.isActive !== false && item.IsActive !== false
          }));
          setRegisteredUsers(userData);
        }

        // Fetch audit logs - uses Supabase if online, fallback to local API
        const logsData = await fetchAuditLogs();
        if (logsData.length > 0) {
          const auditData: AuditLog[] = logsData.map((item: any) => ({
            id: String(item.id || item.LogID || item.log_id),
            action: item.action_performed || item.action || item.ActionPerformed,
            user: item.user_name || item.username || item.user || item.Username || 'System',
            role: item.user_role || item.role || item.Role || '',
            timestamp: item.timestamp || item.created_at || item.Timestamp,
            userId: item.user_id || item.userId || item.UserID
          }));
          setAuditLogs(auditData);
        }

        // Fetch notifications
        await refreshNotificationsWithGeneration();
        
        console.log('✅ All pharmacy data loaded successfully');
      } catch (error) {
        console.error('Failed to fetch data:', error);
        // Keep existing state on error (fallback to localStorage or initial data)
      }
    };

    fetchData();
    
    // Refetch data when connectivity changes (online/offline)
    const unsubscribe = connectivityService.subscribe((status) => {
      console.log(`🔄 Connectivity changed: ${status.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'} - Reloading data...`);
      
      // If going online, trigger sync queue retry for any queued operations
      if (status.isOnline && status.useSupabase) {
        console.log('🌐 Back online! Auto-syncing queued changes to Supabase...');
        syncQueue.retryAll(); // Retry all queued items
      }
      
      fetchData();
    });

    return () => unsubscribe();

    // Set up REAL-TIME notifications (every 3 seconds for instant updates)
    realtimeNotificationService.startPolling(apiClient);

    return () => {
      realtimeNotificationService.stopPolling();
    };
  }, []);

  // Subscribe to real-time notification updates
  useEffect(() => {
    const unsubscribe = realtimeNotificationService.subscribe({
      onNotificationAdded: (notification: any) => {
        console.log('🆕 Real-time notification added:', notification.Message);
        setNotifications(prev => {
          // Check if notification already exists
          const exists = prev.some(n => n.NotificationID === notification.NotificationID);
          if (exists) return prev;
          
          // Add new notification to the beginning
          return [notification, ...prev];
        });
      },
      onNotificationRemoved: (notificationId: number) => {
        console.log('🗑️  Real-time notification removed:', notificationId);
        setNotifications(prev => prev.filter(n => n.NotificationID !== notificationId));
      },
      onNotificationsRefreshed: (allNotifications: any[]) => {
        // Update all notifications (full refresh)
        const normalizedData = allNotifications.map((n: any) => ({
          ...n,
          IsRead: parseInt(n.IsRead, 10)
        }));
        setNotifications(normalizedData);
      },
    });

    return () => unsubscribe();
  }, []);

  // Helper to add log
  const addAuditLog = useCallback((action: string, details: string) => {
    const newLog: AuditLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      action,
      details,
      user: user?.username || 'System',
      role: user?.role || 'system',
      timestamp: new Date().toLocaleString()
    };
    setAuditLogs(prev => [newLog, ...prev]);
    
    // Save to Supabase if online - format: "action: username"
    const supabaseLog = {
      user_id: user?.id ? parseInt(user.id) : 1,
      action_performed: `${action}: ${user?.username || 'System'}`,
      timestamp: getPhilippineTimestamp()
    };
    saveAuditLogToSupabase(supabaseLog);
  }, [user]);

  const login = (userData: User) => {
    setUser(userData);
    // Directly using the userData passed in because state 'user' won't update immediately
    const newLog: AuditLog = {
      id: Date.now().toString(),
      action: 'User Login',
      details: `${userData.username} logged in successfully`,
      user: userData.username,
      role: userData.role,
      timestamp: new Date().toLocaleString()
    };
    setAuditLogs(prev => [newLog, ...prev]);
    
    // Save login to Supabase if online - format: "User Login: username"
    // Use Philippine time for consistent timestamps
    const supabaseLog = {
      user_id: userData.id ? parseInt(userData.id) : 1,
      action_performed: `User Login: ${userData.username}`,
      timestamp: getPhilippineTimestamp()
    };
    saveAuditLogToSupabase(supabaseLog);
  };

  const logout = useCallback(() => {
    if (user) {
        // Format action with username: "User Logout: username"
        addAuditLog('User Logout', `${user.username} logged out`);
    }
    setUser(null);
  }, [user, addAuditLog]);

  const updateCurrentUser = (updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const refreshUserProfile = async () => {
    if (user?.id) {
      try {
        const response = await apiClient.getUsers();
        if (response.success && response.data) {
          const updatedUser = response.data.find((u: any) => u.UserID === user.id);
          if (updatedUser) {
            // Normalize role to lowercase for consistency
            let normalizedRole = updatedUser.Role ? updatedUser.Role.toLowerCase().replace(/\s+/g, '_') : user.role;
            
            setUser(prev => prev ? { 
              ...prev, 
              username: updatedUser.Username,
              email: updatedUser.Email,
              role: normalizedRole as 'admin' | 'pharmacy_assistant'
            } : null);
          }
        }
      } catch (error) {
        console.error('Failed to refresh user profile:', error);
      }
    }
  };

  const addUser = (userData: Omit<User, 'id'>) => {
    const newUser = { ...userData, id: Date.now().toString() };
    setRegisteredUsers([...registeredUsers, newUser]);
    
    // Save to Supabase if online
    const supabaseUser = {
      user_id: parseInt(newUser.id),
      username: userData.username,
      password: userData.password,
      role: userData.role === 'admin' ? 'Admin' : 'Pharmacy Assistant',
      full_name: userData.fullName || userData.username,
      email: userData.email,
      is_active: true,
      date_created: new Date().toISOString(),
    };
    saveUserToSupabase(supabaseUser);
    
    addAuditLog('User Created', `Created new user: ${userData.username} (${userData.role})`);
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setRegisteredUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    if (user && user.id === id) {
      setUser(prev => prev ? { ...prev, ...updates } : null);
    }
    
    // Update in Supabase if online
    const supabaseUpdates: any = {};
    if (updates.username) supabaseUpdates.username = updates.username;
    if (updates.fullName) supabaseUpdates.full_name = updates.fullName;
    if (updates.email) supabaseUpdates.email = updates.email;
    if (updates.role) supabaseUpdates.role = updates.role === 'admin' ? 'Admin' : 'Pharmacy Assistant';
    
    if (Object.keys(supabaseUpdates).length > 0) {
      saveUserToSupabase({ user_id: parseInt(id), ...supabaseUpdates });
    }
    
    addAuditLog('Profile Update', `User updated profile details`);
  };

  const removeUser = (id: string) => {
    const userToRemove = registeredUsers.find(u => u.id === id);
    setRegisteredUsers(registeredUsers.filter(u => u.id !== id));
    
    // Soft delete in Supabase if online
    saveUserToSupabase({ user_id: parseInt(id), is_active: false });
    
    addAuditLog('User Deleted', `Deleted user: ${userToRemove?.username || id}`);
  };

  const addMedicine = (medData: Omit<Medicine, 'id'>) => {
    const newMed: Medicine = {
      ...medData,
      id: Date.now().toString(),
    };
    setMedicines([...medicines, newMed]);
    
    // Save to Supabase if online
    const supabaseProduct = {
      product_id: parseInt(newMed.id),
      product_name: newMed.name,
      category_code: medData.category || 'MISC',
      selling_price: medData.price,
      remarks: medData.category,
      is_active: true,
      date_added: new Date().toISOString(),
    };
    saveProductToSupabase(supabaseProduct);
    
    addAuditLog('Inventory Add', `Added new medicine: ${medData.name}`);
  };

  const updateMedicine = (id: string, updates: Partial<Medicine>) => {
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    
    // Update in Supabase if online
    const supabaseUpdates: any = {};
    if (updates.name) supabaseUpdates.product_name = updates.name;
    if (updates.price) supabaseUpdates.selling_price = updates.price;
    if (updates.category) supabaseUpdates.category_code = updates.category;
    
    if (Object.keys(supabaseUpdates).length > 0) {
      updateProductInSupabase(parseInt(id), supabaseUpdates);
    }
    
    const medName = medicines.find(m => m.id === id)?.name || 'Item';
    addAuditLog('Inventory Update', `Updated details for: ${medName}`);
  };

  const updateStock = (id: string, newQty: number) => {
    const med = medicines.find(m => m.id === id);
    const oldQty = med ? med.stock_qty : 0;
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, stock_qty: newQty } : m));
    
    // Save stock transaction to Supabase if online
    const transaction = {
      transaction_type: 'STOCK_ADJUSTMENT',
      quantity: newQty - oldQty,
      date_added: new Date().toISOString(),
      stock_entry_id: parseInt(id),
      processed_by: user?.id ? parseInt(user.id) : 0,
      reason: `Stock adjustment from ${oldQty} to ${newQty}`,
    };
    saveInventoryTransactionToSupabase(transaction);
    
    addAuditLog('Stock Adjustment', `Adjusted stock for ${med?.name}: ${oldQty} -> ${newQty}`);
  };

  const deleteMedicine = (id: string) => {
    const med = medicines.find(m => m.id === id);
    setMedicines(prev => prev.filter(m => m.id !== id));
    
    // Delete from Supabase if online (soft delete)
    deleteProductFromSupabase(parseInt(id));
    
    addAuditLog('Inventory Delete', `Deleted medicine: ${med?.name || id}`);
  };

  const updateSettings = (settings: { currencySymbol?: string; themeColor?: string; fontFamily?: string; pharmacyName?: string }) => {
    if (settings.currencySymbol) {
      setCurrencySymbol(settings.currencySymbol);
      saveSettingToSupabase('currency_symbol', settings.currencySymbol);
    }
    if (settings.themeColor) {
      setThemeColor(settings.themeColor);
      saveSettingToSupabase('theme_color', settings.themeColor);
    }
    if (settings.fontFamily) {
      setFontFamily(settings.fontFamily);
      saveSettingToSupabase('font_family', settings.fontFamily);
    }
    if (settings.pharmacyName) {
      setPharmacyName(settings.pharmacyName);
      saveSettingToSupabase('pharmacy_name', settings.pharmacyName);
    }
    addAuditLog('Settings Update', 'System settings modified');
  };

  const processSale = (cartItems: CartItem[]) => {
    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const saleItems: SaleItem[] = cartItems.map(item => ({
      id: Math.random().toString(36).substr(2, 9),
      medicine_id: item.id,
      medicine_name: item.name,
      quantity: item.quantity,
      subtotal: item.price * item.quantity
    }));

    const newSale: Sale = {
      id: Date.now().toString(),
      total_amount: totalAmount,
      sale_date: new Date().toISOString(),
      items: saleItems
    };

    setSales(prev => [newSale, ...prev]);

    setMedicines(prev => prev.map(med => {
      const cartItem = cartItems.find(c => c.id === med.id);
      if (cartItem) {
        return { ...med, stock_qty: med.stock_qty - cartItem.quantity };
      }
      return med;
    }));

    // Save sale to Supabase if online
    const supabaseSale = {
      sale_id: parseInt(newSale.id),
      transaction_date: new Date().toISOString(),
      total_amount: totalAmount,
      discount: 0,
      final_amount: totalAmount,
      cash_received: totalAmount,
      change_given: 0,
      processed_by: user?.UserID ? Number(user.UserID) : (user?.id ? Number(user.id) : 1),
      discount_type: 'NONE',
    };
    saveSaleToSupabase(supabaseSale);

    // Save individual sale items to Supabase if online
    const supabaseSaleItems = cartItems.map(item => ({
      sale_id: parseInt(newSale.id),
      product_id: parseInt(item.id),
      quantity_sold: item.quantity,
      selling_price: item.price,
      total_amount_sold: item.price * item.quantity,
      processed_by: user?.UserID ? Number(user.UserID) : (user?.id ? Number(user.id) : 1),
    }));
    saveSaleTransactionToSupabase(supabaseSaleItems);

    // Only save to local backend if OFFLINE
    if (!connectivityService.shouldUseSupabase()) {
      apiClient.createSale({
        transactionDate: new Date().toISOString(),
        totalAmount,
        finalAmount: totalAmount,
        processedBy: user?.UserID ? Number(user.UserID) : (user?.id ? Number(user.id) : 1),
        items: cartItems.map(item => ({
          productID: parseInt(item.id),
          quantity: item.quantity,
          price: item.price
        }))
      }).catch(error => {
        console.error('Failed to save sale to backend:', error);
      });
    }

    // Audit Log for POS
    const itemSummary = cartItems.map(i => `${i.name} (x${i.quantity})`).join(', ');
    addAuditLog('POS Sale', `Sold ${cartItems.length} unique items. Total: ${currencySymbol}${totalAmount.toFixed(2)}. Items: ${itemSummary}`);
  };

  const markAllAsRead = () => {
    // Optimistic update - update UI immediately
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, IsRead: 1 }))
    );
    
    // Then persist to server
    apiClient.markAllNotificationsAsRead().then((apiResponse) => {
      console.log('markAllNotificationsAsRead API Response:', apiResponse);
      // Just log success, keep the optimistic update
    }).catch(err => {
      console.error('Error marking all notifications as read:', err);
      // Revert optimistic update on error by refreshing from server
      apiClient.getNotifications().then(res => {
        if (res.success && Array.isArray(res.data)) {
          setNotifications(res.data);
        }
      });
    });
  };

  const markAllAsUnread = () => {
    // Optimistic update - update UI immediately
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, IsRead: 0 }))
    );
    
    // Then persist to server
    apiClient.markAllNotificationsAsUnread().then((apiResponse) => {
      console.log('markAllNotificationsAsUnread API Response:', apiResponse);
      // Just log success, keep the optimistic update
    }).catch(err => {
      console.error('Error marking all notifications as unread:', err);
      // Revert optimistic update on error by refreshing from server
      apiClient.getNotifications().then(res => {
        if (res.success && Array.isArray(res.data)) {
          setNotifications(res.data);
        }
      });
    });
  };

  const markNotificationAsRead = (notificationId: number) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.NotificationID === notificationId ? { ...notif, IsRead: 1 } : notif
      )
    );
    
    // Also call the API to persist the change
    apiClient.markNotificationAsRead(notificationId).catch(err => {
      console.error('Error marking notification as read:', err);
    });
    
    // Also save to Supabase
    markNotificationAsReadInSupabase(notificationId).catch(err => {
      console.error('Error marking notification as read in Supabase:', err);
    });
  };

  // Helper function to get role badge color based on theme and role
  const getRoleBadgeColor = (role: string) => {
    if (role === 'Admin') {
      // Admin uses the theme color
      const themeColorMap: { [key: string]: string } = {
        'amber': 'bg-amber-100 text-amber-700',
        'teal': 'bg-teal-100 text-teal-700',
        'blue': 'bg-blue-100 text-blue-700',
        'rose': 'bg-rose-100 text-rose-700',
        'emerald': 'bg-emerald-100 text-emerald-700',
        'black': 'bg-gray-900 text-white'
      };
      return themeColorMap[themeColor] || 'bg-amber-100 text-amber-700';
    } else if (role === 'Manager') {
      return 'bg-blue-100 text-blue-700';
    } else if (role === 'Pharmacist') {
      return 'bg-green-100 text-green-700';
    } else if (role === 'Cashier') {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <PharmacyContext.Provider value={{ 
      user, 
      registeredUsers,
      medicines, 
      sales, 
      lowStockItems, 
      expiredItems, 
      auditLogs,
      notifications,
      unreadNotificationCount,
      currencySymbol,
      themeColor,
      fontFamily,
      pharmacyName,
      readNotificationIds,
      isSidebarCollapsed,
      getRoleBadgeColor,
      login, 
      logout, 
      addMedicine, 
      updateMedicine,
      updateStock, 
      processSale, 
      deleteMedicine,
      updateSettings,
      addUser,
      updateUser,
      removeUser,
      markAllAsRead,
      markAllAsUnread,
      markNotificationAsRead,
      addAuditLog,
      setSidebarCollapsed,
      updateCurrentUser,
      refreshUserProfile,
      fetchNotifications
    }}>
      {children}
    </PharmacyContext.Provider>
  );
};

export const usePharmacy = () => {
  const context = useContext(PharmacyContext);
  if (!context) throw new Error("usePharmacy must be used within PharmacyProvider");
  return context;
};

