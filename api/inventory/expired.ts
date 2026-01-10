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

    const today = new Date().toISOString().split('T')[0];

    // Get stock entries with expiration date today or before
    const { data, error } = await supabase
      .from('stock_entries')
      .select('*, products(*)')
      .eq('is_active', true)
      .lte('expiration_date', today);

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch expired items', error);
    }

    return successResponse(res, {
      expired_items: data || []
    });

  } catch (error) {
    console.error('Expired items error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
