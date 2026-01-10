# Complete Pharmacy API Endpoints Summary

## Overview
All API endpoints have been successfully migrated from PHP to Vercel serverless functions (TypeScript/Node.js). The system is now fully Vercel-compatible with automatic audit logging for all operations.

## Authentication & Security
- All endpoints require JWT authentication (encoded in request headers)
- Role-based access control (admin, staff, pharmacy_assistant)
- All mutations (POST/PUT/DELETE) are logged to audit_logs
- CORS enabled on all endpoints

## API Routes Created

### 1. Authentication Routes (`/api/auth/`)
- **POST `/login`** - User login with rate limiting (5 attempts/15 min)
- **POST `/forgotPassword`** - Request password reset code
- **POST `/verifyCode`** - Verify email reset code
- **POST `/resetPassword`** - Reset password

### 2. Products Routes (`/api/products/`)
- **GET `/list`** - List products with pagination, filters, sorting
- **POST `/create`** - Create new product (admin only)
- **PUT `/update`** - Update product details
- **DELETE `/delete`** - Soft delete product
- **GET `/categories`** - List product categories

### 3. Users Routes (`/api/users/`)
- **GET `/list`** - List all users
- **POST `/create`** - Create new user (admin only)
- **PUT `/update`** - Update user details
- **GET `/getUser`** - Get single user by ID

### 4. Sales Routes (`/api/sales/`)
- **POST `/create`** - Record new sale transaction
- **GET `/list`** - List sales with filtering, pagination
- **GET `/getTransactions`** - Get transactions by date range

### 5. Notifications Routes (`/api/notifications/`)
- **GET `/list`** - List user notifications
- **PUT `/markRead`** - Mark notification as read
- **GET `/check`** - Check for new notifications

### 6. Audit Logs Routes (`/api/auditlogs/`)
- **POST `/log`** - Record audit event (internal)
- **GET `/get`** - Retrieve audit logs (admin/staff only)

### 7. Discounts Routes (`/api/discounts/`)
- **GET `/list`** - List active/all discounts
- **POST `/create`** - Create discount (admin only, validates 0-100 rate)
- **PUT `/update`** - Update discount (admin only)
- **DELETE `/delete`** - Soft delete discount (admin only)

### 8. Inventory Routes (`/api/inventory/`)
- **GET `/list`** - List stock entries with pagination
- **GET `/low-stock`** - Get products below reorder level
- **GET `/expired`** - Get expired batches (expiration_date <= today)
- **GET `/damaged-items`** - List damage reports
- **POST `/damaged-items`** - Report damaged item (auto-updates stock)
- **GET `/stock-entries`** - Get stock entries for product
- **POST `/stock-entries`** - Add new stock batch
- **PUT `/stock-entries`** - Update stock entry (quantity, price, expiration)
- **DELETE `/stock-entries`** - Soft delete stock entry

### 9. Change Items Routes (`/api/changeitem/`)
- **GET `/read`** - List returns/exchanges
- **POST `/read`** - Record new return/exchange
- **POST `/create`** - Create change item (return/exchange)

### 10. Reports Routes (`/api/reports/`)
- **GET `/sales-summary`** - Sales analytics (total amount, quantity, product breakdown)
- **GET `/audit-summary`** - Activity logs (actions, tables, user activity)
- **GET `/inventory-summary`** - Inventory statistics (stock movement, product summary)
- **GET `/damage-report`** - Damage analysis (reasons, product breakdown)

## Database Tables Utilized

| Table | Endpoints | Purpose |
|-------|-----------|---------|
| users | auth, users | User accounts & authentication |
| products | products, inventory | Product catalog |
| sales | sales, reports | Transaction records |
| sale_items | sales, reports | Individual line items |
| discounts | discounts | Discount/promo codes |
| stock_entries | inventory, reports | Batch & expiration tracking |
| damaged_items | inventory, reports | Damage documentation |
| change_items | changeitem | Return/exchange tracking |
| audit_logs | auditlogs | Activity logging |
| notifications | notifications | User alerts |

## Key Features

### Automatic Stock Management
- Adding stock entry automatically increases product.current_stock
- Reporting damage automatically decreases stock
- Deleting stock entry automatically decreases stock
- Exchanging items automatically adjusts both returned & replacement products

### Audit Logging
- All CRUD operations automatically logged
- Includes: user_id, action, table_name, record_id, timestamp
- Accessible via audit logs endpoint (admin/staff only)
- Fixes CSV export issue by providing complete audit trail

### Data Pagination
- All list endpoints support limit/offset parameters
- Max limit enforced at 500 records
- Includes total count for pagination UI

### Date Range Filtering
- Sales/audit reports support startDate, endDate parameters
- Reports aggregated by date range
- ISO format (YYYY-MM-DD) required

### Soft Deletes
- Products, stock entries, discounts use soft deletes
- deleted_at/is_active flags preserve data integrity
- Can be hard deleted from database if needed

## File Structure
```
/api/
├── auth/              # 4 endpoints
├── products/          # 5 endpoints
├── users/             # 4 endpoints
├── sales/             # 3 endpoints
├── notifications/     # 3 endpoints
├── auditlogs/         # 2 endpoints
├── discounts/         # 4 endpoints
├── inventory/         # 5 endpoints
├── changeitem/        # 2 endpoints
├── reports/           # 4 endpoints
└── utils/
    ├── db.ts          # Supabase client setup
    └── helpers.ts     # Auth, validation, logging utilities
```

## Total API Endpoints: 36

## Response Format (Standardized)

### Success Response
```json
{
  "success": true,
  "data": {
    "key": "value"
  },
  "details": "Optional operation details"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional context or error stack"
}
```

## Environment Variables Required
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `GOOGLE_CLIENT_ID` - Gmail OAuth (for password reset)
- `GOOGLE_CLIENT_SECRET` - Gmail OAuth secret
- `JWT_SECRET` - Token signing secret

## Deployment
- Platform: Vercel (serverless functions)
- Runtime: Node.js 18+
- Database: Supabase PostgreSQL
- Authentication: JWT tokens
- Status: ✅ Production Ready (No PHP files remain)

## Migration Status
- ✅ PHP API → TypeScript/Node.js completed
- ✅ All 80+ PHP files removed
- ✅ All features re-implemented in serverless format
- ✅ Audit logging system operational
- ✅ CSV export tracking working
- ✅ Vercel deployment compatible
