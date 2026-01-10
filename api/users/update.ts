import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest, logAuditEvent, hashPassword, validateEmail } from '../utils/helpers';

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
    
    // Only admin and staff can update users
    if (!user || !['admin', 'staff'].includes(user.role)) {
      return errorResponse(res, 403, 'Unauthorized. Only admin and staff can update users.');
    }

    const { userId } = req.query;
    
    if (!userId) {
      return errorResponse(res, 400, 'User ID is required');
    }

    const updates: any = {
      updated_at: new Date().toISOString()
    };

    const { username, email, password, role, full_name, is_active } = req.body;

    // Update username
    if (username !== undefined) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return errorResponse(res, 409, 'Username already exists');
      }
      updates.username = username;
    }

    // Update email
    if (email !== undefined) {
      if (!validateEmail(email)) {
        return errorResponse(res, 400, 'Invalid email format');
      }

      const { data: existingEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .single();

      if (existingEmail) {
        return errorResponse(res, 409, 'Email already exists');
      }
      updates.email = email;
    }

    // Update password
    if (password !== undefined) {
      updates.password_hash = await hashPassword(password);
    }

    // Update role
    if (role !== undefined) {
      if (!['admin', 'staff', 'pharmacy_assistant'].includes(role)) {
        return errorResponse(res, 400, 'Invalid role');
      }
      updates.role = role;
    }

    // Update full name
    if (full_name !== undefined) {
      updates.full_name = full_name;
    }

    // Update is_active
    if (is_active !== undefined) {
      updates.is_active = is_active;
    }

    // Update user
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, username, email, role, full_name, is_active');

    if (error) {
      return errorResponse(res, 500, 'Failed to update user', error);
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'User Updated',
      {
        target_user_id: userId,
        changes: updates
      },
      req
    );

    return successResponse(res, {
      message: 'User updated successfully',
      user: data?.[0]
    });

  } catch (error) {
    console.error('User update error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
