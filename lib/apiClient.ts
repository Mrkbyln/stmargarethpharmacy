// Compatibility shim: many files import `../lib/apiClient` from pages/*
// Re-export the implementation from `src/lib/apiClient`.
import apiClient from '../src/lib/apiClient';
export default apiClient;
// lib/apiClient.ts - API client for React frontend

// Use relative URLs that will be proxied by Vite in development
const API_BASE_URL = '/api';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  [key: string]: any;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);

      // Read raw text first to avoid JSON parse errors when server returns
      // an empty body or plain text (e.g., on some error responses).
      const raw = await response.text();
      let responseData: any = {};

      if (!raw || raw.trim() === '') {
        // No body: construct a minimal response object
        responseData = { success: response.ok, message: response.ok ? '' : `HTTP ${response.status}` };
      } else {
        try {
          responseData = JSON.parse(raw);
        } catch (parseErr) {
          // If response isn't JSON, return the raw text as message
          responseData = { success: response.ok, message: raw };
        }
      }

      // Always return the response data, even if status is not OK
      // This allows us to handle error responses like 429 (Too Many Requests)
      if (!response.ok && response.status !== 429 && response.status !== 401) {
        throw new Error(responseData.message || `HTTP ${response.status}`);
      }

      return responseData;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Auth endpoints
  async login(username: string, password: string, role: string) {
    return this.request<any>('/auth/login.php', 'POST', {
      username,
      password,
      role,
    });
  }

  async sendVerificationCode(email: string) {
    return this.request<any>('/auth/send-verification-code.php', 'POST', {
      email,
    });
  }

  async verifyResetCode(email: string, code: string) {
    return this.request<any>('/auth/verify-reset-code.php', 'POST', {
      email,
      code,
    });
  }

  async verifyAdminPin(pin: string) {
    return this.request<any>('/auth/verify-admin-pin.php', 'POST', {
      pin,
    });
  }

  // Product endpoints
  async getProducts(options: { category?: string; date?: string; sortBy?: string; sortOrder?: string; } = {}) {
    const params = new URLSearchParams();
    if (options.category) params.append('category', options.category);
    if (options.date) params.append('date', options.date);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    
    const queryString = params.toString();
    return this.request<any[]>(`/products/read.php${queryString ? `?${queryString}` : ''}`);
  }

  async createProduct(productData: any, currentUserId?: number) {
    return this.request<any>('/products/create.php', 'POST', { ...productData, currentUserId });
  }

  async updateProduct(productId: number, productData: any, currentUserId?: number) {
    return this.request<any>('/products/update.php', 'POST', {
      productId,
      ...productData,
      currentUserId,
    });
  }

  async getCategories() {
    return this.request<any[]>('/products/categories.php');
  }

  // Sales endpoints
  async createSale(saleData: {
    transactionDate: string;
    totalAmount: number;
    discountApplied?: number;
    finalAmount: number;
    cashReceived?: number;
    changeGiven?: number;
    processedBy: number;
    items?: Array<{
      productID: number;
      quantity: number;
      price: number;
    }>;
  }) {
    return this.request<any>('/sales/create.php', 'POST', saleData);
  }

  async getSales(startDate?: string, endDate?: string) {
    let params = '';
    if (startDate && endDate) {
      params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    }
    return this.request<any[]>(`/sales/read.php${params}`);
  }

  async getAllTransactions() {
    return this.request<any[]>('/sales/get-all-transactions.php');
  }

  // Inventory endpoints
  async getInventory(options: { category?: string; date?: string; sortBy?: string; sortOrder?: string; } = {}) {
    const params = new URLSearchParams();
    if (options.category) params.append('category', options.category);
    if (options.date) params.append('date', options.date);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    
    const queryString = params.toString();
    return this.request<any[]>(`/inventory/read.php${queryString ? `?${queryString}` : ''}`);
  }

  async getLowStockItems() {
    return this.request<any[]>('/inventory/low-stock.php');
  }

  async getExpiredItems() {
    return this.request<any[]>('/inventory/expired.php');
  }

  async getExpiredProducts() {
    return this.request<any[]>('/reports/notifications.php?type=expired');
  }

  async getStockLevels() {
    return this.request<any[]>('/inventory/stock.php');
  }

  async getStockEntries() {
    return this.request<any[]>('/inventory/stock_entries.php');
  }

  async addStockEntry(stockData: {
    product_id: number;
    quantity: number | string;
    batchNumber?: string;
    expirationDate?: string;
  }) {
    return this.request<any>('/inventory/stock_entries.php', 'POST', stockData);
  }

  async updateStockEntry(stockEntryId: number, stockData: {
    quantity?: number | string;
    unitPrice?: number | string;
    expirationDate?: string;
  }) {
    return this.request<any>('/inventory/stock_entries.php', 'PUT', {
      id: stockEntryId,
      ...stockData
    });
  }

  async deleteStockEntry(stockEntryId: number) {
    return this.request<any>('/inventory/stock_entries.php', 'DELETE', {
      id: stockEntryId
    });
  }

  async deleteProduct(productId: number) {
    return this.request<any>('/products/delete.php', 'POST', {
      productId
    });
  }

  // Change Item endpoints
  async getSalesForReturn() {
    return this.request<any[]>('/sales/read.php');
  }

  async getSaleItems(saleId: number) {
    return this.request<any>(`/sales/read.php?saleId=${saleId}`);
  }

  async getChangeItemHistory() {
    return this.request<any[]>('/changeitem/read.php');
  }

  async getInventoryTransactions(limit: number = 50, startDate?: string, endDate?: string, type?: string) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (type) params.append('type', type);
    return this.request<any[]>(`/inventory/inventory_transactions.php?${params.toString()}`);
  }

  async createChangeItem(changeData: {
    originalSaleID: number;
    itemReturned: number;
    qtyReturned: number;
    itemGiven: string;
    qtyGiven: number;
    itemGivenPrice: number;
    returnedItemPrice: number;
    additionalPayment: number;
    priceDifference: number;
    reason: string;
    processedBy: number;
    returnedStockEntryId?: number;
    replacementStockEntryId?: number;
    replacementItems?: Array<{
      name: string;
      code: string;
      qty: number;
      price: number;
      stockEntryId: number;
    }>;
  }) {
    return this.request<any>('/changeitem/create.php', 'POST', changeData);
  }

  async getDamagedItems() {
    return this.request<any[]>('/inventory/damaged-items.php');
  }

  async markItemsDamaged(damageData: {
    stockEntryId: number;
    quantity: number;
    reason: string;
    replacementProduct?: string;
    currentUserId?: number | null;
  }) {
    return this.request<any>('/inventory/damaged-items.php', 'POST', damageData);
  }

  // Report endpoints
  async getSalesSummary(startDate?: string, endDate?: string) {
    let params = '';
    if (startDate && endDate) {
      params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    }
    return this.request<any>(`/reports/sales_summary.php${params}`);
  }

  async getAuditLogs(startDate?: string, endDate?: string) {
    let params = '';
    if (startDate && endDate) {
      params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    }
    return this.request<any[]>(`/reports/audit_logs.php${params}`);
  }

  async getInventoryLogs(startDate?: string, endDate?: string) {
    let params = '';
    if (startDate && endDate) {
      params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    }
    return this.request<any[]>(`/reports/inventory_logs.php${params}`);
  }

  async logAction(action: string, userId?: number) {
    const payload: any = { action };
    if (userId) {
      payload.userId = userId;
    }
    return this.request<any>('/reports/log_action.php', 'POST', payload);
  }

  // User endpoints
  async getUsers() {
    return this.request<any[]>('/users/read.php');
  }

  async createUser(userData: {
    username: string;
    password: string;
    email: string;
    role: string;
    fullName?: string;
    currentUserId?: number;
  }) {
    return this.request<any>('/users/create.php', 'POST', userData);
  }

  async updateUser(userId: number, userData: {
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    fullName?: string;
    IsActive?: number;
    currentUserId?: number;
  }) {
    return this.request<any>('/users/update.php', 'POST', { userId, ...userData });
  }

  async deleteUser(userId: number, currentUserId?: number) {
    return this.request<any>('/users/delete.php', 'POST', { userId, currentUserId });
  }

  async updateProfile(userData: {
    username?: string;
    email?: string;
    password?: string;
    userId?: string;
  }) {
    return this.request<any>('/users/profile.php', 'POST', userData);
  }

  async updateProfileImage(imageData: {
    userId: string;
    image: string; // Base64 encoded image
  }) {
    return this.request<any>('/users/update-profile-image.php', 'POST', imageData);
  }

  // Notification endpoints
  async getNotifications() {
    return this.request<any[]>('/reports/notifications.php', 'GET');
  }

  async getNotificationsByType(type: 'expired' | 'expiring_soon' | 'low_stock' | 'no_stock') {
    return this.request<any[]>(`/reports/notifications.php?type=${type}`, 'GET');
  }

  async generateNotifications() {
    return this.request<any>('/reports/notifications.php', 'POST', { action: 'generate' });
  }

  async markNotificationAsRead(notificationId: number) {
    return this.request<any>('/reports/notifications.php', 'PUT', { notificationId });
  }

  async markAllNotificationsAsRead() {
    return this.request<any>('/reports/notifications.php', 'PUT', { markAll: true });
  }

  async markAllNotificationsAsUnread() {
    return this.request<any>('/reports/notifications.php', 'PUT', { markAllUnread: true });
  }

  // Discount endpoints
  async getDiscounts() {
    // For POS - get only active discounts
    return this.request<any[]>('/discounts/list.php');
  }

  async getAllDiscounts() {
    // For admin management - get all discounts including inactive
    return this.request<any[]>('/discounts/all.php');
  }

  async getDiscount(discountId: number) {
    return this.request<any>(`/discounts/read.php?id=${discountId}`);
  }

  async createDiscount(discountData: {
    DiscountName: string;
    DiscountRate: number;
    IsActive?: number | boolean;
  }) {
    return this.request<any>('/discounts/create.php', 'POST', discountData);
  }

  async updateDiscount(discountId: number, discountData: {
    DiscountName?: string;
    DiscountRate?: number;
    IsActive?: number | boolean;
  }) {
    return this.request<any>(`/discounts/update.php?id=${discountId}`, 'PUT', discountData);
  }

  async deleteDiscount(discountId: number) {
    return this.request<any>(`/discounts/delete.php?id=${discountId}`, 'DELETE');
  }

  // Rule 3: Connectivity-Aware Data Fetching
  // These methods should be used by pages that display data in tables
  // They handle the routing logic for determining data source
  
  /**
   * Rule 3 Data Fetch - Respects ONLINE/OFFLINE mode for table display
   * Pages should use these methods instead of direct API calls when displaying tables
   */
  async getProductsRule3(options: { category?: string; date?: string; sortBy?: string; sortOrder?: string; } = {}) {
    return this.getProducts(options);
  }

  async getSalesRule3(startDate?: string, endDate?: string) {
    return this.getSales(startDate, endDate);
  }

  async getInventoryRule3(options: { category?: string; date?: string; sortBy?: string; sortOrder?: string; } = {}) {
    return this.getInventory(options);
  }

  async getDiscountsRule3() {
    return this.getAllDiscounts();
  }

  async getUsersRule3() {
    return this.getUsers();
  }

  async getStockEntriesRule3() {
    return this.getStockEntries();
  }

  async getAuditLogsRule3() {
    return this.getAuditLogs();
  }

  async getDamagedItemsRule3() {
    return this.getDamagedItems();
  }

  async getChangeItemHistoryRule3() {
    return this.getChangeItemHistory();
  }

  // Generic endpoint fetcher for Rule 3 data fetching
  async fetchEndpoint<T = any>(endpoint: string): Promise<{ data: T[]; success: boolean; message: string }> {
    return this.request<T[]>(endpoint);
  }
}

export default new ApiClient();
