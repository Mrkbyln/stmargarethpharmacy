import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest, logAuditEvent } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return errorResponse(res, 405, 'Method not allowed');
  }

  try {
    const user = getUserFromRequest(req);
    
    if (!user || user.role !== 'admin') {
      return errorResponse(res, 403, 'Unauthorized. Only admin can delete discounts.');
    }

    const { discountId } = req.query;
    
    if (!discountId) {
      return errorResponse(res, 400, 'Discount ID is required');
    }

    const { data: discount } = await supabase
      .from('discounts')
      .select('*')
      .eq('id', discountId)
      .single();

    const { error } = await supabase
      .from('discounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', discountId);

    if (error) {
      return errorResponse(res, 500, 'Failed to delete discount', error);
    }

    await logAuditEvent(
      user.id,
      'Discount Deleted',
      {
        discount_id: discountId,
        discount_name: discount?.discount_name
      },
      req
    );

    return successResponse(res, {
      message: 'Discount deleted successfully'
    });

  } catch (error) {
    console.error('Discount delete error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
