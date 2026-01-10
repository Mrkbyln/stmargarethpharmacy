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
    
    // Only admin and staff can update products
    if (!user || !['admin', 'staff'].includes(user.role)) {
      return errorResponse(res, 403, 'Unauthorized. Only admin and staff can update products.');
    }

    const { productId } = req.query;
    
    if (!productId) {
      return errorResponse(res, 400, 'Product ID is required');
    }

    // Get current product for audit log
    const { data: oldProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    const updates: any = {
      updated_at: new Date().toISOString()
    };

    // Only update fields that are provided
    const allowedFields = [
      'product_code',
      'product_name',
      'particulars',
      'brand_name',
      'category_id',
      'category_name',
      'unit_price',
      'selling_price',
      'reorder_level',
      'current_stock',
      'is_active'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Update product
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select();

    if (error) {
      return errorResponse(res, 500, 'Failed to update product', error);
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'Product Updated',
      {
        product_id: productId,
        changes: updates
      },
      req
    );

    return successResponse(res, {
      message: 'Product updated successfully',
      product: data?.[0]
    });

  } catch (error) {
    console.error('Product update error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
