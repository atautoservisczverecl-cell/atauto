// Obsah spravovaný v administraci, načtený při sestavení webu (build).
// Bez databáze (nebo když je tabulka prázdná) se použije výchozí obsah z kódu.
import { DEFAULTS } from '../admin/store';
import { SUPABASE_URL, SUPABASE_KEY, DEMO } from '../lib/supabase-config';
const URL_: string | undefined = DEMO ? undefined : SUPABASE_URL;
const KEY: string | undefined = DEMO ? undefined : SUPABASE_KEY;

async function fetchTable(t: string, order: string): Promise<any[] | null> {
  if (!URL_ || !KEY) return null;
  try {
    const r = await fetch(`${URL_}/rest/v1/${t}?select=*&order=${order}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!r.ok) return null; const d = await r.json(); return d.length ? d : null;
  } catch { return null; }
}
const [menuDb, servicesDb, photosDb, pagesDb] = await Promise.all([
  fetchTable('menu_items', 'position.asc'), fetchTable('services', 'position.asc'),
  fetchTable('gallery_photos', 'position.asc'), fetchTable('pages', 'slug.asc'),
]);

export const cmsMenu: { label: string; href: string; in_header: boolean; in_mobile: boolean }[] = menuDb ?? DEFAULTS.menu_items!;
export const cmsServices: { title: string; summary: string; icon: string; href: string; price_note?: string; visible: boolean }[] = (servicesDb ?? DEFAULTS.services!).filter((s: any) => s.visible !== false);

const storageUrl = (p: string) => (p.startsWith('/') || p.startsWith('http') ? p : `${URL_}/storage/v1/object/public/realizace/${p}`);
const photoRows: any[] = photosDb ?? DEFAULTS.gallery_photos!;
export const cmsPhotos: Record<string, { src: string; w: number; h: number; alt: string }[]> = {};
for (const p of photoRows) (cmsPhotos[p.category] ||= []).push({ src: storageUrl(p.storage_path), w: p.width || 1000, h: p.height || 1333, alt: p.alt });

const pageRows: any[] = pagesDb ?? [];
export const cmsSeo = new Map<string, { seo_title?: string; seo_description?: string; noindex?: boolean }>(pageRows.map((p) => [p.slug, p]));
export const cmsCustomPages: { slug: string; title: string; lead?: string; body_md?: string; seo_title?: string; seo_description?: string; noindex?: boolean }[] = pageRows.filter((p) => p.custom);
