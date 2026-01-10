# Vercel + Supabase Setup Guide

## Problem
Supabase environment variables are not available on Vercel because `.env` files are not uploaded.

## Solution
Add environment variables to Vercel dashboard.

## Steps

### 1. Get Your Supabase Credentials
```
URL: https://btflwhesaunzdqnpjcdi.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0Zmx3aGVzYXVuemRxbnBqY2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NjQ0MzgsImV4cCI6MjA4MzQ0MDQzOH0.TPUN5tYIEIFzz0j6JPsCSN2caH-Hw97HOiNhTG5Zljs
```

### 2. Add Environment Variables to Vercel
Go to: **Vercel Dashboard → Project → Settings → Environment Variables**

Add these variables:

| Variable Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://btflwhesaunzdqnpjcdi.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key from above |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_AeBVpLSSyKODlRuc1yhiog_XLYdkUC5` |

### 3. Redeploy
After adding variables, redeploy your project:
```bash
vercel --prod
```

## Verification
Your Supabase client will now:
- ✅ Initialize correctly on Vercel
- ✅ Fall back gracefully if variables are missing
- ✅ Work in both local and production environments

## Notes
- `.env` files are local only and never uploaded
- Use Vercel dashboard for production secrets
- Use `.env.local` for local development
