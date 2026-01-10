import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest, logAuditEvent } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = getUserFromRequest(req);
  if (!user) {
    return errorResponse(res, 401, 'Unauthorized');
  }

  try {
    if (req.method === 'GET') {
      // List damaged items
      const { data, error, count } = await supabase
        .from('damaged_items')
        .select('*, products(*), users(username)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (error) {
        return errorResponse(res, 500, 'Failed to fetch damaged items', error);
      }

      return successResponse(res, {
        damaged_items: data || [],
        total: count || 0
      });

    } else if (req.method === 'POST') {
      // Report damaged items
      const { stock_entry_id, product_id, quantity, reason, replacement_product_id } = req.body;

      if (!product_id || !quantity) {
        return errorResponse(res, 400, 'Product ID and quantity are required');
      }

      // Get current stock entry
      const { data: stockEntry } = await supabase
        .from('stock_entries')
        .select('quantity')
        .eq('id', stock_entry_id)
        .single();

      if (stockEntry && stockEntry.quantity < quantity) {
        return errorResponse(res, 400, 'Quantity exceeds available stock');
      }

      // Create damaged item record
      const { data, error } = await supabase
        .from('damaged_items')
        .insert({
          product_id,
          stock_entry_id: stock_entry_id || null,
          quantity,
          reason: reason || null,
          replacement_product_id: replacement_product_id || null,
          reported_by: user.id,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        return errorResponse(res, 500, 'Failed to report damaged items', error);
      }

      // Update product stock
      const { data: product } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', product_id)
        .single();

      if (product) {
        await supabase
          .from('products')
          .update({ current_stock: Math.max(0, product.current_stock - quantity) })
          .eq('id', product_id);
      }

      // Log audit event
      await logAuditEvent(
        user.id,
        'Item Reported Damaged',
        {
          product_id,
          quantity,
          reason
        },
        req
      );

      return successResponse(res, {
        message: 'Damaged item reported successfully',
        damaged_item: data?.[0]
      }, 201);

    } else {
      return errorResponse(res, 405, 'Method not allowed');
    }

  } catch (error) {
    console.error('Damaged items error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
