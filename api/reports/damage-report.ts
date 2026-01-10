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

    // Get all damaged items
    const { data: damagedItems, error: damageError, count: damageCount } = await supabase
      .from('damaged_items')
      .select('*, products!inner(id, name), users!inner(username)', { count: 'exact' })
      .order('reported_date', { ascending: false })
      .limit(1000);

    if (damageError) {
      return errorResponse(res, 500, 'Failed to fetch damaged items', damageError);
    }

    // Calculate damage statistics
    const totalDamaged = damageItems?.length || 0;
    const totalQuantityDamaged = damagedItems?.reduce((sum: number, item: any) => sum + parseInt(item.quantity_damaged || 0), 0) || 0;

    // Group by damage reason
    const reasonSummary: Record<string, number> = {};
    const productDamageCount: Record<string, number> = {};

    damagedItems?.forEach((item: any) => {
      reasonSummary[item.damage_reason] = (reasonSummary[item.damage_reason] || 0) + 1;
      productDamageCount[item.product_id] = (productDamageCount[item.product_id] || 0) + 1;
    });

    // Get expiry information
    const { data: expiryItems } = await supabase
      .from('stock_entries')
      .select('*, products!inner(id, name)')
      .lte('expiration_date', today)
      .is('deleted_at', null);

    return successResponse(res, {
      damage_summary: {
        total_damaged_items: totalDamaged,
        total_quantity_damaged: totalQuantityDamaged,
        reason_breakdown: reasonSummary,
        most_damaged_products: Object.entries(productDamageCount)
          .map(([product_id, count]) => ({ product_id, incident_count: count }))
          .sort((a, b) => b.incident_count - a.incident_count)
          .slice(0, 10)
      },
      expiry_summary: {
        expired_batches: expiryItems?.length || 0
      },
      recent_damages: damagedItems?.slice(0, 50) || []
    });

  } catch (error) {
    console.error('Damage report error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
