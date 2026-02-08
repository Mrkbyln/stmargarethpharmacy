API call update script

This repo contains a helper `src/lib/api.ts` (`apiFetch`) that centralizes API calls using `VITE_API_BASE`.

The included script `scripts/replace-fetch-with-apifetch.js` can find and replace direct `fetch()` calls that target PHP endpoints or `/api/` paths and replace them with `apiFetch(...)`.

Usage:

1. Dry-run (preview changes):

```bash
node scripts/replace-fetch-with-apifetch.js
```

2. Apply changes:

```bash
node scripts/replace-fetch-with-apifetch.js --apply
```

Notes:
- The script focuses on `fetch(...)` calls that reference `.php` paths or start with `/api/`.
- It preserves any second argument object passed to `fetch` and forwards it to `apiFetch`.
- It now also converts common `axios` usage patterns:
	- `axios.get('/path')`, `axios.delete('/path')` -> `apiFetch('/path', Object.assign(config, { method: 'GET' }))`
	- `axios.post('/path', data, config?)`, `axios.put(...)`, `axios.patch(...)` -> `apiFetch('/path', Object.assign(config, { method: 'POST', body: JSON.stringify(data) }))`
	- `axios('/path', config?)` -> `apiFetch('/path', config)`

	The conversion handles common call forms but may not correctly transform complex object-style `axios({ url: ..., method: ..., data: ... })` calls — please review those manually after running the script.
