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

    // Get distinct categories from active products
    const { data: categories, error } = await supabase
      .from('products')
      .select('category_name')
      .eq('is_active', true)
      .not('category_name', 'is', null);

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch categories', error);
    }

    // Remove duplicates
    const uniqueCategories = Array.from(new Set(categories?.map((c: any) => c.category_name)))
      .filter(Boolean)
      .map(name => ({ name }));

    return successResponse(res, {
      categories: uniqueCategories
    });

  } catch (error) {
    console.error('Categories fetch error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
