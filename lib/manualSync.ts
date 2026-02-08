/**
 * Manual Sync from Local XAMPP to Supabase
 * 
 * Use this to initially populate Supabase tables with data from local XAMPP
 * Call in browser console: import { syncLocalToSupabase } from './lib/manualSync'
 */

import apiClient from './apiClient';
import { supabase } from './supabaseClient';

export async function syncLocalToSupabase() {
  console.log('🔄 Starting manual sync from XAMPP to Supabase...\n');

  const syncResults: Record<string, any> = {};

  // 1. Sync Products
  try {
    console.log('📦 Syncing products...');
    const productsResponse = await apiClient.getProducts();
    const products = productsResponse.data || [];
    
    if (products.length > 0) {
      // Map local fields to Supabase fields
      const mappedProducts = products.map((p: any) => ({
        product_id: parseInt(p.id || p.ProductID),
        name: p.name || p.ProductName,
        category: p.category || p.CategoryName,
        price: parseFloat(p.price || p.UnitPrice),
        quantity: parseInt(p.quantity || p.CurrentStock || 0),
        expiry_date: p.expiry_date || p.ExpirationDate || null,
      }));

      const { data, error } = await supabase
        .from('products')
        .upsert(mappedProducts, { onConflict: 'product_id' });

      if (error) throw error;
      syncResults.products = { success: true, count: mappedProducts.length };
      console.log(`✅ Synced ${mappedProducts.length} products`);
    } else {
      console.log('⚠️  No products to sync');
      syncResults.products = { success: true, count: 0 };
    }
  } catch (error) {
    syncResults.products = { success: false, error: String(error) };
    console.error('❌ Failed to sync products:', error);
  }
  console.log();

  // 2. Sync Sales
  try {
    console.log('💰 Syncing sales...');
    const salesResponse = await apiClient.getSales();
    const sales = salesResponse.data || [];
    
    if (sales.length > 0) {
      const mappedSales = sales.map((s: any) => ({
        sale_id: parseInt(s.id || s.SaleID),
        total_amount: parseFloat(s.total_amount || s.TotalAmount || 0),
        discount_applied: parseFloat(s.discount_applied || s.DiscountApplied || 0),
        final_amount: parseFloat(s.final_amount || s.FinalAmount || 0),
        sale_date: s.sale_date || s.TransactionDate || new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('pos_sales')
        .upsert(mappedSales, { onConflict: 'sale_id' });

      if (error) throw error;
      syncResults.sales = { success: true, count: mappedSales.length };
      console.log(`✅ Synced ${mappedSales.length} sales`);
    } else {
      console.log('⚠️  No sales to sync');
      syncResults.sales = { success: true, count: 0 };
    }
  } catch (error) {
    syncResults.sales = { success: false, error: String(error) };
    console.error('❌ Failed to sync sales:', error);
  }
  console.log();

  // 3. Sync Users
  try {
    console.log('👥 Syncing users...');
    const usersResponse = await apiClient.getUsers();
    const users = usersResponse.data || [];
    
    if (users.length > 0) {
      const mappedUsers = users.map((u: any) => ({
        user_id: parseInt(u.id || u.UserID),
        username: u.username || u.Username,
        email: u.email || u.Email,
        role: u.role || u.Role || 'staff',
        full_name: u.full_name || u.FullName || '',
        is_active: u.is_active !== false && u.IsActive !== false,
      }));

      const { data, error } = await supabase
        .from('users')
        .upsert(mappedUsers, { onConflict: 'user_id' });

      if (error) throw error;
      syncResults.users = { success: true, count: mappedUsers.length };
      console.log(`✅ Synced ${mappedUsers.length} users`);
    } else {
      console.log('⚠️  No users to sync');
      syncResults.users = { success: true, count: 0 };
    }
  } catch (error) {
    syncResults.users = { success: false, error: String(error) };
    console.error('❌ Failed to sync users:', error);
  }
  console.log();

  // 4. Sync Stock Entries
  try {
    console.log('📊 Syncing stock entries...');
    const stockResponse = await apiClient.getStockEntries();
    const stocks = stockResponse.data || [];
    
    if (stocks.length > 0) {
      const mappedStocks = stocks.map((s: any) => ({
        stock_entry_id: parseInt(s.id || s.StockEntryID),
        product_id: parseInt(s.product_id || s.ProductID),
        quantity: parseInt(s.quantity || s.Quantity),
        batch_number: s.batch_number || s.BatchNumber || '',
        expiration_date: s.expiration_date || s.ExpirationDate || null,
        unit_price: parseFloat(s.unit_price || s.UnitPrice || 0),
      }));

      const { data, error } = await supabase
        .from('stock_entries')
        .upsert(mappedStocks, { onConflict: 'stock_entry_id' });

      if (error) throw error;
      syncResults.stock = { success: true, count: mappedStocks.length };
      console.log(`✅ Synced ${mappedStocks.length} stock entries`);
    } else {
      console.log('⚠️  No stock entries to sync');
      syncResults.stock = { success: true, count: 0 };
    }
  } catch (error) {
    syncResults.stock = { success: false, error: String(error) };
    console.error('❌ Failed to sync stock:', error);
  }
  console.log();

  // Summary
  console.log('📋 SYNC SUMMARY:');
  console.log(JSON.stringify(syncResults, null, 2));
  
  console.log('\n✅ Manual sync complete!');
  console.log('Refresh the app to see Supabase data.');
  
  return syncResults;
}

export default {
  syncLocalToSupabase,
};
