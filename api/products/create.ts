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
    
    // Only admin and staff can create products
    if (!user || !['admin', 'staff'].includes(user.role)) {
      return errorResponse(res, 403, 'Unauthorized. Only admin and staff can create products.');
    }

    const {
      product_code,
      product_name,
      particulars,
      brand_name,
      category_id,
      category_name,
      unit_price,
      selling_price,
      reorder_level,
      current_stock
    } = req.body;

    // Validation
    if (!product_code || !product_name || !unit_price || !selling_price) {
      return errorResponse(res, 400, 'Product code, name, unit price, and selling price are required');
    }

    // Insert product
    const { data, error } = await supabase
      .from('products')
      .insert({
        product_code,
        product_name,
        particulars: particulars || null,
        brand_name: brand_name || null,
        category_id: category_id || null,
        category_name: category_name || null,
        unit_price: parseFloat(unit_price),
        selling_price: parseFloat(selling_price),
        reorder_level: reorder_level || 10,
        current_stock: current_stock || 0,
        is_active: true,
        date_added: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      return errorResponse(res, 500, 'Failed to create product', error);
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'Product Created',
      {
        product_code,
        product_name,
        unit_price,
        selling_price
      },
      req
    );

    return successResponse(res, {
      message: 'Product created successfully',
      product: data?.[0]
    }, 201);

  } catch (error) {
    console.error('Product creation error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
