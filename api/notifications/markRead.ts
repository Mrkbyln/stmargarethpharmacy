import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest } from '../utils/helpers';

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
    
    if (!user) {
      return errorResponse(res, 401, 'Unauthorized');
    }

    const { notificationId, markAll, markAllUnread } = req.body;

    // Mark single notification as read
    if (notificationId) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) {
        return errorResponse(res, 500, 'Failed to mark notification as read', error);
      }

      return successResponse(res, {
        message: 'Notification marked as read'
      });
    }

    // Mark all notifications as read
    if (markAll) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq('is_read', false);

      if (error) {
        return errorResponse(res, 500, 'Failed to mark notifications as read', error);
      }

      return successResponse(res, {
        message: 'All notifications marked as read'
      });
    }

    // Mark all notifications as unread
    if (markAllUnread) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: false, updated_at: new Date().toISOString() })
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq('is_read', true);

      if (error) {
        return errorResponse(res, 500, 'Failed to mark notifications as unread', error);
      }

      return successResponse(res, {
        message: 'All notifications marked as unread'
      });
    }

    return errorResponse(res, 400, 'No action specified');

  } catch (error) {
    console.error('Mark notification error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
