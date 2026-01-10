import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse } from '../utils/helpers';

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
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      return errorResponse(res, 400, 'Email and verification code are required');
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

    // Verify the code
    const { data: resetRecord, error: resetError } = await supabase
      .from('password_resets')
      .select('*')
      .eq('user_id', user.id)
      .eq('verification_code', verificationCode)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (resetError || !resetRecord) {
      return errorResponse(res, 401, 'Invalid or expired verification code');
    }

    // Generate a temporary reset token (valid for 1 hour)
    const resetToken = Buffer.from(JSON.stringify({
      userId: user.id,
      email,
      timestamp: Date.now()
    })).toString('base64');

    return successResponse(res, {
      message: 'Code verified successfully',
      resetToken,
      expiresIn: 3600 // 1 hour
    });

  } catch (error) {
    console.error('Verify code error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
