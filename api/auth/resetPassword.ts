import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, validatePassword, hashPassword, logAuditEvent } from '../utils/helpers';

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
    const { email, newPassword, resetToken } = req.body;

    if (!email || !newPassword || !resetToken) {
      return errorResponse(res, 400, 'Email, new password, and reset token are required');
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return errorResponse(res, 400, 'Password validation failed', passwordValidation.errors);
    }

    // Verify reset token
    try {
      const decoded = JSON.parse(Buffer.from(resetToken, 'base64').toString());
      if (decoded.email !== email || Date.now() - decoded.timestamp > 3600000) {
        return errorResponse(res, 401, 'Invalid or expired reset token');
      }
    } catch {
      return errorResponse(res, 401, 'Invalid reset token');
    }

    // Find user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      return errorResponse(res, 500, 'Failed to update password');
    }

    // Mark reset code as used
    const { error: markError } = await supabase
      .from('password_resets')
      .update({ is_used: true })
      .eq('user_id', user.id)
      .eq('is_used', false);

    if (markError) {
      console.error('Error marking reset code as used:', markError);
    }

    // Log audit event
    await logAuditEvent(user.id, 'Password Reset', { email }, req);

    return successResponse(res, {
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
