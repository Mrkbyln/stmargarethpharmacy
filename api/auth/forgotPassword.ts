import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, validateEmail } from '../utils/helpers';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD
  }
});

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
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      return errorResponse(res, 400, 'Valid email is required');
    }

    // Find user by email
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      // Don't reveal if email exists
      return successResponse(res, {
        message: 'If email exists, verification code will be sent'
      });
    }

    // Generate verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store verification code
    const { error: insertError } = await supabase
      .from('password_resets')
      .insert({
        user_id: user.id,
        verification_code: verificationCode,
        expires_at: expiresAt.toISOString(),
        is_used: false
      });

    if (insertError) {
      console.error('Error storing verification code:', insertError);
      return errorResponse(res, 500, 'Failed to send verification code');
    }

    // Send email
    try {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'St. Margareth Pharmacy - Password Reset Code',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>Hello ${user.full_name || user.username},</p>
            <p>We received a request to reset your password. Here is your verification code:</p>
            <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h3 style="margin: 0; color: #333;">${verificationCode}</h3>
            </div>
            <p>This code will expire in 15 minutes.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <p>Best regards,<br>St. Margareth Pharmacy Team</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      return errorResponse(res, 500, 'Failed to send verification code');
    }

    return successResponse(res, {
      message: 'Verification code sent to email',
      email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
