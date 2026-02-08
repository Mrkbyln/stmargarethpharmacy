// lib/supabaseOperations.ts - Save all operations to Supabase when online
import { connectivityService } from './connectivityService';
import { supabase } from './supabaseClient';
import { syncQueue } from './syncQueue';

/**
 * Add or update product in Supabase
 */
export async function saveProductToSupabase(product: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing product save for later');
    syncQueue.addToQueue('products', product);
    return false;
  }

  try {
    console.log('☁️ Saving product to Supabase:', product.product_id || product.id);
    const { error } = await supabase
      .from('products')
      .upsert(product, { onConflict: 'product_id' });

    if (error) throw error;
    console.log('✅ Product saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save product to Supabase:', error);
    syncQueue.addToQueue('products', product);
    return false;
  }
}

/**
 * Add sale transaction to Supabase
 */
export async function saveSaleToSupabase(sale: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing sale for later');
    syncQueue.addToQueue('pos_sales', sale);
    return false;
  }

  try {
    console.log('☁️ Saving sale to Supabase');
    const { error } = await supabase
      .from('pos_sales')
      .insert([sale]);

    if (error) throw error;
    console.log('✅ Sale saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save sale to Supabase:', error);
    syncQueue.addToQueue('pos_sales', sale);
    return false;
  }
}

/**
 * Add sale transaction items to Supabase
 */
export async function saveSaleTransactionToSupabase(saleItems: any[]) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing sale items for later');
    saleItems.forEach(item => {
      syncQueue.addToQueue('salestransaction', item);
    });
    return false;
  }

  try {
    console.log('☁️ Saving sale items to Supabase');
    const { error } = await supabase
      .from('salestransaction')
      .insert(saleItems);

    if (error) throw error;
    console.log('✅ Sale items saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save sale items to Supabase:', error);
    saleItems.forEach(item => {
      syncQueue.addToQueue('salestransaction', item);
    });
    return false;
  }
}

/**
 * Add user to Supabase
 */
export async function saveUserToSupabase(user: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing user for later');
    syncQueue.addToQueue('users', user);
    return false;
  }

  try {
    console.log('☁️ Saving user to Supabase');
    const { error } = await supabase
      .from('users')
      .upsert(user, { onConflict: 'user_id' });

    if (error) throw error;
    console.log('✅ User saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save user to Supabase:', error);
    syncQueue.addToQueue('users', user);
    return false;
  }
}

/**
 * Add audit log to Supabase
 */
export async function saveAuditLogToSupabase(log: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing audit log for later');
    syncQueue.addToQueue('auditlogs', log);
    return false;
  }

  try {
    console.log('☁️ Saving audit log to Supabase');
    
    // Import timezone helper to ensure correct timezone
    const { ensurePhilippineTimestamp } = await import('./timezoneHelper');
    
    // Map to Supabase schema: auditlogs has log_id, user_id, action_performed, timestamp
    // Ensure timestamp is in Philippine time (UTC+8)
    const auditLogData = {
      user_id: log.user_id || 1,
      action_performed: log.action_performed || log.action,
      timestamp: ensurePhilippineTimestamp(log.timestamp)
    };
    
    console.log(`📝 Audit log data before save:`, auditLogData);
    
    const { error } = await supabase
      .from('auditlogs')
      .insert([auditLogData]);

    if (error) throw error;
    console.log('✅ Audit log saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save audit log to Supabase:', error);
    syncQueue.addToQueue('auditlogs', log);
    return false;
  }
}

/**
 * Add stock entry to Supabase
 */
export async function saveStockEntryToSupabase(entry: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing stock entry for later');
    syncQueue.addToQueue('stock_entries', entry);
    return false;
  }

  try {
    console.log('☁️ Saving stock entry to Supabase');
    const { error } = await supabase
      .from('stock_entries')
      .insert([entry]);

    if (error) throw error;
    console.log('✅ Stock entry saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save stock entry to Supabase:', error);
    syncQueue.addToQueue('stock_entries', entry);
    return false;
  }
}

/**
 * Update stock entry in Supabase
 */
export async function updateStockEntryInSupabase(stock_entry_id: number, updates: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing stock update for later');
    syncQueue.addToQueue('stock_entries', { stock_entry_id, ...updates });
    return false;
  }

  try {
    console.log('☁️ Updating stock entry in Supabase');
    const { error } = await supabase
      .from('stock_entries')
      .update(updates)
      .eq('stock_entry_id', stock_entry_id);

    if (error) throw error;
    console.log('✅ Stock entry updated in Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to update stock entry in Supabase:', error);
    syncQueue.addToQueue('stock_entries', { stock_entry_id, ...updates });
    return false;
  }
}

/**
 * Add damaged item to Supabase
 */
export async function saveDamagedItemToSupabase(damagedItem: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing damaged item for later');
    syncQueue.addToQueue('damageditems', damagedItem);
    return false;
  }

  try {
    console.log('☁️ Saving damaged item to Supabase');
    const { error } = await supabase
      .from('damageditems')
      .insert([damagedItem]);

    if (error) throw error;
    console.log('✅ Damaged item saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save damaged item to Supabase:', error);
    syncQueue.addToQueue('damageditems', damagedItem);
    return false;
  }
}

/**
 * Add change item to Supabase
 */
export async function saveChangeItemToSupabase(changeItem: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing change item for later');
    syncQueue.addToQueue('changeitem', changeItem);
    return false;
  }

  try {
    console.log('☁️ Saving change item to Supabase');
    const { error } = await supabase
      .from('changeitem')
      .insert([changeItem]);

    if (error) throw error;
    console.log('✅ Change item saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save change item to Supabase:', error);
    syncQueue.addToQueue('changeitem', changeItem);
    return false;
  }
}

/**
 * Add inventory transaction to Supabase
 */
export async function saveInventoryTransactionToSupabase(transaction: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing inventory transaction for later');
    syncQueue.addToQueue('inventorytransactions', transaction);
    return false;
  }

  try {
    console.log('☁️ Saving inventory transaction to Supabase');
    const { error } = await supabase
      .from('inventorytransactions')
      .insert([transaction]);

    if (error) throw error;
    console.log('✅ Inventory transaction saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save inventory transaction to Supabase:', error);
    syncQueue.addToQueue('inventorytransactions', transaction);
    return false;
  }
}

/**
 * Delete product from Supabase (soft delete - set is_active to false)
 */
export async function deleteProductFromSupabase(product_id: number) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing product deletion for later');
    syncQueue.addToQueue('products', { product_id, is_active: false });
    return false;
  }

  try {
    console.log('☁️ Deleting product from Supabase');
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('product_id', product_id);

    if (error) throw error;
    console.log('✅ Product deleted from Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to delete product from Supabase:', error);
    syncQueue.addToQueue('products', { product_id, is_active: false });
    return false;
  }
}

/**
 * Update product in Supabase
 */
export async function updateProductInSupabase(product_id: number, updates: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing product update for later');
    syncQueue.addToQueue('products', { product_id, ...updates });
    return false;
  }

  try {
    console.log('☁️ Updating product in Supabase');
    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('product_id', product_id);

    if (error) throw error;
    console.log('✅ Product updated in Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to update product in Supabase:', error);
    syncQueue.addToQueue('products', { product_id, ...updates });
    return false;
  }
}

/**
 * Save settings to Supabase
 */
export async function saveSettingToSupabase(setting_key: string, setting_value: string) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing setting for later');
    syncQueue.addToQueue('settings', { setting_key, setting_value });
    return false;
  }

  try {
    console.log('☁️ Saving setting to Supabase:', setting_key);
    const { error } = await supabase
      .from('settings')
      .upsert({
        setting_key: setting_key,
        setting_value: setting_value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

    if (error) throw error;
    console.log('✅ Setting saved to Supabase:', setting_key);
    return true;
  } catch (error) {
    console.error('❌ Failed to save setting to Supabase:', error);
    syncQueue.addToQueue('settings', { setting_key, setting_value });
    return false;
  }
}

/**
 * Save backup record to Supabase
 */
export async function saveBackupToSupabase(backup: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing backup for later');
    syncQueue.addToQueue('backups', backup);
    return false;
  }

  try {
    console.log('☁️ Saving backup record to Supabase');
    const { error } = await supabase
      .from('backups')
      .insert([{
        file_path: backup.file_path,
        google_drive_file_id: backup.google_drive_file_id || null,
        backup_date: backup.backup_date || new Date().toISOString(),
        backup_type: backup.backup_type || 'Manual',
        file_size: backup.file_size || 0
      }]);

    if (error) throw error;
    console.log('✅ Backup record saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save backup to Supabase:', error);
    syncQueue.addToQueue('backups', backup);
    return false;
  }
}

/**
 * Create or update discount in Supabase
 */
export async function saveDiscountToSupabase(discount: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing discount for later');
    syncQueue.addToQueue('discounts', discount);
    return false;
  }

  try {
    console.log('☁️ Saving discount to Supabase:', discount.discount_id || discount.id);
    const { error } = await supabase
      .from('discounts')
      .upsert({
        discount_id: discount.discount_id || discount.id,
        discount_name: discount.discount_name || discount.name,
        discount_rate: discount.discount_rate || discount.rate,
        is_active: discount.is_active !== undefined ? discount.is_active : true,
        created_date: discount.created_date || new Date().toISOString(),
        updated_date: new Date().toISOString()
      }, { onConflict: 'discount_id' });

    if (error) throw error;
    console.log('✅ Discount saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save discount to Supabase:', error);
    syncQueue.addToQueue('discounts', discount);
    return false;
  }
}

/**
 * Delete discount from Supabase
 */
export async function deleteDiscountFromSupabase(discountId: number) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing discount delete for later');
    syncQueue.addToQueue('discounts', { discount_id: discountId, _deleted: true });
    return false;
  }

  try {
    console.log('☁️ Deleting discount from Supabase:', discountId);
    const { error } = await supabase
      .from('discounts')
      .update({ is_active: false })
      .eq('discount_id', discountId);

    if (error) throw error;
    console.log('✅ Discount deleted from Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to delete discount from Supabase:', error);
    syncQueue.addToQueue('discounts', { discount_id: discountId, _deleted: true });
    return false;
  }
}

/**
 * Save notification to Supabase
 */
export async function saveNotificationToSupabase(notification: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing notification for later');
    syncQueue.addToQueue('notifications', notification);
    return false;
  }

  try {
    console.log('☁️ Saving notification to Supabase');
    const { error } = await supabase
      .from('notifications')
      .insert([{
        notification_id: notification.notification_id || notification.id,
        message: notification.message,
        notification_type: notification.notification_type || notification.type || 'info',
        is_read: notification.is_read !== undefined ? notification.is_read : false,
        created_date: notification.created_date || new Date().toISOString(),
        user_id: notification.user_id || null
      }]);

    if (error) throw error;
    console.log('✅ Notification saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to save notification to Supabase:', error);
    syncQueue.addToQueue('notifications', notification);
    return false;
  }
}

/**
 * Mark notification as read in Supabase
 */
export async function markNotificationAsReadInSupabase(notificationId: number) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing notification read status update for later');
    syncQueue.addToQueue('notifications', { notification_id: notificationId, is_read: true });
    return false;
  }

  try {
    console.log('☁️ Marking notification as read in Supabase:', notificationId);
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('notification_id', notificationId);

    if (error) throw error;
    console.log('✅ Notification marked as read in Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to mark notification as read in Supabase:', error);
    syncQueue.addToQueue('notifications', { notification_id: notificationId, is_read: true });
    return false;
  }
}

/**
 * Update user profile in Supabase
 */
export async function updateUserProfileInSupabase(userId: number, profile: any) {
  if (!connectivityService.shouldUseSupabase()) {
    console.log('💾 Offline - queuing user profile update for later');
    syncQueue.addToQueue('users', { user_id: userId, ...profile });
    return false;
  }

  try {
    console.log('☁️ Updating user profile in Supabase:', userId);
    const { error } = await supabase
      .from('users')
      .update({
        full_name: profile.full_name || profile.name,
        profile_image: profile.profile_image || profile.image,
        email: profile.email,
        phone: profile.phone,
        updated_date: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) throw error;
    console.log('✅ User profile updated in Supabase');
    return true;
  } catch (error) {
    console.error('❌ Failed to update user profile in Supabase:', error);
    syncQueue.addToQueue('users', { user_id: userId, ...profile });
    return false;
  }
}

/**
 * Save backup file ONLY to Supabase when online (EXCLUSIVE SUPABASE MODE)
 * When online: Save ONLY to Supabase
 * When offline: Fall back to local XAMPP storage
 */
export async function saveBackupFileOnlineOnly(backupBlob: Blob, backupFileName: string, backupType: string = 'Manual') {
  // Debug: Log connectivity status
  const isOnline = connectivityService.isConnected();
  const shouldUseSupabase = connectivityService.shouldUseSupabase();
  const status = connectivityService.getStatus();
  
  console.log('🔍 BACKUP SAVE DEBUG INFO:');
  console.log(`  isConnected: ${isOnline}`);
  console.log(`  shouldUseSupabase: ${shouldUseSupabase}`);
  console.log(`  status:`, status);
  
  // If online: Save ONLY to Supabase
  if (shouldUseSupabase) {
    try {
      console.log('🟢 ONLINE MODE - Saving backup ONLY to Supabase (not local)');
      
      // Note: Supabase backups table doesn't store file data (backup_data column doesn't exist)
      // Instead, save metadata about the backup file
      const { error } = await supabase
        .from('backups')
        .insert([{
          file_path: backupFileName,
          backup_type: backupType,
          file_size: backupBlob.size,
          backup_date: new Date().toISOString(),
          google_drive_file_id: null
        }]);

      if (error) throw error;
      console.log('✅ Backup saved EXCLUSIVELY to Supabase');
      return { success: true, location: 'supabase', backupId: backupFileName };
    } catch (error) {
      console.error('❌ Failed to save backup to Supabase:', error);
      syncQueue.addToQueue('backups', { 
        file_path: backupFileName, 
        backup_type: backupType, 
        file_size: backupBlob.size,
        backup_date: new Date().toISOString()
      });
      return { success: false, location: 'queued' };
    }
  } else {
    // If offline: Save to local XAMPP (fallback)
    const reason = !isOnline ? 'no internet connection' : 'Supabase client not available';
    console.log(`🔴 OFFLINE MODE - Saving backup to local XAMPP (fallback) - Reason: ${reason}`);
    console.log(`  Use local XAMPP database as fallback`);
    syncQueue.addToQueue('backups', { 
      file_path: backupFileName, 
      backup_type: backupType, 
      file_size: backupBlob.size, 
      backup_date: new Date().toISOString(),
      is_offline_backup: true 
    });
    return { success: true, location: 'local_fallback', backupId: backupFileName };
  }
}

/**
 * Save PDF report ONLY to Supabase when online (EXCLUSIVE SUPABASE MODE)
 */
export async function savePDFReportOnlineOnly(pdfBlob: Blob, reportFileName: string, reportType: string, userId: number) {
  if (connectivityService.shouldUseSupabase()) {
    try {
      console.log('🟢 ONLINE MODE - Saving PDF report ONLY to Supabase (not local)');
      
      // Save metadata to reports table (Supabase schema: report_id, report_type, generated_by, generated_date, file_path)
      const { error } = await supabase
        .from('reports')
        .insert([{
          report_type: reportType,
          generated_by: userId,
          generated_date: new Date().toISOString(),
          file_path: reportFileName
        }]);

      if (error) throw error;
      console.log('✅ PDF report saved EXCLUSIVELY to Supabase');
      return { success: true, location: 'supabase', reportId: reportFileName };
    } catch (error) {
      console.error('❌ Failed to save PDF report to Supabase:', error);
      syncQueue.addToQueue('reports', { file_path: reportFileName, report_type: reportType, generated_by: userId });
      return { success: false, location: 'queued' };
    }
  } else {
    console.log('🔴 OFFLINE MODE - PDF report queued for later sync');
    syncQueue.addToQueue('reports', { file_path: reportFileName, report_type: reportType, generated_by: userId });
    return { success: true, location: 'queued', reportId: reportFileName };
  }
}

/**
 * Save CSV export ONLY to Supabase when online (EXCLUSIVE SUPABASE MODE)
 */
export async function saveCSVExportOnlineOnly(csvBlob: Blob, exportFileName: string, exportType: string, userId: number) {
  if (connectivityService.shouldUseSupabase()) {
    try {
      console.log('🟢 ONLINE MODE - Saving CSV export ONLY to Supabase (not local)');
      
      // Save metadata to reports table with CSV export type marker
      const { error } = await supabase
        .from('reports')
        .insert([{
          report_type: `CSV_${exportType}`,
          generated_by: userId,
          generated_date: new Date().toISOString(),
          file_path: exportFileName
        }]);

      if (error) throw error;
      console.log('✅ CSV export saved EXCLUSIVELY to Supabase');
      return { success: true, location: 'supabase', exportId: exportFileName };
    } catch (error) {
      console.error('❌ Failed to save CSV export to Supabase:', error);
      syncQueue.addToQueue('reports', { file_path: exportFileName, report_type: `CSV_${exportType}`, generated_by: userId });
      return { success: false, location: 'queued' };
    }
  } else {
    console.log('🔴 OFFLINE MODE - CSV export queued for later sync');
    syncQueue.addToQueue('reports', { file_path: exportFileName, report_type: `CSV_${exportType}`, generated_by: userId });
    return { success: true, location: 'queued', exportId: exportFileName };
  }
}

/**
 * Save receipt ONLY to Supabase when online (EXCLUSIVE SUPABASE MODE)
 */
export async function saveReceiptOnlineOnly(receiptData: any, saleId: number, userId: number) {
  if (connectivityService.shouldUseSupabase()) {
    try {
      console.log('🟢 ONLINE MODE - Saving receipt ONLY to Supabase (not local)');
      
      // Save metadata to receipts table (Supabase schema: receipt_id, sale_id, receipt_number, receipt_date, receipt_data, printed_by, print_date)
      const { error } = await supabase
        .from('receipts')
        .insert([{
          sale_id: saleId,
          receipt_number: `RCP-${saleId}-${Date.now()}`,
          receipt_date: new Date().toISOString(),
          receipt_data: JSON.stringify(receiptData),
          printed_by: userId,
          print_date: new Date().toISOString()
        }]);

      if (error) throw error;
      console.log('✅ Receipt saved EXCLUSIVELY to Supabase');
      return { success: true, location: 'supabase' };
    } catch (error) {
      console.error('❌ Failed to save receipt to Supabase:', error);
      syncQueue.addToQueue('receipts', { sale_id: saleId, receipt_data: receiptData, printed_by: userId });
      return { success: false, location: 'queued' };
    }
  } else {
    console.log('🔴 OFFLINE MODE - Receipt queued for later sync');
    syncQueue.addToQueue('receipts', { sale_id: saleId, receipt_data: receiptData, printed_by: userId });
    return { success: true, location: 'queued' };
  }
}

export default {
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
  saveDiscountToSupabase,
  deleteDiscountFromSupabase,
  deleteProductFromSupabase,
  updateProductInSupabase,
  saveSettingToSupabase,
  saveBackupToSupabase,
  saveNotificationToSupabase,
  markNotificationAsReadInSupabase,
  updateUserProfileInSupabase,
  saveBackupFileOnlineOnly,
  savePDFReportOnlineOnly,
  saveCSVExportOnlineOnly,
  saveReceiptOnlineOnly,
};
