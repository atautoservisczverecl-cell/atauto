// Datová vrstva administrace.
// Ostrý režim: Supabase (PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY).
// Ukázkový režim (náhled bez databáze): data se drží v prohlížeči (localStorage), nic se neodesílá.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mainNav } from '../data/nav';
import { photos as sitePhotos, photoLabels } from '../data/photos';
import seoPages from '../data/seo-pages.json';

export type Table = 'menu_items' | 'pages' | 'services' | 'gallery_photos' | 'bookings' | 'blocked_days';
export type Row = Record<string, any>;
export interface Stats { daily: { day: string; views: number; visitors: number; calls: number; leads: number }[]; pages: [string, number][]; sources: [string, number][]; devices: [string, number][] }

const URL_ = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
export const live = !!(URL_ && KEY);
export const sb: SupabaseClient | null = live ? createClient(URL_!, KEY!) : null;

export const keyOf = (t: Table) => (t === 'pages' ? 'slug' : t === 'blocked_days' ? 'day' : 'id');
const orderOf: Partial<Record<Table, [string, boolean]>> = {
  menu_items: ['position', true], services: ['position', true], gallery_photos: ['position', true],
  pages: ['slug', true], bookings: ['date', false], blocked_days: ['day', true],
};

// ---------- výchozí obsah (stejný jako na webu) ----------
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
export const DEFAULTS: Partial<Record<Table, Row[]>> = {
  menu_items: mainNav.map((n, i) => ({ id: `m${i}`, label: n.label, href: n.href, position: i, in_header: !['/realizace/', '/chybove-kody-prevodovek/', '/blog/', '/rezervace/'].includes(n.href), in_mobile: true })),
  services: [
    { id: 's1', title: 'Diagnostika převodovky', summary: 'Chybové kódy, živá data, tlaky oleje, stav adaptací a zkušební jízda.', icon: 'scan', href: '/diagnostika-automaticke-prevodovky/', price_note: 'od 2 500 Kč bez DPH', bookable: true, position: 0, visible: true },
    { id: 's2', title: 'Oprava převodovky', summary: 'Mechatronika, solenoidy, hydraulika, měnič, těsnění nebo spojky.', icon: 'wrench', href: '/oprava-automaticke-prevodovky/', price_note: '', bookable: false, position: 1, visible: true },
    { id: 's3', title: 'Kompletní repase', summary: 'Rozebrání, změření a výměna opotřebených dílů, adaptace a zkušební jízda.', icon: 'gear', href: '/repase-automaticke-prevodovky/', price_note: '', bookable: false, position: 2, visible: true },
    { id: 's4', title: 'Dynamická výměna oleje', summary: 'Výměna až 95–100 % oleje včetně proplachu měniče a chladiče.', icon: 'oil', href: '/vymena-oleje-automaticka-prevodovka/', price_note: 'podle ceníku', bookable: true, position: 3, visible: true },
    { id: 's5', title: 'Výměna oleje v motoru', summary: 'Motorový olej a filtr podle předpisu výrobce.', icon: 'drop', href: '/rezervace/#olej-motor', price_note: '', bookable: true, position: 4, visible: false },
  ],
  gallery_photos: Object.entries(sitePhotos).flatMap(([cat, list]) => list.map((p, i) => ({ id: `${cat}-${i}`, storage_path: p.src, alt: p.alt, category: cat, width: p.w, height: p.h }))).map((p, i) => ({ ...p, position: i })),
  pages: (seoPages as Row[]).map((p) => ({ ...p })),
  bookings: [], blocked_days: [],
};
export const categories = photoLabels;

// ---------- ukázkový režim ----------
const LS = 'at-admin-demo-v1';
const ls = { get(k: string) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
let demo: Record<string, Row[]> = ls.get(LS) || {};
const demoTable = (t: Table): Row[] => {
  if (t === 'bookings') return ls.get('at-demo-bookings') || [];
  if (!demo[t]) demo[t] = structuredClone(DEFAULTS[t] || []);
  return demo[t];
};
const demoSave = (t: Table, rows: Row[]) => { if (t === 'bookings') ls.set('at-demo-bookings', rows); else { demo[t] = rows; ls.set(LS, demo); } };
export const demoReset = () => { demo = {}; ls.set(LS, {}); };

const sortRows = (t: Table, rows: Row[]) => {
  const o = orderOf[t]; if (!o) return rows;
  const [f, asc] = o; return [...rows].sort((a, b) => (a[f] > b[f] ? 1 : a[f] < b[f] ? -1 : 0) * (asc ? 1 : -1));
};

// ---------- veřejné API ----------
export const photoUrl = (path: string) => {
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  if (path.startsWith('/')) return new URL(path.slice(1), new URL('../', location.href)).href; // funguje i v náhledu bez kořene domény
  return sb!.storage.from('realizace').getPublicUrl(path).data.publicUrl;
};

export async function list(t: Table): Promise<Row[]> {
  if (!live) return sortRows(t, demoTable(t));
  const [f, asc] = orderOf[t] || [keyOf(t), true];
  const { data, error } = await sb!.from(t).select('*').order(f, { ascending: asc });
  if (error) throw error;
  if (!data.length && DEFAULTS[t]?.length && t !== 'gallery_photos') return sortRows(t, DEFAULTS[t]!.map((r) => ({ ...r, _unsaved: true })));
  return data;
}

export async function save(t: Table, row: Row): Promise<Row> {
  const clean = Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_') && k !== 'url'));
  const k = keyOf(t);
  if (!live) {
    const rows = demoTable(t); if (!clean[k]) clean[k] = uid();
    const i = rows.findIndex((r) => r[k] === clean[k]);
    if (i >= 0) rows[i] = { ...rows[i], ...clean }; else rows.push(clean);
    demoSave(t, rows); return clean;
  }
  if (k === 'id' && (!clean.id || /^[a-z]+\d+$|^[a-z-]+-\d+$/.test(clean.id))) delete clean.id; // výchozí řádky dostanou skutečné UUID
  const { data, error } = await sb!.from(t).upsert(clean).select().single();
  if (error) throw error; return data;
}

export async function remove(t: Table, key: string) {
  const k = keyOf(t);
  if (!live) { demoSave(t, demoTable(t).filter((r) => r[k] !== key)); return; }
  const { error } = await sb!.from(t).delete().eq(k, key); if (error) throw error;
}

export async function uploadPhoto(file: File): Promise<{ path: string; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  if (!live) return { path: c.toDataURL('image/webp', 0.6), width: c.width, height: c.height }; // ukázka: jen v prohlížeči
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/webp', 0.82));
  const path = `${new Date().toISOString().slice(0, 10)}/${uid()}.webp`;
  const { error } = await sb!.storage.from('realizace').upload(path, blob, { contentType: 'image/webp' });
  if (error) throw error; return { path, width: c.width, height: c.height };
}

export async function deletePhotoFile(path: string) { if (live && !path.startsWith('/')) await sb!.storage.from('realizace').remove([path]); }

export async function stats(days: number): Promise<Stats> {
  let ev: Row[] = [];
  if (!live) ev = ls.get('at-demo-events') || [];
  else {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const { data, error } = await sb!.from('page_events').select('ts,path,referrer,event,device,visitor').gte('ts', since).limit(50000);
    if (error) throw error; ev = data;
  }
  const byDay = new Map<string, any>();
  for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); byDay.set(d, { day: d, views: 0, visitors: new Set(), calls: 0, leads: 0 }); }
  const pages = new Map<string, number>(), sources = new Map<string, number>(), devices = new Map<string, number>();
  const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
  for (const e of ev) {
    const d = byDay.get(String(e.ts).slice(0, 10)); if (!d) continue;
    if (e.event === 'pageview') {
      d.views++; d.visitors.add(e.visitor || e.ts); inc(pages, e.path);
      let src = 'Přímo / neznámý'; try { if (e.referrer) src = new URL(e.referrer).hostname.replace(/^www\./, ''); } catch {}
      inc(sources, src); inc(devices, e.device || '?');
    } else if (e.event === 'click_phone') d.calls++;
    else if (e.event === 'generate_lead') d.leads++;
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return { daily: [...byDay.values()].map((d) => ({ ...d, visitors: d.visitors.size })), pages: top(pages), sources: top(sources), devices: top(devices) };
}

export async function publish(): Promise<string> {
  if (!live) return 'demo';
  const { data } = await sb!.auth.getSession();
  const r = await fetch('/api/publikovat', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token}` } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Publikování se nepovedlo.');
  return 'ok';
}
