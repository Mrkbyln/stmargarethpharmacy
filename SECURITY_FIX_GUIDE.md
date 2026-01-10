# 🚨 URGENT: Secret Key Rotation & Security Fix

## Issue
Supabase API keys were exposed in GitHub repository.

## Actions Completed

### ✅ Files Fixed
- [api/utils/db.ts](api/utils/db.ts) - Removed hardcoded anon key
- [.env.production](.env.production) - Removed all secrets, added comments
- [VERCEL_ENV_VARIABLES.md](VERCEL_ENV_VARIABLES.md) - Removed exposed service key

## 🔴 IMMEDIATE ACTIONS REQUIRED

### 1. Rotate Supabase Keys (CRITICAL)
Since keys were exposed, **you MUST rotate them immediately**:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select project `btflwhesaunzdqnpjcdi`
3. Click **Settings** → **API**
4. Under "Project API keys":
   - Click the 🔄 icon next to "anon" key → "Rotate key"
   - Click the 🔄 icon next to "service_role" key → "Rotate key"
5. Copy the new keys

### 2. Update Environment Variables in Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **Settings** → **Environment Variables**
4. Update:
   - `NEXT_PUBLIC_SUPABASE_URL` = Your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = NEW anon key from step 1
   - `SUPABASE_SERVICE_ROLE_KEY` = NEW service role key from step 1
5. Click "Save"

### 3. Re-deploy to Vercel
```bash
vercel --prod
```

### 4. Update Local .env (Optional)
Only if developing locally, edit `.env`:
```dotenv
VITE_SUPABASE_URL=https://btflwhesaunzdqnpjcdi.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_NEW_ANON_KEY
```

## 🛡️ Security Best Practices

### ❌ NEVER DO THIS
- Commit `.env` files with real secrets
- Hardcode API keys in source code
- Share secrets via GitHub

### ✅ DO THIS INSTEAD
- Use `.env.local` for local development (ignored by git)
- Use Vercel Environment Variables for production
- Use `@secret_reference` in vercel.json for secret references
- Rotate keys regularly

## Verification Checklist
- [ ] Supabase keys rotated
- [ ] Vercel environment variables updated
- [ ] Re-deployed to production
- [ ] Local development tests pass
- [ ] No new secrets in git history

## Files to Never Commit
```
.env                  # Local development
.env.local           # Local secrets
.env.production      # Don't commit with real secrets
.pgpass              # Database password file
.aws/credentials     # AWS credentials
```

## If Keys Were Stolen
1. Rotate all keys immediately (done above)
2. Monitor Supabase audit logs for suspicious activity
3. Check GitHub for any unauthorized pushes
4. Enable branch protection rules on main

---
**Last Updated:** January 10, 2026
**Status:** ✅ Secrets removed from repository
