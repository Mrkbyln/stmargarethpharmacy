# Pharmacy Management System - Setup Guide

## Environment Configuration for Vercel

### Required Environment Variables

Add these to your Vercel project settings (Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://btflwhesaundzdnpjcdi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_AeBVpLSSyKODlRuc1yhiog_XLYdkUC5
SUPABASE_SERVICE_ROLE_KEY=[Get from Supabase Settings → API → Service Role]
```

### How to Get Service Role Key

1. Go to https://app.supabase.com
2. Select "Mrkbyln's Project"
3. Click "Settings" → "API"
4. Copy the **Service Role** key (NOT the anon key)
5. Add to Vercel environment variables

### Database Schema Status

Your Supabase project "Mrkbyln's Project" already has 12 tables created:

✅ users
✅ products
✅ categories
✅ sales
✅ sale_items
✅ discounts
✅ password_resets
✅ audit_logs
✅ notifications
✅ stock_entries
✅ damaged_items
✅ change_items

All tables are properly indexed for performance.

### API Endpoints Ready

36 total endpoints across 10 route categories:
- Authentication (4)
- Products (5)
- Users (4)
- Sales (3)
- Notifications (3)
- Audit Logs (2)
- Discounts (4)
- Inventory (5)
- Change Items (2)
- Reports (4)

### Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add Supabase configuration and API endpoints"
   git push
   ```

2. **Connect to Vercel**
   - Visit https://vercel.com
   - Click "New Project"
   - Import your GitHub repository
   - Add environment variables (from above)
   - Click Deploy

3. **Verify Deployment**
   - Check Vercel dashboard for successful build
   - Test API endpoints from Vercel domain

### Testing Endpoints

Example request to create a product:

```bash
curl -X POST https://your-vercel-domain.vercel.app/api/products/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_code": "PROD001",
    "product_name": "Aspirin",
    "unit_price": 50,
    "selling_price": 75,
    "category_name": "Pain Relief"
  }'
```

### Support

- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- API Documentation: See API_ENDPOINTS_COMPLETE.md
