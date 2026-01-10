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
      const responseData = await response.json();

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
    return this.request<any>('/auth/login', 'POST', {
      username,
      password,
      role,
    });
  }

  async sendVerificationCode(email: string) {
    return this.request<any>('/auth/forgot-password', 'POST', {
      email,
    });
  }

  async verifyResetCode(email: string, code: string) {
    return this.request<any>('/auth/verify-code', 'POST', {
      email,
      code,
    });
  }

  async verifyAdminPin(pin: string) {
    return this.request<any>('/auth/verify-code', 'POST', {
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
    return this.request<any[]>(`/products/list${queryString ? `?${queryString}` : ''}`);
  }

  async createProduct(productData: any, currentUserId?: number) {
    return this.request<any>('/products/create', 'POST', { ...productData, currentUserId });
  }

  async updateProduct(productId: number, productData: any, currentUserId?: number) {
    return this.request<any>('/products/update', 'POST', {
      productId,
      ...productData,
      currentUserId,
    });
  }

  async getCategories() {
    return this.request<any[]>('/products/categories');
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
    return this.request<any>('/sales/create', 'POST', saleData);
  }

  async getSales(startDate?: string, endDate?: string) {
    let params = '';
    if (startDate && endDate) {
      params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    }
    return this.request<any[]>(`/sales/list${params}`);
  }

  async getAllTransactions() {
    return this.request<any[]>('/sales/get-all-transactions');
  }

  // Inventory endpoints
  async getInventory(options: { category?: string; date?: string; sortBy?: string; sortOrder?: string; } = {}) {
    const params = new URLSearchParams();
    if (options.category) params.append('category', options.category);
    if (options.date) params.append('date', options.date);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    
    const queryString = params.toString();
    return this.request<any[]>(`/inventory/list${queryString ? `?${queryString}` : ''}`);
  }

  async getLowStockItems() {
    return this.request<any[]>('/inventory/low-stock');
  }

  async getExpiredItems() {
    return this.request<any[]>('/inventory/expired');
  }

  async getExpiredProducts() {
    return this.request<any[]>('/reports/notifications?type=expired');
  }

  async getStockLevels() {
    return this.request<any[]>('/inventory/stock');
  }

  async getStockEntries() {
    return this.request<any[]>('/inventory/stock_entries');
  }

  async addStockEntry(stockData: {
    product_id: number;
    quantity: number | string;
    batchNumber?: string;
    expirationDate?: string;
  }) {
    return this.request<any>('/inventory/stock_entries', 'POST', stockData);
  }

  async updateStockEntry(stockEntryId: number, stockData: {
    quantity?: number | string;
    unitPrice?: number | string;
    expirationDate?: string;
  }) {
    return this.request<any>('/inventory/stock_entries', 'PUT', {
      id: stockEntryId,
      ...stockData
    });
  }

  async deleteStockEntry(stockEntryId: number) {
    return this.request<any>('/inventory/stock_entries', 'DELETE', {
      id: stockEntryId
    });
  }

  async deleteProduct(productId: number) {
    return this.request<any>('/products/delete', 'POST', {
      productId
    });
  }

  // Change Item endpoints
  async getSalesForReturn() {
    return this.request<any[]>('/sales/list');
  }

  async getSaleItems(saleId: number) {
    return this.request<any>(`/sales/list?saleId=${saleId}`);
  }

  async getChangeItemHistory() {
    return this.request<any[]>('/changeitem/list');
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
  }) {
    return this.request<any>('/changeitem/create', 'POST', changeData);
  }

  async getDamagedItems() {
    return this.request<any[]>('/inventory/damaged-items');
  }

  async markItemsDamaged(damageData: {
    stockEntryId: number;
    quantity: number;
    reason: string;
    replacementProduct?: string;
    currentUserId?: number | null;
  }) {
    return this.request<any>('/inventory/damaged-items', 'POST', damageData);
  }

  // Report endpoints
  async getSalesSummary(startDate?: string, endDate?: string) {
    let params = '';
    if (startDate && endDate) {
      params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    }
    return this.request<any>(`/reports/sales_summary${params}`);
  }

  async getAuditLogs(startDate?: string, endDate?: string) {
    let params = '';
    if (startDate && endDate) {
      params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    }
    return this.request<any[]>(`/reports/audit_logs${params}`);
  }

  async getInventoryLogs(startDate?: string, endDate?: string) {
    let params = '';
    if (startDate && endDate) {
      params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    }
    return this.request<any[]>(`/reports/inventory_logs${params}`);
  }

  async logAction(action: string, userId?: number) {
    const payload: any = { action };
    if (userId) {
      payload.userId = userId;
    }
    return this.request<any>('/reports/log_action', 'POST', payload);
  }

  // User endpoints
  async getUsers() {
    return this.request<any[]>('/users/list');
  }

  async createUser(userData: {
    username: string;
    password: string;
    email: string;
    role: string;
    fullName?: string;
    currentUserId?: number;
  }) {
    return this.request<any>('/users/create', 'POST', userData);
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
    return this.request<any>('/users/update', 'POST', { userId, ...userData });
  }

  async deleteUser(userId: number, currentUserId?: number) {
    return this.request<any>('/users/delete', 'POST', { userId, currentUserId });
  }

  async updateProfile(userData: {
    username?: string;
    email?: string;
    password?: string;
    userId?: string;
  }) {
    return this.request<any>('/users/profile', 'POST', userData);
  }

  async updateProfileImage(imageData: {
    userId: string;
    image: string; // Base64 encoded image
  }) {
    return this.request<any>('/users/update-profile-image', 'POST', imageData);
  }

  // Notification endpoints
  async getNotifications() {
    return this.request<any[]>('/reports/notifications', 'GET');
  }

  async getNotificationsByType(type: 'expired' | 'expiring_soon' | 'low_stock' | 'no_stock') {
    return this.request<any[]>(`/reports/notifications?type=${type}`, 'GET');
  }

  async getExpiredProducts() {
    return this.request<any[]>('/reports/notifications?type=expired', 'GET');
  }

  async generateNotifications() {
    return this.request<any>('/reports/notifications', 'POST', { action: 'generate' });
  }

  async markNotificationAsRead(notificationId: number) {
    return this.request<any>('/reports/notifications', 'PUT', { notificationId });
  }

  async markAllNotificationsAsRead() {
    return this.request<any>('/reports/notifications', 'PUT', { markAll: true });
  }

  async markAllNotificationsAsUnread() {
    return this.request<any>('/reports/notifications', 'PUT', { markAllUnread: true });
  }

  // Discount endpoints
  async getDiscounts() {
    // For POS - get only active discounts
    return this.request<any[]>('/discounts/list');
  }

  async getAllDiscounts() {
    // For admin management - get all discounts including inactive
    return this.request<any[]>('/discounts/all');
  }

  async getDiscount(discountId: number) {
    return this.request<any>(`/discounts/list?id=${discountId}`);
  }

  async createDiscount(discountData: {
    DiscountName: string;
    DiscountRate: number;
    IsActive?: number | boolean;
  }) {
    return this.request<any>('/discounts/create', 'POST', discountData);
  }

  async updateDiscount(discountId: number, discountData: {
    DiscountName?: string;
    DiscountRate?: number;
    IsActive?: number | boolean;
  }) {
    return this.request<any>(`/discounts/update?id=${discountId}`, 'PUT', discountData);
  }

  async deleteDiscount(discountId: number) {
    return this.request<any>(`/discounts/delete?id=${discountId}`, 'DELETE');
  }
}

export default new ApiClient();
