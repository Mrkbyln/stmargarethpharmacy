export interface User {
  UserID?: string | number;
  id?: string | number; // Fallback for local storage
  Username?: string;
  username?: string;
  Role?: 'Admin' | 'Staff' | 'admin' | 'staff' | 'pharmacy_assistant';
  role?: 'Admin' | 'Staff' | 'admin' | 'staff' | 'pharmacy_assistant';
  Password?: string;
  password?: string;
  FullName?: string;
  fullName?: string;
  Email?: string;
  email?: string;
  CanModifyPassword?: number | boolean;
  canModifyPassword?: number | boolean;
  IsActive?: number | boolean;
  isActive?: number | boolean;
  DateCreated?: string;
  dateCreated?: string;
}

export interface Medicine {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_qty: number;
  expiry_date: string; // YYYY-MM-DD
  // Additional fields from Products table
  ProductID?: number;
  ProductCode?: string;
  Particulars?: string;
  BrandName?: string;
  CategoryName?: string;
  Description?: string;
  SellingPrice?: number;
  ReorderLevel?: number | string;
  Barcode?: string | number;
  DateAdded?: string;
}

export interface Discount {
  DiscountID?: number;
  id?: number;
  DiscountName: string;
  DiscountRate: number;
  IsActive: number | boolean;
}

export interface CartItem extends Medicine {
  quantity: number;
  discountId?: number;
  discountRate?: number;
  StockEntryID?: number;  // Track individual batch entries
  BatchNumber?: string;   // Track batch number for display
  ExpirationDate?: string; // Track expiration date for batch
}

export interface SaleItem {
  id: string;
  medicine_id: string;
  medicine_name: string;
  quantity: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  total_amount: number;
  sale_date: string;
  items: SaleItem[];
}

export interface DashboardStats {
  totalMedicines: number;
  todaySales: number;
  lowStockCount: number;
  expiredCount: number;
}

export interface AuditLog {
  id: string | number;
  action: string;
  details?: string;
  user: string;
  timestamp: string;
  role?: string;
  username?: string;
  userId?: number;
}
