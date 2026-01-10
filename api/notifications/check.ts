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

    // Count unread notifications
    let query = supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('is_read', false);

    // Filter by user if not admin
    if (user.role !== 'admin') {
      query = query.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    const { count, error } = await query;

    if (error) {
      return errorResponse(res, 500, 'Failed to check notifications', error);
    }

    return successResponse(res, {
      unread_count: count || 0
    });

  } catch (error) {
    console.error('Notification check error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
