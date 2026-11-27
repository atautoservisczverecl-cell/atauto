// Napojení veřejného webu na databázi administrace (bez knihovny, přes REST Supabase).
// Bez nastavené databáze (náhled) se vše ukládá jen v prohlížeči, aby šlo administraci vyzkoušet.
import { SUPABASE_URL, SUPABASE_KEY, DEMO } from './supabase-config';
const URL_: string | undefined = DEMO ? undefined : SUPABASE_URL;
const KEY: string | undefined = DEMO ? undefined : SUPABASE_KEY;
export const live = !!(URL_ && KEY);
const headers = () => ({ apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' });
const ls = {
  get<T>(k: string, d: T): T { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } },
  push(k: string, v: unknown, max = 3000) { try { const a = ls.get<unknown[]>(k, []); a.push(v); localStorage.setItem(k, JSON.stringify(a.slice(-max))); } catch {} },
};

export async function insert(table: 'bookings' | 'page_events', row: Record<string, unknown>) {
  if (!live) {
    const key = table === 'bookings' ? 'at-demo-bookings' : 'at-demo-events';
    ls.push(key, { id: crypto.randomUUID?.() ?? String(Date.now()), created_at: new Date().toISOString(), ts: new Date().toISOString(), status: 'nova', ...row });
    return;
  }
  const r = await fetch(`${URL_}/rest/v1/${table}`, { method: 'POST', headers: headers(), body: JSON.stringify(row), keepalive: table === 'page_events' });
  if (!r.ok && table === 'bookings') throw new Error('Rezervaci se nepodařilo uložit.');
}

export async function blockedDays(): Promise<string[]> {
  if (!live) return ls.get<Record<string, any>>('at-admin-demo-v1', {}).blocked_days?.map((d: any) => d.day) ?? [];
  try { const r = await fetch(`${URL_}/rest/v1/blocked_days?select=day`, { headers: headers() }); return r.ok ? (await r.json()).map((d: any) => d.day) : []; } catch { return []; }
}

// Anonymní měření návštěv bez cookies: denní otisk (datum + prohlížeč), nic se neukládá do zařízení.
async function visitorId() {
  const raw = [new Date().toISOString().slice(0, 10), navigator.userAgent, navigator.language, screen.width, screen.height].join('|');
  try { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)); return Array.from(new Uint8Array(h).slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join(''); } catch { return ''; }
}
const device = () => (matchMedia('(max-width: 767px)').matches ? 'm' : matchMedia('(max-width: 1100px)').matches ? 't' : 'd');
const TRACKED = new Set(['click_phone', 'click_email', 'cta_inquiry', 'cta_booking', 'generate_lead']);

export function startTracking() {
  if (/^\/administrace/.test(location.pathname) || navigator.webdriver) return;
  const send = async (event: string) => {
    let ref = document.referrer; try { if (ref && new URL(ref).host === location.host) ref = ''; } catch {}
    insert('page_events', { path: location.pathname, referrer: ref || null, event, device: device(), visitor: await visitorId() }).catch(() => {});
  };
  send('pageview');
  const w = window as any; const dl = (w.dataLayer = w.dataLayer || []);
  const orig = dl.push.bind(dl);
  dl.push = (...items: any[]) => { for (const it of items) if (it && TRACKED.has(it.event)) send(it.event); return orig(...items); };
}
