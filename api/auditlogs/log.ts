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
    // Get user from request - optional, can log without user for system events
    const user = getUserFromRequest(req);
    const { action, details, table_name, record_id, old_values, new_values } = req.body;

    if (!action) {
      return errorResponse(res, 400, 'Action is required');
    }

    // Log the audit event
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user?.id || null,
        action,
        details: details ? JSON.stringify(details) : null,
        table_name: table_name || null,
        record_id: record_id || null,
        old_values: old_values ? JSON.stringify(old_values) : null,
        new_values: new_values ? JSON.stringify(new_values) : null,
        ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        user_agent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Error logging audit event:', error);
      return errorResponse(res, 500, 'Failed to log action', error);
    }

    return successResponse(res, {
      message: 'Action logged successfully',
      log_id: data?.[0]?.id
    });

  } catch (error) {
    console.error('Audit log error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
