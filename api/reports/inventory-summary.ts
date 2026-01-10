import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return errorResponse(res, 405, 'Method not allowed');
  }

  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return errorResponse(res, 401, 'Unauthorized');
    }

    // Get all stock entries with product information
    const { data: stockEntries, error } = await supabase
      .from('stock_entries')
      .select('*, products!inner(id, name, current_stock, reorder_level)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch inventory logs', error);
    }

    // Get stock movement summary
    const { data: products } = await supabase
      .from('products')
      .select('id, name, current_stock, reorder_level, category');

    // Calculate movement by product
    const productMovement: Record<string, any> = {};
    stockEntries?.forEach((entry: any) => {
      const productId = entry.product_id;
      if (!productMovement[productId]) {
        productMovement[productId] = {
          product_id: productId,
          product_name: entry.products?.name || 'Unknown',
          total_in: 0,
          total_out: 0,
          batch_count: 0,
          last_movement: null
        };
      }

      const movement = parseInt(entry.quantity || 0);
      if (movement > 0) {
        productMovement[productId].total_in += movement;
      } else {
        productMovement[productId].total_out += Math.abs(movement);
      }
      productMovement[productId].batch_count += 1;
      productMovement[productId].last_movement = entry.created_at;
    });

    return successResponse(res, {
      summary: {
        total_products: products?.length || 0,
        total_stock_entries: stockEntries?.length || 0,
        reporting_period: 'All time'
      },
      product_movement: Object.values(productMovement)
        .sort((a: any, b: any) => new Date(b.last_movement).getTime() - new Date(a.last_movement).getTime()),
      current_inventory: products || [],
      stock_entries: stockEntries || []
    });

  } catch (error) {
    console.error('Inventory summary error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
