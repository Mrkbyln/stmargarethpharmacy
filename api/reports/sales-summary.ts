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

    const { startDate, endDate } = req.query;

    let query = supabase
      .from('sales')
      .select('*, sale_items!inner(*, products(name, category))', { count: 'exact' });

    if (startDate) {
      query = query.gte('sale_date', startDate);
    }

    if (endDate) {
      query = query.lte('sale_date', endDate);
    }

    const { data: sales, error, count } = await query
      .order('sale_date', { ascending: false });

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch sales data', error);
    }

    // Calculate summary statistics
    const totalSales = sales?.length || 0;
    const totalAmount = sales?.reduce((sum: number, sale: any) => sum + parseFloat(sale.total_amount || 0), 0) || 0;
    const totalQuantity = sales?.reduce((sum: number, sale: any) => {
      const itemQty = sale.sale_items?.reduce((itemSum: number, item: any) => itemSum + parseInt(item.quantity || 0), 0) || 0;
      return sum + itemQty;
    }, 0) || 0;

    // Group by product
    const productSummary: Record<string, any> = {};
    sales?.forEach((sale: any) => {
      sale.sale_items?.forEach((item: any) => {
        const productId = item.product_id;
        if (!productSummary[productId]) {
          productSummary[productId] = {
            product_id: productId,
            product_name: item.products?.name || 'Unknown',
            total_qty: 0,
            total_amount: 0,
            times_sold: 0
          };
        }
        productSummary[productId].total_qty += parseInt(item.quantity || 0);
        productSummary[productId].total_amount += parseFloat(item.subtotal || 0);
        productSummary[productId].times_sold += 1;
      });
    });

    // Average transaction value
    const avgTransactionValue = totalSales > 0 ? totalAmount / totalSales : 0;

    return successResponse(res, {
      summary: {
        total_sales: totalSales,
        total_amount: totalAmount.toFixed(2),
        total_quantity: totalQuantity,
        avg_transaction_value: avgTransactionValue.toFixed(2),
        period: {
          start: startDate || 'All time',
          end: endDate || 'All time'
        }
      },
      product_breakdown: Object.values(productSummary),
      transactions: sales || []
    });

  } catch (error) {
    console.error('Sales summary error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
