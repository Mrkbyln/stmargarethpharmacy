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
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .neq('table_name', null);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: logs, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return errorResponse(res, 500, 'Failed to fetch audit logs', error);
    }

    // Group by action type and table
    const actionSummary: Record<string, number> = {};
    const tableSummary: Record<string, number> = {};
    const userActivity: Record<string, number> = {};

    logs?.forEach((log: any) => {
      actionSummary[log.action] = (actionSummary[log.action] || 0) + 1;
      tableSummary[log.table_name] = (tableSummary[log.table_name] || 0) + 1;
      userActivity[log.user_id] = (userActivity[log.user_id] || 0) + 1;
    });

    return successResponse(res, {
      total_events: count || 0,
      period: {
        start: startDate || 'All time',
        end: endDate || 'All time'
      },
      action_summary: actionSummary,
      table_summary: tableSummary,
      top_users: Object.entries(userActivity)
        .map(([user_id, count]) => ({ user_id, activity_count: count }))
        .sort((a, b) => b.activity_count - a.activity_count)
        .slice(0, 10),
      recent_events: logs || []
    });

  } catch (error) {
    console.error('Audit summary error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
