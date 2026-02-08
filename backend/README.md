# Hostinger PHP backend for stmargarethpharmacy

This folder contains a minimal PHP REST API you can upload to Hostinger shared hosting (or any PHP+MySQL environment).

Files
- `config.php` — DB credentials and CORS origin. Update values or set environment variables.
- `db.php` — PDO connection helper.
- `api.php` — Main API router. Endpoints:
  - `GET /api/products` — list products
  - `GET /api/products/{id}` — product details
  - `POST /api/login` — login with JSON `{ "username": "", "password": "" }`
  - `POST /api/pos_sales` — create sale with JSON `{ "total": 123.45, "items": [...], "cashier_id": 1 }`
- `.htaccess` — rewrite rules to route `/api/*` to `api.php`.

Deployment
1. Upload the entire `backend` directory to your Hostinger site's document root (for example `public_html/backend`).
2. IMPORTANT: Do NOT commit or leave hardcoded DB credentials in `config.php`. Instead set the following environment variables in your Hostinger control panel or account settings:

  - `DB_HOST` (default: `localhost`)
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASS`
  - `API_ALLOW_ORIGIN` (set to your Vercel URL, e.g. `https://your-site.vercel.app`)

  You can copy `backend/.env.example` as a template for local development — do NOT upload that file with real secrets.

3. If environment variables are not available on your Hostinger plan, place the credentials in `config.php` temporarily, then rotate and replace them with environment variables as soon as possible.
4. Ensure `.htaccess` is active (Apache with `mod_rewrite`). If your Hostinger plan does not allow `.htaccess` rewrites, you can call `api.php` directly (example: `https://example.com/backend/api.php/products`).

Usage from frontend
Use the full public URL for your backend. Example:

```
GET https://yourdomain.com/backend/api.php/products
POST https://yourdomain.com/backend/api.php/login
```

Or with pretty routes (if rewrite works):

```
GET https://yourdomain.com/backend/api/products
POST https://yourdomain.com/backend/api/login
```

Security notes
- Use HTTPS on Hostinger (enable SSL/TLS) so credentials and tokens are protected.
- Use `password_hash()` / `password_verify()` for storing passwords (the API supports bcrypt hashes automatically). If your `users.password` column currently stores plain-text passwords, migrate them to bcrypt.
- Consider adding token-based authentication (JWT or server-side sessions) for protected endpoints.

If you want, I can:
- Add more endpoints (inventory logs, receipts, audit logs).
- Implement JWT authentication.
- Update your frontend to use an environment variable pointing to this backend URL.
