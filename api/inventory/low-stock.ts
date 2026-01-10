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

    // Get products with stock below reorder level
    const { data, error, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .lt('current_stock', supabase.rpc('get_reorder_level'))
      .order('current_stock', { ascending: true });

    if (error) {
      // Fallback: just get all products and filter manually
      const { data: allProducts } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      const lowStockProducts = allProducts?.filter(p => p.current_stock < (p.reorder_level || 10)) || [];

      return successResponse(res, {
        low_stock_items: lowStockProducts
      });
    }

    return successResponse(res, {
      low_stock_items: data || []
    });

  } catch (error) {
    console.error('Low stock items error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
