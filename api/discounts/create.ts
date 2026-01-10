import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest, logAuditEvent } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return errorResponse(res, 405, 'Method not allowed');
  }

  try {
    const user = getUserFromRequest(req);
    
    if (!user || user.role !== 'admin') {
      return errorResponse(res, 403, 'Unauthorized. Only admin can create discounts.');
    }

    const { discount_name, discount_rate } = req.body;

    if (!discount_name || discount_rate === undefined) {
      return errorResponse(res, 400, 'Discount name and rate are required');
    }

    if (isNaN(discount_rate) || discount_rate < 0 || discount_rate > 100) {
      return errorResponse(res, 400, 'Discount rate must be between 0 and 100');
    }

    const { data, error } = await supabase
      .from('discounts')
      .insert({
        discount_name,
        discount_rate: parseFloat(discount_rate),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      return errorResponse(res, 500, 'Failed to create discount', error);
    }

    await logAuditEvent(
      user.id,
      'Discount Created',
      {
        discount_name,
        discount_rate
      },
      req
    );

    return successResponse(res, {
      message: 'Discount created successfully',
      discount: data?.[0]
    }, 201);

  } catch (error) {
    console.error('Discount creation error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
