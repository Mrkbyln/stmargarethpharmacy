import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './db';

// Extract user ID from JWT token (basic implementation)
export function getUserFromRequest(req: VercelRequest): { id: number; username: string; role: string } | null {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    // In production, verify JWT properly
    // For now, token structure: base64({id, username, role})
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    return decoded;
  } catch (error) {
    return null;
  }
}

// Input validation helpers
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain number');
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Error response helper
export function errorResponse(res: VercelResponse, status: number, message: string, details?: any) {
  return res.status(status).json({
    success: false,
    error: message,
    details: details || null
  });
}

// Success response helper
export function successResponse(res: VercelResponse, data: any, status: number = 200) {
  return res.status(status).json({
    success: true,
    data
  });
}

// Check user role permission
export async function checkUserRole(req: VercelRequest, requiredRole: string[] | string): Promise<boolean> {
  const user = getUserFromRequest(req);
  if (!user) return false;

  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return requiredRoles.includes(user.role);
}

// Hash password (use bcrypt in production)
export async function hashPassword(password: string): Promise<string> {
  // For development: use Node crypto
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password + process.env.PASSWORD_SALT).digest('hex');
}

// Compare password
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const crypto = require('crypto');
  const hashPassword = crypto.createHash('sha256').update(password + process.env.PASSWORD_SALT).digest('hex');
  return hashPassword === hash;
}

// Generate JWT token (basic implementation)
export function generateToken(user: { id: number; username: string; role: string }): string {
  return Buffer.from(JSON.stringify(user)).toString('base64');
}

// Rate limiting helper
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(ip: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const userRequests = requestCounts.get(ip);

  if (!userRequests || now > userRequests.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (userRequests.count >= maxRequests) {
    return false;
  }

  userRequests.count++;
  return true;
}

// Log audit event
export async function logAuditEvent(userId: number, action: string, details?: any, req?: VercelRequest) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      details: details ? JSON.stringify(details) : null,
      ip_address: req?.headers['x-forwarded-for'] || req?.socket.remoteAddress,
      user_agent: req?.headers['user-agent'],
      timestamp: new Date().toISOString()
    });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (err) {
    console.error('Error logging audit event:', err);
  }
}
