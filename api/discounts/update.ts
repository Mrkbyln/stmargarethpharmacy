import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest, logAuditEvent } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return errorResponse(res, 405, 'Method not allowed');
  }

  try {
    const user = getUserFromRequest(req);
    
    if (!user || user.role !== 'admin') {
      return errorResponse(res, 403, 'Unauthorized. Only admin can update discounts.');
    }

    const { discountId } = req.query;
    
    if (!discountId) {
      return errorResponse(res, 400, 'Discount ID is required');
    }

    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (req.body.discount_name) {
      updates.discount_name = req.body.discount_name;
    }

    if (req.body.discount_rate !== undefined) {
      const rate = parseFloat(req.body.discount_rate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return errorResponse(res, 400, 'Discount rate must be between 0 and 100');
      }
      updates.discount_rate = rate;
    }

    if (req.body.is_active !== undefined) {
      updates.is_active = req.body.is_active;
    }

    const { data, error } = await supabase
      .from('discounts')
      .update(updates)
      .eq('id', discountId)
      .select();

    if (error) {
      return errorResponse(res, 500, 'Failed to update discount', error);
    }

    await logAuditEvent(
      user.id,
      'Discount Updated',
      {
        discount_id: discountId,
        changes: updates
      },
      req
    );

    return successResponse(res, {
      message: 'Discount updated successfully',
      discount: data?.[0]
    });

  } catch (error) {
    console.error('Discount update error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
