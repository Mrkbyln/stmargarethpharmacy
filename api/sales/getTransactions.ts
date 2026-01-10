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

    const { limit = '1000', offset = '0' } = req.query;

    // Get all sale items (transactions)
    let query = supabase
      .from('sale_items')
      .select('*, sales(sale_date, user_id, total_amount)', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Pagination
    const limitNum = Math.min(parseInt(limit as string) || 1000, 10000);
    const offsetNum = parseInt(offset as string) || 0;
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch transactions', error);
    }

    return successResponse(res, {
      transactions: transactions || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum
    });

  } catch (error) {
    console.error('Transactions error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
