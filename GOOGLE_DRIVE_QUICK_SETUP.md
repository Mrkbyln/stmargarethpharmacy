# Quick Google Drive Backup Setup

## TL;DR - 5 Minute Setup

### 1. Create Google Cloud Project
- Go to https://console.cloud.google.com
- Create new project (name: "Pharmacy Backup")
- Enable Google Drive API

### 2. Create Credentials
- APIs & Services → Credentials
- Create OAuth 2.0 Client ID (Desktop application)
- Download credentials

### 3. Configure System
Add to `.env` file in project root:
```
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

OR edit `api/config/google-drive-config.php`:
```php
define('GOOGLE_CLIENT_ID', 'YOUR_CLIENT_ID');
define('GOOGLE_CLIENT_SECRET', 'YOUR_CLIENT_SECRET');
```

### 4. Run Migration
```bash
curl -X POST http://localhost/api/backup/migrate-google-drive.php
```

### 5. Authenticate
1. Go to Settings page
2. Click "Connect to Google" button
3. Sign in with your Google account
4. Grant permissions
5. Done! Backups now upload to Google Drive automatically

## Verify Setup

Check if Google Drive is configured:
```bash
curl http://localhost/api/backup/google-auth-status.php
```

Should return:
```json
{
  "success": true,
  "configured": true,
  "authenticated": true,
  "message": "Google Drive is authenticated and ready"
}
```

## That's it!

Your backups will now be:
- ✅ Saved locally in `/backups/`
- ✅ Automatically uploaded to Google Drive
- ✅ Tracked in the database

## Troubleshooting

**"Not configured"?**
- Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set
- Restart PHP/web server

**"Not authenticated"?**
- Click "Connect to Google" in Settings
- Complete the sign-in flow

**Upload fails?**
- Re-authenticate in Settings
- Check Google Drive storage space
- Verify file size isn't too large

---

For detailed setup: See `GOOGLE_DRIVE_BACKUP_SETUP.md`

