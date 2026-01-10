import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../utils/db';
import { 
  errorResponse, 
  successResponse, 
  validateEmail, 
  hashPassword, 
  comparePassword,
  generateToken,
  logAuditEvent,
  checkRateLimit
} from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
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
    const clientIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
    
    // Rate limiting
    if (!checkRateLimit(clientIp, 5, 15 * 60 * 1000)) {
      return errorResponse(res, 429, 'Too many login attempts. Please try again later.');
    }

    const { username, password, role } = req.body;

    // Validation
    if (!username || !password) {
      return errorResponse(res, 400, 'Username and password are required');
    }

    if (!role || !['admin', 'staff', 'pharmacy_assistant'].includes(role)) {
      return errorResponse(res, 400, 'Invalid role selected');
    }

    // Find user by username and role
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('role', role)
      .single();

    if (fetchError || !users) {
      return errorResponse(res, 401, 'Invalid username or password');
    }

    if (!users.is_active) {
      return errorResponse(res, 401, 'User account is inactive');
    }

    // Verify password
    const passwordMatch = await comparePassword(password, users.password_hash);
    if (!passwordMatch) {
      // Log failed attempt
      await logAuditEvent(users.id, 'Failed Login Attempt', { reason: 'Invalid password', role }, req);
      return errorResponse(res, 401, 'Invalid username or password');
    }

    // Generate token
    const token = generateToken({
      id: users.id,
      username: users.username,
      role: users.role
    });

    // Log successful login
    await logAuditEvent(users.id, 'User Login', { role, timestamp: new Date().toISOString() }, req);

    return successResponse(res, {
      user: {
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        full_name: users.full_name
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, 500, 'Internal server error', error);
  }
}
