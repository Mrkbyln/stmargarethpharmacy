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

    const { category, date, sortBy = 'ProductName', sortOrder = 'asc', limit = '100', offset = '0' } = req.query;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // Apply filters
    if (category) {
      query = query.eq('category_name', category);
    }

    if (date) {
      const dateStr = new Date(date as string).toISOString().split('T')[0];
      query = query.gte('date_added', dateStr);
      query = query.lt('date_added', new Date(new Date(date as string).getTime() + 86400000).toISOString().split('T')[0]);
    }

    // Apply sorting
    const sortByField = sortBy as string || 'product_name';
    const sortAsc = sortOrder === 'asc';
    query = query.order(sortByField, { ascending: sortAsc });

    // Pagination
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000);
    const offsetNum = parseInt(offset as string) || 0;
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch products', error);
    }

    return successResponse(res, {
      products: data || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum
    });

  } catch (error) {
    console.error('Products list error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
