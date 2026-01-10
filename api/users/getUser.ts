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

    const { userId } = req.query;

    if (!userId) {
      return errorResponse(res, 400, 'User ID is required');
    }

    // Get user by ID
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, role, full_name, is_active, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return errorResponse(res, 404, 'User not found');
    }

    return successResponse(res, {
      user: data
    });

  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
