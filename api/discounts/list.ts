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

    const { includeInactive } = req.query;
    
    let query = supabase
      .from('discounts')
      .select('*', { count: 'exact' })
      .order('discount_name', { ascending: true });

    // By default, only active discounts (for POS)
    // With includeInactive=true, show all (for admin management)
    if (includeInactive !== 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch discounts', error);
    }

    return successResponse(res, {
      discounts: data || [],
      total: count || 0
    });

  } catch (error) {
    console.error('Discounts list error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
