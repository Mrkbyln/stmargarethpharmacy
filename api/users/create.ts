import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { errorResponse, successResponse, getUserFromRequest, hashPassword, logAuditEvent, validateEmail, validatePassword } from '../utils/helpers';

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
    const user = getUserFromRequest(req);
    
    // Only admin can create users
    if (!user || user.role !== 'admin') {
      return errorResponse(res, 403, 'Unauthorized. Only admin can create users.');
    }

    const { username, email, password, role, full_name } = req.body;

    // Validation
    if (!username || !email || !password || !role) {
      return errorResponse(res, 400, 'Username, email, password, and role are required');
    }

    if (!validateEmail(email)) {
      return errorResponse(res, 400, 'Invalid email format');
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return errorResponse(res, 400, 'Password validation failed', passwordValidation.errors);
    }

    if (!['admin', 'staff', 'pharmacy_assistant'].includes(role)) {
      return errorResponse(res, 400, 'Invalid role');
    }

    // Check if username exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return errorResponse(res, 409, 'Username already exists');
    }

    // Check if email exists
    const { data: existingEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingEmail) {
      return errorResponse(res, 409, 'Email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        email,
        password_hash: passwordHash,
        role,
        full_name: full_name || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id, username, email, role, full_name, is_active, created_at');

    if (error) {
      return errorResponse(res, 500, 'Failed to create user', error);
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'User Created',
      {
        new_user_username: username,
        new_user_email: email,
        new_user_role: role
      },
      req
    );

    return successResponse(res, {
      message: 'User created successfully',
      user: data?.[0]
    }, 201);

  } catch (error) {
    console.error('User creation error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
