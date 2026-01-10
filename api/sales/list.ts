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

    const { startDate, endDate, limit = '100', offset = '0' } = req.query;

    let query = supabase
      .from('sales')
      .select('*', { count: 'exact' })
      .order('sale_date', { ascending: false });

    // Apply date filters
    if (startDate) {
      const start = new Date(startDate as string).toISOString();
      query = query.gte('sale_date', start);
    }

    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      query = query.lte('sale_date', end.toISOString());
    }

    // Pagination
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000);
    const offsetNum = parseInt(offset as string) || 0;
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data: sales, error: salesError, count } = await query;

    if (salesError) {
      return errorResponse(res, 500, 'Failed to fetch sales', salesError);
    }

    // Get sale items for each sale
    const salesWithItems = await Promise.all(
      (sales || []).map(async (sale: any) => {
        const { data: items } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', sale.id);

        return {
          ...sale,
          items: items || []
        };
      })
    );

    return successResponse(res, {
      sales: salesWithItems,
      total: count || 0,
      limit: limitNum,
      offset: offsetNum
    });

  } catch (error) {
    console.error('Sales list error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
