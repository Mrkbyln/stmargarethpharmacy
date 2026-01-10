import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Type definitions for database tables
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'staff' | 'pharmacy_assistant';
  full_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  product_code: string;
  product_name: string;
  particulars?: string;
  brand_name?: string;
  category_id: number;
  category_name?: string;
  unit_price: number;
  selling_price: number;
  reorder_level: number;
  current_stock: number;
  is_active: boolean;
  date_added: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: number;
  sale_date: string;
  user_id: number;
  discount_id?: number;
  total_amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  subtotal: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  details?: string;
  table_name?: string;
  record_id?: number;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id?: number;
  type: 'expired' | 'expiring_soon' | 'low_stock' | 'no_stock' | 'system';
  title: string;
  message: string;
  related_product_id?: number;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}
