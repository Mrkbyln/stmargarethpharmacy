# Vercel Deployment Checklist

## Environment Variables to Add in Vercel Dashboard

Copy these exactly into Vercel → Settings → Environment Variables:

### Variable 1: NEXT_PUBLIC_SUPABASE_URL
```
https://btflwhesaundzdnpjcdi.supabase.co
```

### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
```
REPLACED_WITH_VERCEL_SECRET_REFERENCE
Use Vercel dashboard: Settings → Environment Variables → Add "@supabase_anon_key"
```

### Variable 3: SUPABASE_SERVICE_ROLE_KEY
```
REPLACED_WITH_VERCEL_SECRET_REFERENCE
Use Vercel dashboard: Settings → Environment Variables → Add "@supabase_key"
```

## Deployment Steps

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Add complete Supabase and API configuration"
   git push origin main
   ```

2. Go to https://vercel.com/dashboard

3. Click "Add New" → "Project"

4. Select your **stmargareth** repository

5. In the configuration page:
   - **Framework Preset:** Leave as auto-detected
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

6. Add the 3 environment variables above

7. Click "Deploy"

8. Wait for build to complete

## Test Your Deployment

Once deployed, test an endpoint:

```bash
curl https://your-vercel-domain.vercel.app/api/products/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Your API endpoints will be available at:
```
https://your-vercel-domain.vercel.app/api/[endpoint]
```

## API Endpoints Available

- `/api/auth/*` - Authentication
- `/api/products/*` - Product management
- `/api/users/*` - User management
- `/api/sales/*` - Sales transactions
- `/api/discounts/*` - Discount management
- `/api/inventory/*` - Stock management
- `/api/reports/*` - Analytics reports
- `/api/changeitem/*` - Returns/exchanges
- `/api/notifications/*` - User notifications
- `/api/auditlogs/*` - Audit logging

See API_ENDPOINTS_COMPLETE.md for full documentation.
