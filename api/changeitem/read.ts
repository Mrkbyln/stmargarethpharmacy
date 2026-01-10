import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest, logAuditEvent } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = getUserFromRequest(req);
  if (!user) {
    return errorResponse(res, 401, 'Unauthorized');
  }

  try {
    if (req.method === 'GET') {
      // List change items (returns/exchanges)
      const { limit = '50', offset = '0' } = req.query;

      let query = supabase
        .from('change_items')
        .select('*, sales(sale_date), users(username)', { count: 'exact' })
        .order('created_at', { ascending: false });

      const limitNum = Math.min(parseInt(limit as string) || 50, 500);
      const offsetNum = parseInt(offset as string) || 0;
      query = query.range(offsetNum, offsetNum + limitNum - 1);

      const { data, error, count } = await query;

      if (error) {
        return errorResponse(res, 500, 'Failed to fetch change items', error);
      }

      return successResponse(res, {
        change_items: data || [],
        total: count || 0,
        limit: limitNum,
        offset: offsetNum
      });

    } else if (req.method === 'POST') {
      // Create change item (return/exchange)
      const {
        original_sale_id,
        item_returned,
        qty_returned,
        item_given,
        qty_given,
        returned_item_price,
        item_given_price,
        additional_payment,
        price_difference,
        reason,
        returned_stock_entry_id,
        replacement_stock_entry_id
      } = req.body;

      if (!original_sale_id || !item_returned || !qty_returned || !item_given || !qty_given) {
        return errorResponse(res, 400, 'All required fields must be provided');
      }

      const { data, error } = await supabase
        .from('change_items')
        .insert({
          original_sale_id,
          item_returned,
          qty_returned: parseInt(qty_returned),
          item_given,
          qty_given: parseInt(qty_given),
          returned_item_price: parseFloat(returned_item_price || 0),
          item_given_price: parseFloat(item_given_price || 0),
          additional_payment: parseFloat(additional_payment || 0),
          price_difference: parseFloat(price_difference || 0),
          reason: reason || null,
          processed_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        return errorResponse(res, 500, 'Failed to create change item', error);
      }

      // Adjust stock for returned item
      const { data: returnedProduct } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', item_returned)
        .single();

      if (returnedProduct) {
        await supabase
          .from('products')
          .update({ current_stock: returnedProduct.current_stock + parseInt(qty_returned) })
          .eq('id', item_returned);
      }

      // Adjust stock for given item
      const { data: givenProduct } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', item_given)
        .single();

      if (givenProduct) {
        await supabase
          .from('products')
          .update({ current_stock: Math.max(0, givenProduct.current_stock - parseInt(qty_given)) })
          .eq('id', item_given);
      }

      await logAuditEvent(
        user.id,
        'Item Exchange/Return Processed',
        {
          original_sale_id,
          item_returned,
          qty_returned,
          item_given,
          qty_given,
          reason
        },
        req
      );

      return successResponse(res, {
        message: 'Change item processed successfully',
        change_item: data?.[0]
      }, 201);

    } else {
      return errorResponse(res, 405, 'Method not allowed');
    }

  } catch (error) {
    console.error('Change items error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
