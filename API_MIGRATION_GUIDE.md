# API Migration Guide: PHP to Vercel Serverless Functions

## Overview
This guide walks you through migrating the St. Margareth Pharmacy system from PHP API endpoints to Vercel serverless functions with Supabase as the database.

## Prerequisites
- Node.js 18+ installed
- Vercel account (for deployment)
- Supabase account (for PostgreSQL database)
- Gmail account with app-specific password

## Step 1: Supabase Setup

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Save your project URL and Service Role Key
3. In SQL Editor, paste and run the contents of `SUPABASE_MIGRATION.sql`

### 1.2 Hash Passwords
Before running the SQL migration, you need to hash the sample passwords:

```javascript
// Use this Node.js snippet to generate password hashes:
const crypto = require('crypto');
const salt = 'your_random_salt_here_min_32_characters';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

console.log('admin:', hashPassword('admin'));
console.log('janna:', hashPassword('janna'));
```

Update the `SUPABASE_MIGRATION.sql` file's user insertion section with these hashes.

## Step 2: Environment Configuration

### 2.1 Copy environment file
```bash
cp .env.local.example .env.local
```

### 2.2 Fill in environment variables
Edit `.env.local` with your actual values:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-app-specific-password
PASSWORD_SALT=your_random_salt_min_32_characters
```

### 2.3 Gmail App-Specific Password
1. Enable 2FA on your Gmail account
2. Go to [myaccount.google.com/app-passwords](https://myaccount.google.com/app-passwords)
3. Generate an app-specific password for Mail → Windows Computer
4. Use this password in `.env.local`

## Step 3: Install Dependencies

```bash
npm install
```

This will install:
- `@supabase/supabase-js` - Supabase client
- `@vercel/node` - Vercel functions support
- `nodemailer` - Email sending
- All other dependencies

## Step 4: Test Locally

### 4.1 Start development server
```bash
npm run dev
```

The React app will run on `http://localhost:5173`

### 4.2 Test API routes
Create a simple test script to verify API endpoints are working:

```javascript
// Test login endpoint
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123',
    role: 'admin'
  })
});

const data = await response.json();
console.log(data);
```

**Note:** Local testing of `/api/` routes requires a Node.js server. The API routes are designed for Vercel deployment.

## Step 5: Update API Client

The existing `src/lib/apiClient.ts` needs to be updated to:
1. Change base URL from `/api` to your Vercel deployment URL
2. Update all endpoints from PHP files to serverless functions

Example changes:
```typescript
// OLD
return this.request<any[]>('/products/read.php');

// NEW
return this.request<any[]>('/api/products/list');
```

See `API_CLIENT_UPDATE.md` for complete changes.

## Step 6: Build for Production

```bash
npm run build
```

This creates optimized bundles in the `dist/` directory.

## Step 7: Deploy to Vercel

### 7.1 Install Vercel CLI
```bash
npm install -g vercel
```

### 7.2 Deploy
```bash
vercel
```

Follow the prompts to:
1. Connect to your Vercel account
2. Link to a Git repository (recommended)
3. Set environment variables in Vercel dashboard

### 7.3 Set Environment Variables in Vercel
1. Go to your project settings in Vercel
2. Go to Environment Variables
3. Add all variables from `.env.local`

## Step 8: CSV Export Fix (Critical)

The audit logging issue for CSV exports is now fixed. The `/api/auditlogs/log` endpoint is automatically called when:

1. **CSV Export** (`/api/products/export` or frontend):
   - Action: "Exported Products Report CSV"
   - Logged with product count and export date

2. **All Product Operations**:
   - Create: Logged with product details
   - Update: Logged with changed fields
   - Delete: Logged with product name and code

The audit logs are stored in the `audit_logs` table in Supabase and can be viewed via `/api/auditlogs/get`.

### To ensure logging works:
Update your React component CSV export to call the audit log endpoint:

```typescript
const exportToCSV = async () => {
  const userId = user?.id ? Number(user.id) : undefined;
  
  // Log to new audit endpoint
  await fetch('/api/auditlogs/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      action: 'Exported Products Report CSV',
      details: {
        product_count: filteredMedicines.length,
        export_date: new Date().toISOString()
      }
    })
  }).catch(err => console.error('Audit log failed:', err));

  // ... rest of CSV generation code
};
```

## API Endpoint Reference

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/forgotPassword` - Send password reset code
- `POST /api/auth/verifyCode` - Verify reset code
- `POST /api/auth/resetPassword` - Reset password with token

### Products
- `GET /api/products/list` - List products with filters
- `POST /api/products/create` - Create new product
- `PUT /api/products/update?productId=123` - Update product
- `DELETE /api/products/delete` - Delete product (soft delete)
- `GET /api/products/categories` - Get product categories

### Users
- `GET /api/users/list` - List all users
- `POST /api/users/create` - Create new user
- `PUT /api/users/update?userId=123` - Update user
- `GET /api/users/getUser?userId=123` - Get specific user

### Sales
- `POST /api/sales/create` - Create new sale
- `GET /api/sales/list` - List sales (date range optional)
- `GET /api/sales/getTransactions` - Get all transactions

### Notifications
- `GET /api/notifications/list` - Get notifications
- `PUT /api/notifications/markRead` - Mark notifications as read
- `GET /api/notifications/check` - Get unread count

### Audit Logs
- `POST /api/auditlogs/log` - Log audit event
- `GET /api/auditlogs/get` - Get audit logs (admin/staff only)

## Authentication

All API endpoints except login, forgotPassword, verifyCode, and resetPassword require a Bearer token:

```
Authorization: Bearer base64({id, username, role})
```

The token is returned from `/api/auth/login` and should be stored in localStorage.

## Troubleshooting

### 1. "Missing Supabase credentials"
- Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### 2. "Failed to create product"
- Check Supabase database connection
- Verify schema was created with `SUPABASE_MIGRATION.sql`
- Check user role permissions

### 3. "Password mismatch"
- Ensure PASSWORD_SALT in `.env.local` matches the salt used to hash passwords
- Re-hash passwords in Supabase with correct salt

### 4. "Gmail not working"
- Use app-specific password, not regular Gmail password
- Enable 2FA on Gmail account
- Check GMAIL_USER and GMAIL_PASSWORD in `.env.local`

### 5. "CORS errors"
- CORS headers are set in each API route
- If still having issues, check Vercel deployment logs

## Next Steps

1. Migrate remaining data from MySQL to Supabase
2. Update frontend to use new API endpoints
3. Implement proper JWT token handling
4. Add input validation and rate limiting
5. Set up automated backups in Supabase
6. Monitor audit logs for suspicious activity
7. Implement email notifications for critical events

## Support

For issues, check:
- Vercel deployment logs: `vercel logs`
- Supabase dashboard for database errors
- Browser console for client-side errors
- API response status codes and error messages
