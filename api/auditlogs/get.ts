import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest, checkUserRole } from '../utils/helpers';

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
    
    // Check if user is admin or staff
    if (!user || !['admin', 'staff'].includes(user.role)) {
      return errorResponse(res, 403, 'Unauthorized. Only admin and staff can view audit logs.');
    }

    const { startDate, endDate, userId, action, limit = '100', offset = '0' } = req.query;

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false });

    // Apply filters
    if (startDate) {
      query = query.gte('timestamp', startDate);
    }

    if (endDate) {
      query = query.lte('timestamp', endDate);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (action) {
      query = query.eq('action', action);
    }

    // Pagination
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000);
    const offsetNum = parseInt(offset as string) || 0;
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch audit logs', error);
    }

    return successResponse(res, {
      logs: data || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum
    });

  } catch (error) {
    console.error('Audit logs fetch error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
