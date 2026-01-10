# API Client Updates Required

## Summary of Changes
Replace all PHP endpoint calls with new Vercel serverless function calls.

## Changes Required in `src/lib/apiClient.ts`

### 1. Update Base URL
```typescript
// OLD
const API_BASE_URL = '/api';

// NEW
const API_BASE_URL = process.env.NEXT_PUBLIC_VERCEL_URL 
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/api`
  : 'http://localhost:3000/api';
```

### 2. Update Authentication Methods

**login()**
```typescript
// OLD
return this.request<any>('/auth/login.php', 'POST', { username, password, role });

// NEW
return this.request<any>('/auth/login', 'POST', { username, password, role });
```

**sendVerificationCode()**
```typescript
// OLD
return this.request<any>('/auth/send-verification-code.php', 'POST', { email });

// NEW
return this.request<any>('/auth/forgotPassword', 'POST', { email });
```

**verifyResetCode()**
```typescript
// OLD
return this.request<any>('/auth/verify-reset-code.php', 'POST', { email, verificationCode: code });

// NEW
return this.request<any>('/auth/verifyCode', 'POST', { email, verificationCode: code });
```

### 3. Update Product Methods

**getProducts()**
```typescript
// OLD
const queryString = new URLSearchParams(params).toString();
return this.request<any[]>(`/products/read.php${queryString ? `?${queryString}` : ''}`);

// NEW
const queryString = new URLSearchParams(params).toString();
return this.request<any[]>(`/products/list${queryString ? `?${queryString}` : ''}`);
```

**createProduct()**
```typescript
// OLD
return this.request<any>('/products/create.php', 'POST', productData);

// NEW
return this.request<any>('/products/create', 'POST', productData);
```

**updateProduct()**
```typescript
// OLD
return this.request<any>('/products/update.php', 'POST', { productId, ...productData });

// NEW
return this.request<any>(`/products/update?productId=${productId}`, 'PUT', productData);
```

**deleteProduct()**
```typescript
// OLD
return this.request<any>('/products/delete.php', 'POST', { productId });

// NEW
return this.request<any>(`/products/delete`, 'DELETE', { productId });
```

**getCategories()**
```typescript
// OLD
return this.request<any[]>('/products/categories.php');

// NEW
return this.request<any[]>('/products/categories');
```

### 4. Update Sales Methods

**createSale()**
```typescript
// OLD
return this.request<any>('/sales/create.php', 'POST', saleData);

// NEW
return this.request<any>('/sales/create', 'POST', {
  items: saleData.items,
  discount_id: saleData.discount_id,
  total_amount: saleData.total_amount,
  payment_method: saleData.payment_method,
  notes: saleData.notes
});
```

**getSales()**
```typescript
// OLD
let params = '';
if (startDate && endDate) {
  params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
}
return this.request<any[]>(`/sales/read.php${params}`);

// NEW
let params = '';
if (startDate && endDate) {
  params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
}
return this.request<any[]>(`/sales/list${params}`);
```

**getAllTransactions()**
```typescript
// OLD
return this.request<any[]>('/sales/get-all-transactions.php');

// NEW
return this.request<any[]>('/sales/getTransactions');
```

### 5. Update User Methods

**getUsers()**
```typescript
// OLD
return this.request<any[]>('/users/read.php');

// NEW
return this.request<any[]>('/users/list');
```

**createUser()**
```typescript
// OLD
return this.request<any>('/users/create.php', 'POST', userData);

// NEW
return this.request<any>('/users/create', 'POST', userData);
```

**updateUser()**
```typescript
// OLD
return this.request<any>('/users/update.php', 'POST', { userId, ...userData });

// NEW
return this.request<any>(`/users/update?userId=${userId}`, 'PUT', userData);
```

**deleteUser()**
```typescript
// OLD
return this.request<any>('/users/delete.php', 'POST', { userId, currentUserId });

// NEW
return this.request<any>(`/users/delete`, 'DELETE', { userId, currentUserId });
```

### 6. Update Notification Methods

**getNotifications()**
```typescript
// OLD
return this.request<any[]>('/reports/notifications.php', 'GET');

// NEW
return this.request<any[]>('/notifications/list', 'GET');
```

**getNotificationsByType()**
```typescript
// OLD
return this.request<any[]>(`/reports/notifications.php?type=${type}`, 'GET');

// NEW
return this.request<any[]>(`/notifications/list?type=${type}`, 'GET');
```

**markNotificationAsRead()**
```typescript
// OLD
return this.request<any>('/reports/notifications.php', 'PUT', { notificationId });

// NEW
return this.request<any>('/notifications/markRead', 'PUT', { notificationId });
```

**markAllNotificationsAsRead()**
```typescript
// OLD
return this.request<any>('/reports/notifications.php', 'PUT', { markAll: true });

// NEW
return this.request<any>('/notifications/markRead', 'PUT', { markAll: true });
```

**markAllNotificationsAsUnread()**
```typescript
// OLD
return this.request<any>('/reports/notifications.php', 'PUT', { markAllUnread: true });

// NEW
return this.request<any>('/notifications/markRead', 'PUT', { markAllUnread: true });
```

### 7. Update Audit Log Methods

**getAuditLogs()**
```typescript
// OLD
let params = '';
if (startDate && endDate) {
  params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
}
return this.request<any[]>(`/reports/audit_logs.php${params}`);

// NEW
let params = '';
if (startDate && endDate) {
  params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
}
return this.request<any[]>(`/auditlogs/get${params}`);
```

**logAction()**
```typescript
// OLD
const payload: any = { action };
if (userId) {
  payload.userId = userId;
}
return this.request<any>('/reports/log_action.php', 'POST', payload);

// NEW
const payload: any = { action };
if (userId) {
  payload.user_id = userId;
}
return this.request<any>('/auditlogs/log', 'POST', payload);
```

### 8. Inventory Methods (Keep as is for now, update later)
These need `/api/inventory/` routes to be created:
- getLowStockItems()
- getExpiredItems()
- getStockLevels()
- getStockEntries()
- addStockEntry()
- updateStockEntry()
- deleteStockEntry()

## Token Management

Add token management to API client:

```typescript
// Store token after login
localStorage.setItem('pharmacy_auth_token', response.data.token);

// Add token to all requests
private async request<T>(...) {
  const token = localStorage.getItem('pharmacy_auth_token');
  const headers: Record<string, string> = { ...this.headers };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // ... rest of request
}
```

## Error Handling Updates

The new error responses follow this format:

```typescript
{
  success: boolean,
  data: any,        // For successful responses
  error: string,    // For error responses
  details: any      // Optional error details
}
```

Update error handling:

```typescript
private async request<T>(...): Promise<ApiResponse<T>> {
  // ... existing code
  
  const responseData = await response.json();
  
  // Handle new response format
  if (!responseData.success) {
    return {
      success: false,
      data: null,
      error: responseData.error,
      details: responseData.details
    };
  }
  
  return {
    success: true,
    data: responseData.data,
    error: null
  };
}
```

## Rate Limiting

The API now enforces rate limiting (5 requests per 15 minutes for login):

```typescript
// Handle 429 status code
if (response.status === 429) {
  return {
    success: false,
    data: null,
    error: 'Too many requests. Please try again later.',
    details: null
  };
}
```

## CORS

All API routes have CORS headers enabled for your domain. No additional CORS setup needed.

## Next Steps

1. Update `src/lib/apiClient.ts` with all changes above
2. Test each endpoint locally
3. Deploy to Vercel
4. Update `.env` with your Vercel URL
5. Monitor logs for any issues
