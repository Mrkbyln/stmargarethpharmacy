# Google OAuth Secret Detected - Action Required

## Issue
GitHub detected exposed Google OAuth credentials in `.env` (removed).

## ✅ Fixed
- [.env](.env) - Replaced with placeholders
- [.env.example](.env.example) - Created template for developers
- [.gitignore](.gitignore) - Updated to prevent future .env commits

## 🔴 IMMEDIATE ACTIONS REQUIRED

### 1. Rotate Google OAuth Credentials (CRITICAL)
Your credentials are now compromised. You must rotate them:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to **Credentials**
4. Find your OAuth 2.0 Client ID
5. Click the **🗑️ Delete** button
6. Create a new OAuth 2.0 Client ID:
   - Click **+ Create Credentials**
   - Select **OAuth 2.0 Client ID**
   - Choose application type
   - Copy the new Client ID and Secret
7. Update your local `.env`:
   ```
   GOOGLE_CLIENT_ID=YOUR_NEW_CLIENT_ID
   GOOGLE_CLIENT_SECRET=YOUR_NEW_CLIENT_SECRET
   ```

### 2. Remove Secret from GitHub History
If the secret was already pushed to GitHub:

```bash
# Option A: Remove the commit (if not merged)
git reset --soft HEAD~1
git add -A
git commit -m "Remove exposed secrets"
git push --force-with-lease

# Option B: Use BFG Repo-Cleaner (recommended for large repos)
# Download: https://rtyley.github.io/bfg-repo-cleaner/
bfg --delete-files .env
bfg --replace-text passwords.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease
```

### 3. Configure GitHub Secret Scanning
1. Go to your GitHub repo
2. Settings → Security → Secret scanning
3. Enable "Secret scanning" if not already enabled
4. Add custom patterns for your app

### 4. Update All Environments
- **Local Development**: Use new credentials in `.env`
- **Vercel Production**: Update environment variables
  - Go to Vercel Dashboard → Settings → Environment Variables
  - Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  - Redeploy: `vercel --prod`

## ✅ Best Practices

### Never Commit Secrets
```bash
# ❌ Wrong - Exposes secrets
git add .env
git commit -m "Add config"

# ✅ Correct - Only commit template
git add .env.example
cp .env.example .env
# .env is in .gitignore, stays local
```

### Local Development Setup
```bash
# 1. Clone repo
git clone <repo>

# 2. Copy template
cp .env.example .env

# 3. Add your secrets
# Edit .env with your actual credentials
# NEVER commit this file

# 4. Start developing
npm run dev
```

### Files Never to Commit
```
.env                    # All environment files
.env.local
.env.*.local
.env.production
.pgpass                 # Database passwords
.aws/credentials        # AWS keys
secrets.json            # Any secrets file
```

## Verification Checklist
- [ ] New Google OAuth credentials created
- [ ] Old credentials deleted in Google Cloud Console
- [ ] Local `.env` updated with new credentials
- [ ] Vercel environment variables updated
- [ ] Vercel redeployed (`vercel --prod`)
- [ ] `.gitignore` includes all `.env` files
- [ ] No `.env` files in git history (if pushed, use BFG)
- [ ] GitHub secret scanning enabled

---
**Last Updated:** January 10, 2026
**Status:** ✅ Secrets removed from repository
