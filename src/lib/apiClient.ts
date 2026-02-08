import { apiFetch } from './api';

// Lightweight apiClient compatibility layer used by the app.
// Each method calls the underlying PHP endpoint (assumes filenames like receipts.php, products.php, users.php, etc.)

function qs(obj: any) {
  if (!obj) return '';
  return Object.keys(obj).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])).join('&');
}

const apiClient = {
  // Auth
  login: (username: string, password: string, role?: string) => apiFetch('login.php', { method: 'POST', body: JSON.stringify({ username, password, role }) }),
  sendVerificationCode: (email: string) => apiFetch('send_verification.php', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyResetCode: (email: string, code: string) => apiFetch('verify_reset.php', { method: 'POST', body: JSON.stringify({ email, code }) }),

  // Notifications
  getNotifications: () => apiFetch('notifications.php'),
  generateNotifications: () => apiFetch('generate_notifications.php'),
  markAllNotificationsAsRead: () => apiFetch('notifications_mark_all_read.php', { method: 'POST' }),
  markAllNotificationsAsUnread: () => apiFetch('notifications_mark_all_unread.php', { method: 'POST' }),
  markNotificationAsRead: (id: number) => apiFetch(`notifications_mark_read.php?id=${id}`, { method: 'POST' }),

  // Users
  getUsers: () => apiFetch('users.php'),
  createUser: (data: any) => apiFetch('users_create.php', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number, data: any) => apiFetch(`users_update.php?id=${id}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id: number, currentUserId?: number) => apiFetch(`users_delete.php?id=${id}`, { method: 'POST', body: JSON.stringify({ currentUserId }) }),

  // Products & inventory
  getProducts: (params?: any) => apiFetch(`products.php${params ? '?' + qs(params) : ''}`),
  createProduct: (data: any, userId?: number) => apiFetch('products_create.php', { method: 'POST', body: JSON.stringify({ ...data, userId }) }),
  updateProduct: (id: number, data: any, userId?: number) => apiFetch(`products_update.php?id=${id}`, { method: 'POST', body: JSON.stringify({ ...data, userId }) }),
  deleteProduct: (id: number) => apiFetch(`products_delete.php?id=${id}`, { method: 'POST' }),

  // Stock entries
  getStockEntries: () => apiFetch('stockentries.php'),
  addStockEntry: (data: any) => apiFetch('stockentries_create.php', { method: 'POST', body: JSON.stringify(data) }),
  updateStockEntry: (id: number, data: any) => apiFetch(`stockentries_update.php?id=${id}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteStockEntry: (id: number) => apiFetch(`stockentries_delete.php?id=${id}`, { method: 'POST' }),

  // Damaged / change items
  getDamagedItems: () => apiFetch('damageditems.php'),
  markItemsDamaged: (data: any) => apiFetch('damageditems_mark.php', { method: 'POST', body: JSON.stringify(data) }),
  getChangeItemHistory: () => apiFetch('changeitem.php'),
  createChangeItem: (data: any) => apiFetch('changeitem_create.php', { method: 'POST', body: JSON.stringify(data) }),

  // Sales / POS
  getSales: () => apiFetch('pos_sales.php'),
  getSaleItems: (saleId: number) => apiFetch(`pos_sales_items.php?sale_id=${saleId}`),
  createSale: (data: any) => apiFetch('pos_sales.php', { method: 'POST', body: JSON.stringify(data) }),
  getSalesForReturn: () => apiFetch('pos_sales_for_return.php'),

  // Receipts / transactions
  getAllTransactions: () => apiFetch('receipts.php'),

  // Reports
  getSalesSummary: (start: string, end: string) => apiFetch(`reports_sales_summary.php?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  getAuditLogs: () => apiFetch('auditlogs.php'),
  getInventory: (params?: any) => apiFetch(`inventory.php${params ? '?' + qs(params) : ''}`),
  getInventoryTransactions: (limit?: number) => apiFetch(`inventorytransactions.php${limit ? '?limit=' + limit : ''}`),
  getExpiredItems: () => apiFetch('expired_items.php'),
  getLowStockItems: () => apiFetch('low_stock.php'),

  // Categories, discounts
  getCategories: () => apiFetch('categories.php'),
  getDiscounts: () => apiFetch('discounts.php'),
  getAllDiscounts: () => apiFetch('discounts.php'),
  createDiscount: (data: any) => apiFetch('discounts_create.php', { method: 'POST', body: JSON.stringify(data) }),
  updateDiscount: (id: number, data: any) => apiFetch(`discounts_update.php?id=${id}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteDiscount: (id: number) => apiFetch(`discounts_delete.php?id=${id}`, { method: 'POST' }),

  // Settings & logs
  logAction: (action: string, userId?: number) => apiFetch('auditlogs_create.php', { method: 'POST', body: JSON.stringify({ action, userId }) }),

  // Misc
  verifyAdminPin: (pin: string) => apiFetch('verify_pin.php', { method: 'POST', body: JSON.stringify({ pin }) }),
  updateProfile: (data: any) => apiFetch('users_update_profile.php', { method: 'POST', body: JSON.stringify(data) }),
  updateProfileImage: (data: any) => apiFetch('users_update_profile_image.php', { method: 'POST', body: JSON.stringify(data) }),
  getInventoryTransactions: (limit?: number) => apiFetch(`inventorytransactions.php${limit ? '?limit=' + limit : ''}`),

};

export default apiClient;
