// Vercel funkce: tlačítko „Publikovat změny na web“ v administraci.
// Ověří přihlášeného správce v Supabase (jeho vlastním přihlášením) a spustí nové sestavení webu (Deploy Hook).
// Proměnné: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, DEPLOY_HOOK_URL
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const url = process.env.PUBLIC_SUPABASE_URL, key = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Databáze není nastavená.' });
  if (!process.env.DEPLOY_HOOK_URL) return res.status(500).json({ error: 'Chybí Deploy Hook ve Vercelu (DEPLOY_HOOK_URL).' });
  if (!token) return res.status(401).json({ error: 'Přihlaste se prosím znovu.' });
  const h0 = { apikey: key, Authorization: `Bearer ${token}` };
  const u = await fetch(`${url}/auth/v1/user`, { headers: h0 });
  if (!u.ok) return res.status(401).json({ error: 'Přihlaste se prosím znovu.' });
  const user = await u.json();
  // tabulku admins smí číst jen správce (RLS), takže prázdný výsledek = bez oprávnění
  const a = await fetch(`${url}/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`, { headers: h0 });
  if (!a.ok || !(await a.json()).length) return res.status(403).json({ error: 'Nemáte oprávnění.' });
  const h = await fetch(process.env.DEPLOY_HOOK_URL, { method: 'POST' });
  if (!h.ok) return res.status(502).json({ error: 'Spuštění publikování se nepovedlo.' });
  return res.status(200).json({ ok: true });
}
