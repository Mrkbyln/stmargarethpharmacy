// Central API helper: use `import { apiFetch } from '../lib/api'`
// Configure base with Vercel env var VITE_API_BASE (e.g. https://monitoring.mcars.ph)

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) } as Record<string, string>;
  const opts: RequestInit = { ...options, headers };

  const res = await fetch(url, opts);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

export function buildPath(p: string) {
  return p.startsWith('http') ? p : `${API_BASE.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
}
