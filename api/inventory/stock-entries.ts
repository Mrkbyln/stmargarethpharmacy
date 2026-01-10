import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest, logAuditEvent } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
      // List stock entries
      const { product_id, limit = '100', offset = '0' } = req.query;

      let query = supabase
        .from('stock_entries')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (product_id) {
        query = query.eq('product_id', product_id);
      }

      const limitNum = Math.min(parseInt(limit as string) || 100, 1000);
      const offsetNum = parseInt(offset as string) || 0;
      query = query.range(offsetNum, offsetNum + limitNum - 1);

      const { data, error, count } = await query;

      if (error) {
        return errorResponse(res, 500, 'Failed to fetch stock entries', error);
      }

      return successResponse(res, {
        stock_entries: data || [],
        total: count || 0,
        limit: limitNum,
        offset: offsetNum
      });

    } else if (req.method === 'POST') {
      // Add stock entry
      const { product_id, quantity, batch_number, unit_price, expiration_date } = req.body;

      if (!product_id || !quantity) {
        return errorResponse(res, 400, 'Product ID and quantity are required');
      }

      const { data, error } = await supabase
        .from('stock_entries')
        .insert({
          product_id,
          batch_number: batch_number || null,
          quantity: parseInt(quantity),
          unit_price: unit_price ? parseFloat(unit_price) : null,
          expiration_date: expiration_date || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        return errorResponse(res, 500, 'Failed to add stock entry', error);
      }

      // Update product current_stock
      const { data: product } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', product_id)
        .single();

      if (product) {
        await supabase
          .from('products')
          .update({ current_stock: product.current_stock + parseInt(quantity) })
          .eq('id', product_id);
      }

      await logAuditEvent(
        user.id,
        'Stock Entry Added',
        {
          product_id,
          quantity,
          batch_number,
          expiration_date
        },
        req
      );

      return successResponse(res, {
        message: 'Stock entry added successfully',
        stock_entry: data?.[0]
      }, 201);

    } else if (req.method === 'PUT') {
      // Update stock entry
      const { stock_entry_id } = req.query;
      const { quantity, unit_price, expiration_date } = req.body;

      if (!stock_entry_id) {
        return errorResponse(res, 400, 'Stock entry ID is required');
      }

      const { data: oldEntry } = await supabase
        .from('stock_entries')
        .select('*')
        .eq('id', stock_entry_id)
        .single();

      const updates: any = {
        updated_at: new Date().toISOString()
      };

      if (quantity !== undefined) {
        updates.quantity = parseInt(quantity);
      }
      if (unit_price !== undefined) {
        updates.unit_price = parseFloat(unit_price);
      }
      if (expiration_date !== undefined) {
        updates.expiration_date = expiration_date;
      }

      const { data, error } = await supabase
        .from('stock_entries')
        .update(updates)
        .eq('id', stock_entry_id)
        .select();

      if (error) {
        return errorResponse(res, 500, 'Failed to update stock entry', error);
      }

      // Update product stock if quantity changed
      if (quantity !== undefined && oldEntry) {
        const qtyDifference = parseInt(quantity) - oldEntry.quantity;
        const { data: product } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', oldEntry.product_id)
          .single();

        if (product) {
          await supabase
            .from('products')
            .update({ current_stock: Math.max(0, product.current_stock + qtyDifference) })
            .eq('id', oldEntry.product_id);
        }
      }

      await logAuditEvent(
        user.id,
        'Stock Entry Updated',
        {
          stock_entry_id,
          changes: updates
        },
        req
      );

      return successResponse(res, {
        message: 'Stock entry updated successfully',
        stock_entry: data?.[0]
      });

    } else if (req.method === 'DELETE') {
      // Delete stock entry (soft delete)
      const { stock_entry_id } = req.query;

      if (!stock_entry_id) {
        return errorResponse(res, 400, 'Stock entry ID is required');
      }

      const { data: entry } = await supabase
        .from('stock_entries')
        .select('*')
        .eq('id', stock_entry_id)
        .single();

      const { error } = await supabase
        .from('stock_entries')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', stock_entry_id);

      if (error) {
        return errorResponse(res, 500, 'Failed to delete stock entry', error);
      }

      // Update product stock
      if (entry) {
        const { data: product } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', entry.product_id)
          .single();

        if (product) {
          await supabase
            .from('products')
            .update({ current_stock: Math.max(0, product.current_stock - entry.quantity) })
            .eq('id', entry.product_id);
        }
      }

      await logAuditEvent(
        user.id,
        'Stock Entry Deleted',
        {
          stock_entry_id
        },
        req
      );

      return successResponse(res, {
        message: 'Stock entry deleted successfully'
      });

    } else {
      return errorResponse(res, 405, 'Method not allowed');
    }

  } catch (error) {
    console.error('Stock entries error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
