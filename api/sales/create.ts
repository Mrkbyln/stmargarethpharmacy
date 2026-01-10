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
    
    if (!user) {
      return errorResponse(res, 401, 'Unauthorized');
    }

    const { items, discount_id, total_amount, payment_method, notes } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 400, 'Items array is required and must not be empty');
    }

    if (!total_amount) {
      return errorResponse(res, 400, 'Total amount is required');
    }

    // Create sale
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        sale_date: new Date().toISOString(),
        user_id: user.id,
        discount_id: discount_id || null,
        total_amount: parseFloat(total_amount),
        payment_method: payment_method || 'cash',
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (saleError || !saleData?.[0]) {
      return errorResponse(res, 500, 'Failed to create sale', saleError);
    }

    const saleId = saleData[0].id;

    // Create sale items
    const saleItems = items.map((item: any) => ({
      sale_id: saleId,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: parseInt(item.quantity),
      unit_price: parseFloat(item.unit_price),
      discount: item.discount ? parseFloat(item.discount) : 0,
      subtotal: parseFloat(item.subtotal),
      created_at: new Date().toISOString()
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) {
      console.error('Error creating sale items:', itemsError);
      // Don't fail the entire transaction, log the warning
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'Sale Created',
      {
        sale_id: saleId,
        items_count: items.length,
        total_amount,
        payment_method
      },
      req
    );

    return successResponse(res, {
      message: 'Sale created successfully',
      sale_id: saleId,
      sale: saleData[0]
    }, 201);

  } catch (error) {
    console.error('Sale creation error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
