// api/index.ts - Unified API router for Vercel Hobby plan
// Routes all requests to appropriate handlers to work within the 12 function limit

import { VercelRequest, VercelResponse } from '@vercel/node';

export default async (req: VercelRequest, res: VercelResponse) => {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);
  
  try {
    // Extract path segments
    const segments = pathname.replace('/api', '').split('/').filter(Boolean);
    
    if (segments.length === 0) {
      return res.status(404).json({ error: 'No API endpoint specified' });
    }

    const [resource, action] = segments;

    // Route to appropriate handler
    switch (resource) {
      case 'auth':
        return handleAuth(req, res, action);
      
      case 'products':
        return handleProducts(req, res, action);
      
      case 'users':
        return handleUsers(req, res, action);
      
      case 'sales':
        return handleSales(req, res, action);
      
      case 'notifications':
        return handleNotifications(req, res, action);
      
      case 'auditlogs':
        return handleAuditLogs(req, res, action);
      
      case 'inventory':
        return handleInventory(req, res, action);
      
      case 'discounts':
        return handleDiscounts(req, res, action);
      
      case 'changeitem':
        return handleChangeItem(req, res, action);
      
      case 'reports':
        return handleReports(req, res, action);
      
      default:
        return res.status(404).json({ error: 'Unknown API endpoint', resource });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// ===== Handler Functions =====

async function handleAuth(req: VercelRequest, res: VercelResponse, action: string) {
  const handlers: Record<string, () => Promise<any>> = {
    'login': async () => (await import('./auth/login')).default(req, res),
    'forgot-password': async () => (await import('./auth/forgotPassword')).default(req, res),
    'reset-password': async () => (await import('./auth/resetPassword')).default(req, res),
    'verify-code': async () => (await import('./auth/verifyCode')).default(req, res),
  };
  
  if (handlers[action]) {
    return await handlers[action]();
  }
  return res.status(404).json({ error: `Auth action not found: ${action}` });
}

async function handleProducts(req: VercelRequest, res: VercelResponse, action: string) {
  const handlers: Record<string, () => Promise<any>> = {
    'list': async () => (await import('./products/list')).default(req, res),
    'create': async () => (await import('./products/create')).default(req, res),
    'update': async () => (await import('./products/update')).default(req, res),
    'delete': async () => (await import('./products/delete')).default(req, res),
    'categories': async () => (await import('./products/categories')).default(req, res),
  };
  
  if (handlers[action]) {
    return await handlers[action]();
  }
  return res.status(404).json({ error: `Products action not found: ${action}` });
}

async function handleUsers(req: VercelRequest, res: VercelResponse, action: string) {
  const handlers: Record<string, () => Promise<any>> = {
    'list': async () => (await import('./users/list')).default(req, res),
    'create': async () => (await import('./users/create')).default(req, res),
    'get': async () => (await import('./users/getUser')).default(req, res),
    'update': async () => (await import('./users/update')).default(req, res),
  };
  
  if (handlers[action]) {
    return await handlers[action]();
  }
  return res.status(404).json({ error: `Users action not found: ${action}` });
}

async function handleSales(req: VercelRequest, res: VercelResponse, action: string) {
  const handlers: Record<string, () => Promise<any>> = {
    'list': async () => (await import('./sales/list')).default(req, res),
    'create': async () => (await import('./sales/create')).default(req, res),
    'transactions': async () => (await import('./sales/getTransactions')).default(req, res),
  };
  
  if (handlers[action]) {
    return await handlers[action]();
  }
  return res.status(404).json({ error: `Sales action not found: ${action}` });
}

async function handleNotifications(req: VercelRequest, res: VercelResponse, action: string) {
  const handlers: Record<string, () => Promise<any>> = {
    'list': async () => (await import('./notifications/list')).default(req, res),
    'check': async () => (await import('./notifications/check')).default(req, res),
    'mark-read': async () => (await import('./notifications/markRead')).default(req, res),
  };
  
  if (handlers[action]) {
    return await handlers[action]();
  }
  return res.status(404).json({ error: `Notifications action not found: ${action}` });
}

async function handleAuditLogs(req: VercelRequest, res: VercelResponse, action: string) {
  const handlers: Record<string, () => Promise<any>> = {
    'list': async () => (await import('./auditlogs/get')).default(req, res),
    'log': async () => (await import('./auditlogs/log')).default(req, res),
  };
  
  if (handlers[action]) {
    return await handlers[action]();
  }
  return res.status(404).json({ error: `AuditLogs action not found: ${action}` });
}

async function handleInventory(req: VercelRequest, res: VercelResponse, action: string) {
  const handlers: Record<string, () => Promise<any>> = {
    'list': async () => (await import('./inventory/list')).default(req, res),
    'low-stock': async () => (await import('./inventory/low-stock')).default(req, res),
    'expired': async () => (await import('./inventory/expired')).default(req, res),
    'damaged': async () => (await import('./inventory/damaged-items')).default(req, res),
    'stock-entries': async () => (await import('./inventory/stock-entries')).default(req, res),
  };
  
  if (handlers[action]) {
    return await handlers[action]();
  }
  return res.status(404).json({ error: `Inventory action not found: ${action}` });
}

async function handleDiscounts(req: VercelRequest, res: VercelResponse, action: string) {
  const handlers: Record<string, () => Promise<any>> = {
    'list': async () => (await import('./discounts/list')).default(req, res),
    'create': async () => (await import('./discounts/create')).default(req, res),
    'update': async () => (await import('./discounts/update')).default(req, res),
    'delete': async () => (await import('./discounts/delete')).default(req, res),
  };
  
  if (handlers[action]) {
    return await handlers[action]();
  }
  return res.status(404).json({ error: `Discounts action not found: ${action}` });
}

async function handleChangeItem(req: VercelRequest, res: VercelResponse, action: string) {
  const handlers: Record<string, () => Promise<any>> = {
    'list': async () => (await import('./changeitem/read')).default(req, res),
    'create': async () => (await import('./changeitem/create')).default(req, res),
  };
  
  if (handlers[action]) {
    return await handlers[action]();
  }
  return res.status(404).json({ error: `ChangeItem action not found: ${action}` });
}

async function handleReports(req: VercelRequest, res: VercelResponse, action: string) {
  const handlers: Record<string, () => Promise<any>> = {
    'sales': async () => (await import('./reports/sales-summary')).default(req, res),
    'inventory': async () => (await import('./reports/inventory-summary')).default(req, res),
    'damage': async () => (await import('./reports/damage-report')).default(req, res),
    'audit': async () => (await import('./reports/audit-summary')).default(req, res),
  };
  
  if (handlers[action]) {
    return await handlers[action]();
  }
  return res.status(404).json({ error: `Reports action not found: ${action}` });
}
