// Vercel funkce: tlačítko „Publikovat změny na web“ v administraci.
// Ověří přihlášeného správce v Supabase a spustí nové sestavení webu (Deploy Hook).
// Proměnné: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEPLOY_HOOK_URL
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const url = process.env.PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !key || !process.env.DEPLOY_HOOK_URL) return res.status(500).json({ error: 'Publikování není nastavené.' });
  const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!u.ok) return res.status(401).json({ error: 'Přihlaste se prosím znovu.' });
  const user = await u.json();
  const a = await fetch(`${url}/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!a.ok || !(await a.json()).length) return res.status(403).json({ error: 'Nemáte oprávnění.' });
  const h = await fetch(process.env.DEPLOY_HOOK_URL, { method: 'POST' });
  if (!h.ok) return res.status(502).json({ error: 'Spuštění publikování se nepovedlo.' });
  return res.status(200).json({ ok: true });
}
