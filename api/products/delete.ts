import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest, logAuditEvent } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return errorResponse(res, 405, 'Method not allowed');
  }

  try {
    const user = getUserFromRequest(req);
    
    // Only admin can delete products
    if (!user || user.role !== 'admin') {
      return errorResponse(res, 403, 'Unauthorized. Only admin can delete products.');
    }

    const { productId } = req.body || req.query;
    
    if (!productId) {
      return errorResponse(res, 400, 'Product ID is required');
    }

    // Get product before deletion for audit log
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    // Soft delete - mark as inactive
    const { error } = await supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId);

    if (error) {
      return errorResponse(res, 500, 'Failed to delete product', error);
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'Product Deleted',
      {
        product_id: productId,
        product_name: product?.product_name,
        product_code: product?.product_code
      },
      req
    );

    return successResponse(res, {
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Product delete error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
