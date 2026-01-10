# Quick Start Guide - St. Margareth Pharmacy API Migration

## ⚡ 5-Minute Setup

### Step 1: Supabase Project (2 min)
```bash
1. Go to https://supabase.com
2. Create new project
3. Copy Project URL and Service Role Key
4. Go to SQL Editor
5. Paste SUPABASE_MIGRATION.sql content
6. Click "Run"
```

### Step 2: Environment Variables (1 min)
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
GMAIL_USER=<your_gmail@gmail.com>
GMAIL_PASSWORD=<app_specific_password>
PASSWORD_SALT=<random_32_char_string>
```

### Step 3: Install & Run (2 min)
```bash
npm install
npm run dev
```

That's it! API is ready to test.

---

## 📋 What Was Created

### 21 API Endpoints (Ready to Use)

**Authentication** (4 endpoints)
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgotPassword` - Request reset code
- `POST /api/auth/verifyCode` - Verify reset code
- `POST /api/auth/resetPassword` - Set new password

**Products** (5 endpoints)
- `GET /api/products/list` - List products
- `POST /api/products/create` - Create product ✓ Logs to audit
- `PUT /api/products/update` - Update product ✓ Logs to audit
- `DELETE /api/products/delete` - Delete product ✓ Logs to audit
- `GET /api/products/categories` - Get categories

**Users** (4 endpoints)
- `GET /api/users/list` - List users
- `POST /api/users/create` - Create user ✓ Logs to audit
- `PUT /api/users/update` - Update user ✓ Logs to audit
- `GET /api/users/getUser` - Get single user

**Sales** (3 endpoints)
- `POST /api/sales/create` - Record sale ✓ Logs to audit
- `GET /api/sales/list` - Get sales by date
- `GET /api/sales/getTransactions` - All transactions

**Notifications** (3 endpoints)
- `GET /api/notifications/list` - Get notifications
- `PUT /api/notifications/markRead` - Mark as read
- `GET /api/notifications/check` - Unread count

**Audit Logs** (2 endpoints) - **FIX FOR CSV EXPORT**
- `POST /api/auditlogs/log` - Log any action
- `GET /api/auditlogs/get` - View logs

---

## 🔑 Key Features

✅ **CSV Export Logging** - Now fully tracked  
✅ **Email Password Reset** - Works with Gmail  
✅ **User Roles** - admin, staff, pharmacy_assistant  
✅ **Rate Limiting** - 5 login attempts per 15 min  
✅ **Pagination** - All list endpoints support it  
✅ **Audit Trail** - Complete activity history  
✅ **Error Handling** - Standard JSON responses  
✅ **CORS Support** - Cross-domain requests  

---

## 🧪 Test It (Copy & Paste)

### Test Login
```javascript
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123',
    role: 'admin'
  })
}).then(r => r.json()).then(d => console.log(d));
```

### Test Product Creation (with token from login)
```javascript
const token = 'YOUR_TOKEN_FROM_LOGIN';

fetch('http://localhost:3000/api/products/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    product_code: 'PARACETAMOL001',
    product_name: 'Paracetamol 500mg',
    unit_price: 5.00,
    selling_price: 10.00
  })
}).then(r => r.json()).then(d => console.log(d));
```

### Check Audit Logs
```javascript
const token = 'YOUR_TOKEN_FROM_LOGIN';

fetch('http://localhost:3000/api/auditlogs/get', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(d => console.log(d.data.logs));
```

---

## 📝 Critical Changes Needed

Only 1 file needs major updates:

### Update `src/lib/apiClient.ts`
Change all PHP endpoints to new ones:

**Before:**
```typescript
return this.request('/products/read.php');
return this.request('/sales/create.php', 'POST', data);
return this.request('/users/create.php', 'POST', data);
```

**After:**
```typescript
return this.request('/api/products/list');
return this.request('/api/sales/create', 'POST', data);
return this.request('/api/users/create', 'POST', data);
```

See [API_CLIENT_UPDATE.md](API_CLIENT_UPDATE.md) for complete mapping.

---

## 🚀 Deploy to Vercel

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Deploy
```bash
vercel
```

### 3. Set Environment Variables
In Vercel dashboard → Project Settings → Environment Variables, add:
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- GMAIL_USER
- GMAIL_PASSWORD
- PASSWORD_SALT

### 4. Update API Base URL
In `src/lib/apiClient.ts`:
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/api`;
```

---

## 📊 File Locations

All new API files are in:
```
api/
├── auth/          (4 files)
├── products/      (5 files)
├── users/         (4 files)
├── sales/         (3 files)
├── notifications/ (3 files)
├── auditlogs/     (2 files)  ← CSV FIX HERE
└── utils/         (2 files)
```

Documentation:
```
├── API_MIGRATION_GUIDE.md     (Full setup steps)
├── API_CLIENT_UPDATE.md       (All code changes)
├── COMPLETE_API_SUMMARY.md    (Detailed overview)
├── FILE_STRUCTURE.md          (Directory layout)
├── SUPABASE_MIGRATION.sql     (Database schema)
├── .env.local.example         (Config template)
├── vercel.json                (Deployment config)
└── package.json               (Updated dependencies)
```

---

## ⚠️ Common Issues

**Q: "Missing Supabase credentials"**  
A: Check `.env.local` has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

**Q: "Failed to create product"**  
A: Make sure SQL migration ran successfully and user has 'staff' or 'admin' role

**Q: "Gmail not sending"**  
A: Use app-specific password (not regular Gmail password). Enable 2FA first.

**Q: "Audit logs not showing"**  
A: Log in with admin or staff role. Pharmacy assistants can't view logs.

**Q: "CORS errors"**  
A: CORS headers are included in all routes. May need to check Vercel logs.

---

## ✅ Checklist Before Deploying

- [ ] Supabase project created
- [ ] SQL migration executed
- [ ] `.env.local` file filled out
- [ ] `npm install` completed
- [ ] Local tests pass (`npm run dev`)
- [ ] `API_CLIENT_UPDATE.md` changes applied
- [ ] Build successful (`npm run build`)
- [ ] Vercel account ready
- [ ] Environment variables set in Vercel
- [ ] Redeploy after env vars set

---

## 📞 Support

Having issues? Check these in order:

1. **Local errors**: Check browser console + `npm run dev` output
2. **Deployment errors**: Check Vercel logs with `vercel logs`
3. **Database errors**: Check Supabase dashboard → Logs
4. **Email errors**: Verify Gmail app password in `.env.local`
5. **Auth errors**: Make sure PASSWORD_SALT matches in `.env.local`

---

## 🎯 Next: Update API Client

Follow [API_CLIENT_UPDATE.md](API_CLIENT_UPDATE.md) to update your frontend API calls.

This will map all 20+ endpoints from PHP to the new Vercel functions.

---

**Time to deployment: ~30 minutes**

**Status: ✅ Ready to Go**
