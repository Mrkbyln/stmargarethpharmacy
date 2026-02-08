# Quick Start - Supabase Integration

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Check .env
```env
VITE_SUPABASE_URL=https://zrtzwjxhajshymvsbwaq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
✅ Already configured!

### 3. Start Development
```bash
npm run dev
```

### 4. Test It
- Look for green/red indicator in bottom-left corner
- Click it to see status
- Go offline (F12 → Network → Offline) to test

Done! ✨

---

## Next: Create Supabase Tables

### Login to Supabase
1. Visit: https://supabase.com
2. Project: `zrtzwjxhajshymvsbwaq`
3. Go to "SQL Editor"

### Create Tables

#### Medicines
```sql
CREATE TABLE medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manufacturer TEXT,
  quantity INTEGER DEFAULT 0,
  unit_price DECIMAL(10, 2),
  selling_price DECIMAL(10, 2),
  expiry_date DATE,
  batch_number TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Sales
```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total DECIMAL(10, 2) NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Basic Usage in Components

### Add Medicine with Sync
```tsx
import { syncQueue } from '../lib/syncQueue';
import { useConnectivity } from '../lib/useConnectivity';

function AddMedicine() {
  const { isOnline } = useConnectivity();

  const handleAdd = async (medicineData) => {
    // Save to local DB
    const response = await fetch('/api/products/create.php', {
      method: 'POST',
      body: JSON.stringify(medicineData),
    });
    const result = await response.json();

    if (result.success) {
      // Queue for Supabase sync if online
      syncQueue.addToQueue('medicines', {
        id: result.data.id,
        ...medicineData,
      });
    }
  };

  return <button onClick={() => handleAdd({...})}>
    {isOnline ? 'Add & Sync' : 'Add (Will sync later)'}
  </button>;
}
```

### Fetch with Fallback
```tsx
import { useConnectivity } from '../lib/useConnectivity';
import { fetchFromSupabase } from '../lib/supabaseClient';

function MedicineList() {
  const { isOnline } = useConnectivity();
  const [medicines, setMedicines] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (isOnline) {
        const data = await fetchFromSupabase('medicines');
        if (data.length > 0) {
          setMedicines(data);
          return;
        }
      }

      const res = await fetch('/api/inventory/products.php');
      const result = await res.json();
      setMedicines(result.data || []);
    };

    load();
  }, [isOnline]);

  return <div>{medicines.map(m => <div key={m.id}>{m.name}</div>)}</div>;
}
```

---

## Monitor Sync Queue

```tsx
import { syncQueue } from '../lib/syncQueue';
import { useEffect, useState } from 'react';

function SyncStatus() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPending(syncQueue.getQueueSize());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (pending === 0) return null;

  return <div className="bg-yellow-100 p-2">
    ⏳ {pending} items pending sync...
    <button onClick={() => syncQueue.retryAll()}>Retry</button>
  </div>;
}
```

---

## Debug in Console

```javascript
// Check if online
import { connectivityService } from './lib/connectivityService';
connectivityService.getStatus();

// See pending syncs
import { syncQueue } from './lib/syncQueue';
console.log('Pending:', syncQueue.getQueueSize());
console.log('Queue:', syncQueue.getQueue());

// Retry all
syncQueue.retryAll();

// Clear queue (be careful!)
syncQueue.clearQueue();
```

---

## Status Indicator

The app automatically shows:
- 🟢 **Green** = Online (using Supabase sync)
- 🔴 **Red** = Offline (using local DB only)

Click for details showing:
- Connection status
- Data source (Cloud vs Local)
- Last check time

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/connectivityService.ts` | Monitors internet connection |
| `lib/supabaseClient.ts` | Supabase integration |
| `lib/syncQueue.ts` | Offline data sync queue |
| `lib/useConnectivity.ts` | React hook for status |
| `components/ConnectivityStatus.tsx` | UI indicator |
| `api/health-check.php` | API health check |

---

## Documentation

- **[SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md)** - Complete setup
- **[SUPABASE_IMPLEMENTATION_EXAMPLES.md](./SUPABASE_IMPLEMENTATION_EXAMPLES.md)** - Code examples
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Full API docs

---

## Troubleshooting

### Indicator not showing?
- Verify `npm install` ran successfully
- Check browser console for errors

### Sync not working?
- Verify tables exist in Supabase
- Check `.env` credentials
- Test API: `http://localhost/stmargareth/api/health-check.php`

### Still stuck?
- See [SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md) troubleshooting section
- Check browser console for status messages

---

## What's Happening Behind the Scenes

```
Application Starts
    ↓
Check Internet Connection
    ↓
Initialize Supabase Client
    ↓
Show Status Indicator (🟢 or 🔴)
    ↓
User performs action
    ↓
Save to Local DB (always works)
    ↓
If Online:
    Queue for Supabase Sync
    Auto-sync in background
Else:
    Save for later sync
    ↓
When Back Online:
    Auto-sync queued data
```

---

## That's It!

You now have:
- ✅ Real-time connectivity detection
- ✅ Automatic online/offline switching
- ✅ Cloud backup with Supabase
- ✅ Offline-first architecture
- ✅ Visual status indicator

Start integrating sync calls into your components and you're done! 🚀

---

## Examples by Feature

### Add Sale
```tsx
const success = await syncQueue.addToQueue('sales', saleData);
```

### Fetch Medicine
```tsx
const medicines = await fetchFromSupabase('medicines');
```

### Check Status
```tsx
const { isOnline, useSupabase } = useConnectivity();
```

### Retry Failed
```tsx
await syncQueue.retryAll();
```

### Monitor Queue
```tsx
console.log(syncQueue.getQueueSize()); // Count pending
```

---

## Next Steps

1. ✅ Run `npm install`
2. ✅ Start `npm run dev`
3. ✅ Create Supabase tables (SQL from above)
4. ✅ Add sync calls to your components
5. ✅ Test offline mode
6. ✅ Monitor sync in console

Happy coding! 🎉
