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
    
    // Only admin and staff can list users
    if (!user || !['admin', 'staff'].includes(user.role)) {
      return errorResponse(res, 403, 'Unauthorized. Only admin and staff can view users.');
    }

    const { role, isActive, limit = '100', offset = '0' } = req.query;

    let query = supabase
      .from('users')
      .select('id, username, email, role, full_name, is_active, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (role) {
      query = query.eq('role', role);
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    // Pagination
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000);
    const offsetNum = parseInt(offset as string) || 0;
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch users', error);
    }

    return successResponse(res, {
      users: data || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum
    });

  } catch (error) {
    console.error('Users list error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
