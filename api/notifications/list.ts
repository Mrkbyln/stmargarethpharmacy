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

    const { type, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filter by user if not admin
    if (user.role !== 'admin') {
      query = query.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    // Filter by type if provided
    if (type) {
      query = query.eq('type', type);
    }

    // Pagination
    const limitNum = Math.min(parseInt(limit as string) || 50, 500);
    const offsetNum = parseInt(offset as string) || 0;
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch notifications', error);
    }

    return successResponse(res, {
      notifications: data || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum
    });

  } catch (error) {
    console.error('Notifications fetch error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
