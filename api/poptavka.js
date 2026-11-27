// Vercel Serverless Function: příjem poptávky z formuláře a odeslání e-mailem přes Resend.
// Proměnné prostředí: RESEND_API_KEY, INQUIRY_TO (příjemce), INQUIRY_FROM (ověřený odesílatel v Resend).
export const config = { api: { bodyParser: false } };

const MAX_FILES = 3, MAX_TOTAL = 8 * 1024 * 1024;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    if (body.length > MAX_TOTAL + 512 * 1024) return res.status(413).json({ ok: false, error: 'Přílohy jsou příliš velké (max. 8 MB).' });
    const fd = await new Request('http://x', { method: 'POST', headers: { 'content-type': req.headers['content-type'] || '' }, body }).formData();

    // Antispam: honeypot + minimální doba vyplnění 3 s
    if (fd.get('web')) return res.status(200).json({ ok: true });
    const ts = Number(fd.get('ts') || 0);
    if (!ts || Date.now() - ts < 3000) return res.status(400).json({ ok: false, error: 'Formulář se odeslal příliš rychle. Zkuste to prosím znovu.' });

    const name = String(fd.get('name') || '').trim(), phone = String(fd.get('phone') || '').trim(), email = String(fd.get('email') || '').trim();
    if (!name || (!phone && !email)) return res.status(400).json({ ok: false, error: 'Vyplňte prosím jméno a telefon nebo e-mail.' });

    const skip = new Set(['web', 'ts', 'files']);
    const fields = {};
    for (const [k, v] of fd.entries()) if (!skip.has(k) && typeof v === 'string' && v.trim()) fields[k] = fields[k] ? `${fields[k]}, ${v}` : v;

    const attachments = [];
    let total = 0;
    for (const f of fd.getAll('files')) {
      if (typeof f === 'string' || !f.size) continue;
      if (attachments.length >= MAX_FILES || (total += f.size) > MAX_TOTAL) break;
      attachments.push({ filename: f.name, content: Buffer.from(await f.arrayBuffer()).toString('base64') });
    }

    const rows = Object.entries(fields).map(([k, v]) => `<tr><th align="left" style="padding:4px 12px 4px 0">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.INQUIRY_FROM || 'Web A.T. Autoservis <web@atautoservis.cz>',
        to: (process.env.INQUIRY_TO || 'info@atautoservis.cz').split(',').map((s) => s.trim()).filter(Boolean),
        reply_to: email || undefined,
        subject: fields.form === 'rezervace' ? `Rezervace: ${fields.services || ''} – ${fields.date || ''} – ${name}` : `Poptávka z webu: ${fields.brand || ''} ${fields.model || ''} – ${name}`.replace(/\s+/g, ' '),
        html: `<h2>${fields.form === 'rezervace' ? 'Nová rezervace termínu' : 'Nová poptávka z webu'}</h2><table>${rows}</table>`,
        attachments,
      }),
    });
    if (!r.ok) { console.error('resend', r.status, await r.text()); return res.status(502).json({ ok: false, error: 'Odeslání se nepovedlo. Zavolejte nám prosím.' }); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e); return res.status(500).json({ ok: false, error: 'Odeslání se nepovedlo. Zavolejte nám prosím.' });
  }
}
