// Administrace A.T. Autoservis – logika obrazovek (bez frameworku).
import { live, sb, list, save, remove, uploadPhoto, deletePhotoFile, photoUrl, stats, publish, demoReset, categories, keyOf, type Row, type Table } from './store';

const $ = <T extends HTMLElement = HTMLElement>(s: string, el: ParentNode = document) => el.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, el: ParentNode = document) => Array.from(el.querySelectorAll(s)) as T[];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fmtDate = (d?: string) => (d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }) : '');
const fmtTs = (d?: string) => (d ? new Date(d).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const view = () => $('#view');

let toastT: number | undefined;
function toast(msg: string, bad = false) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', bad); t.hidden = false;
  clearTimeout(toastT); toastT = window.setTimeout(() => (t.hidden = true), 3200);
}
const fail = (e: any) => { console.error(e); toast(e?.message || 'Něco se nepovedlo.', true); };

// ---------- dialog ----------
function dialog(html: string, onSubmit?: (fd: FormData, form: HTMLFormElement, action: string) => Promise<void> | void, wide = false) {
  const dlg = $<HTMLDialogElement>('#dlg'); const form = $<HTMLFormElement>('#dlg-form');
  dlg.style.width = wide ? 'min(860px, calc(100vw - 32px))' : '';
  form.innerHTML = html;
  form.onsubmit = async (e) => {
    const sub = (e as SubmitEvent).submitter as HTMLButtonElement | null;
    if (sub?.value === 'cancel' || !onSubmit) return;
    e.preventDefault();
    try { await onSubmit(new FormData(form), form, sub?.value || 'ok'); dlg.close(); } catch (err) { fail(err); }
  };
  dlg.showModal();
  return form;
}
const acts = (saveLabel = 'Uložit') => `<div class="dlg-acts"><button class="b" value="cancel" formnovalidate>Zrušit</button><button class="b b-red" value="ok">${saveLabel}</button></div>`;

// ---------- přihlášení ----------
export async function boot() {
  $('#demo-bar').hidden = live;
  $('#demo-reset')?.addEventListener('click', () => { demoReset(); toast('Výchozí obsah obnoven'); go(current); });
  if (!live) return start('ukázka');
  const { data } = await sb!.auth.getSession();
  if (data.session) return start(data.session.user.email || '');
  showLogin();
}

function showLogin() {
  $('#login').hidden = false; $('#app').hidden = true;
  const form = $<HTMLFormElement>('#login-form'); const err = $('.err', form);
  form.onsubmit = async (e) => {
    e.preventDefault(); err.hidden = true;
    const fd = new FormData(form);
    const { data, error } = await sb!.auth.signInWithPassword({ email: String(fd.get('email')), password: String(fd.get('password')) });
    if (error) { err.textContent = 'Nesprávný e-mail nebo heslo.'; err.hidden = false; return; }
    $('#login').hidden = true; start(data.user?.email || '');
  };
  $('#forgot').onclick = async () => {
    const email = String(new FormData(form).get('email') || '');
    if (!email) { err.textContent = 'Nejdřív vyplňte e-mail.'; err.hidden = false; return; }
    await sb!.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/administrace/' });
    err.textContent = 'Poslali jsme vám e-mail s odkazem na nové heslo.'; err.hidden = false;
  };
}

let current = 'prehled';
function start(who: string) {
  $('#app').hidden = false; $('#who').textContent = live ? `(${who})` : '';
  $('#logout').hidden = !live;
  $('#logout').onclick = async () => { await sb!.auth.signOut(); location.reload(); };
  $('#passwd').hidden = !live;
  $('#passwd').onclick = () => dialog(`<h3>Změnit heslo</h3><label>Nové heslo (aspoň 8 znaků)<input name="p1" type="password" minlength="8" required autocomplete="new-password"></label><label>Nové heslo znovu<input name="p2" type="password" minlength="8" required autocomplete="new-password"></label>${acts('Změnit heslo')}`, async (fd) => {
    if (fd.get('p1') !== fd.get('p2')) throw new Error('Hesla se neshodují.');
    const { error } = await sb!.auth.updateUser({ password: String(fd.get('p1')) }); if (error) throw error;
    toast('Heslo změněno.');
  });
  $('#publish').onclick = async (e) => {
    const b = e.currentTarget as HTMLButtonElement; b.disabled = true; const t = b.textContent; b.textContent = 'Publikuji…';
    try { const r = await publish(); toast(r === 'demo' ? 'Ukázka: na ostrém webu by se teď spustilo publikování (1–2 minuty).' : 'Publikování spuštěno. Web bude aktuální za 1–2 minuty.'); }
    catch (err) { fail(err); } finally { b.disabled = false; b.textContent = t; }
  };
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab!)));
  const h = location.hash.slice(1); go(screens[h] ? h : 'prehled');
  refreshBadge();
}

const screens: Record<string, () => Promise<void>> = { prehled: overview, rezervace: bookings, realizace: gallery, sluzby: services, menu: menu, stranky: pages };
async function go(tab: string) {
  current = tab;
  $$('.tabs button').forEach((b) => (b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  try { history.replaceState(null, '', '#' + tab); } catch {}
  view().innerHTML = '<p class="empty">Načítám…</p>';
  try { await screens[tab](); } catch (e) { view().innerHTML = `<p class="err">Data se nepodařilo načíst. ${esc((e as Error).message)}</p>`; }
}

async function refreshBadge() {
  try { const n = (await list('bookings')).filter((b) => b.status === 'nova').length; const el = $('#badge-new'); el.textContent = String(n); el.hidden = !n; } catch {}
}

// ---------- PŘEHLED ----------
async function overview() {
  const [s, bk] = await Promise.all([stats(30), list('bookings')]);
  const sum = (k: 'views' | 'visitors' | 'calls' | 'leads') => s.daily.reduce((a, d) => a + d[k], 0);
  const max = Math.max(1, ...s.daily.map((d) => d.views));
  const upcoming = bk.filter((b) => b.status !== 'zamitnuta' && (b.confirmed_date || b.date) >= new Date().toISOString().slice(0, 10)).sort((a, b) => (a.confirmed_date || a.date).localeCompare(b.confirmed_date || b.date)).slice(0, 6);
  const noData = !sum('views');
  const tl = (rows: [string, number][]) => rows.length ? `<ul class="toplist">${rows.map(([k, v]) => `<li><span>${esc(k)}</span><span>${v}</span></li>`).join('')}</ul>` : '<p class="empty">Zatím žádná data.</p>';
  view().innerHTML = `
    <div class="vh"><div><h1>Přehled</h1><p>Posledních 30 dní.</p></div></div>
    <div class="grid g4">
      <div class="card kpi"><span>Zobrazení stránek</span><b>${sum('views')}</b></div>
      <div class="card kpi"><span>Návštěvníci</span><b>${sum('visitors')}</b><small>počítáno po dnech, bez cookies</small></div>
      <div class="card kpi"><span>Kliknutí na telefon</span><b>${sum('calls')}</b></div>
      <div class="card kpi"><span>Odeslané poptávky a rezervace</span><b>${sum('leads')}</b></div>
    </div>
    <div class="grid g2" style="margin-top:1rem">
      <div class="card"><h2>Návštěvnost po dnech</h2>
        ${noData ? `<p class="empty">${live ? 'Zatím žádné návštěvy. Měření běží od spuštění webu.' : 'V ukázce se počítají jen vaše vlastní návštěvy náhledu v tomto prohlížeči.'}</p>` : ''}
        <div class="bars" aria-hidden="true">${s.daily.map((d) => `<div style="height:${(d.views / max) * 100}%" title="${fmtDate(d.day)}: ${d.views} zobrazení, ${d.visitors} návštěvníků"></div>`).join('')}</div>
        <div class="bars-x"><span>${fmtDate(s.daily[0].day)}</span><span>dnes</span></div>
      </div>
      <div class="card"><h2>Nejbližší rezervace</h2>
        ${upcoming.length ? `<ul class="toplist">${upcoming.map((b) => `<li><span>${fmtDate(b.confirmed_date || b.date)} · ${esc(b.name)} · ${esc((b.services || []).join(', '))}</span><span class="st st-${b.status}">${statusLabel[b.status]}</span></li>`).join('')}</ul>` : '<p class="empty">Žádné nadcházející rezervace.</p>'}
        <p style="margin-top:.75rem"><button class="b b-sm" data-go="rezervace">Všechny rezervace</button></p>
      </div>
      <div class="card"><h2>Nejnavštěvovanější stránky</h2>${tl(s.pages)}</div>
      <div class="card"><h2>Odkud lidé přicházejí</h2>${tl(s.sources)}</div>
      <div class="card"><h2>Zařízení</h2>${tl(s.devices.map(([k, v]) => [({ m: 'Mobil', d: 'Počítač', t: 'Tablet' } as any)[k] || k, v]))}</div>
    </div>`;
  $$('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go!)));
}

// ---------- REZERVACE ----------
const statusLabel: Record<string, string> = { nova: 'Nová', potvrzena: 'Potvrzená', zamitnuta: 'Zamítnutá', hotovo: 'Hotovo' };
let bkFilter = 'aktivni';
async function bookings() {
  const all = await list('bookings');
  const today = new Date().toISOString().slice(0, 10);
  const f: Record<string, (b: Row) => boolean> = {
    aktivni: (b) => b.status === 'nova' || (b.status === 'potvrzena' && (b.confirmed_date || b.date) >= today),
    nova: (b) => b.status === 'nova', potvrzena: (b) => b.status === 'potvrzena', vse: () => true,
  };
  const rows = all.filter(f[bkFilter]).sort((a, b) => (a.confirmed_date || a.date).localeCompare(b.confirmed_date || b.date));
  const blocked = await list('blocked_days');
  view().innerHTML = `
    <div class="vh"><div><h1>Rezervace</h1><p>Termíny z formuláře na webu. Potvrďte je telefonicky nebo e-mailem a změňte stav.</p></div>
      <div class="filters">${[['aktivni', 'Aktuální'], ['nova', 'Nové'], ['potvrzena', 'Potvrzené'], ['vse', 'Všechny']].map(([k, l]) => `<button class="chipb" data-f="${k}" aria-pressed="${bkFilter === k}">${l}</button>`).join('')}</div></div>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Termín</th><th>Služba</th><th>Zákazník</th><th>Vůz</th><th>Stav</th><th></th></tr></thead><tbody>
      ${rows.map((b) => `<tr class="${b.status === 'nova' ? 'is-new' : ''}">
        <td><strong>${fmtDate(b.confirmed_date || b.date)}</strong><br><small>${esc(b.time_window || '')}${b.date_alt ? `<br>náhradní: ${fmtDate(b.date_alt)}` : ''}</small></td>
        <td>${esc((b.services || []).join(', '))}</td>
        <td>${esc(b.name)}<br><small>${esc(b.phone)}</small></td>
        <td>${esc([b.brand, b.model, b.year].filter(Boolean).join(' '))}</td>
        <td><span class="st st-${b.status}">${statusLabel[b.status]}</span></td>
        <td><button class="b b-sm" data-open="${esc(b.id)}">Detail</button></td></tr>`).join('')}
    </tbody></table></div>` : `<div class="card"><p class="empty">${bkFilter === 'aktivni' ? 'Žádné aktuální rezervace.' : 'Nic tu není.'}${live ? '' : ' V ukázce se tu objeví rezervace, které odešlete z webu v tomto prohlížeči.'}</p></div>`}
    <div class="card" style="margin-top:1.25rem"><div class="vh" style="margin:0 0 .75rem"><div><h2 style="margin:0">Zavřené dny</h2><p>Dovolená nebo plná dílna. Tyto dny nepůjde na webu vybrat.</p></div><button class="b b-sm" id="add-block">Přidat zavřený den</button></div>
      ${blocked.length ? `<ul class="toplist">${blocked.map((d) => `<li><span>${fmtDate(d.day)} ${d.reason ? '· ' + esc(d.reason) : ''}</span><button class="b-link" data-unblock="${d.day}">Odebrat</button></li>`).join('')}</ul>` : '<p class="empty">Žádné zavřené dny.</p>'}
    </div>`;
  $$('[data-f]').forEach((b) => (b.onclick = () => { bkFilter = b.dataset.f!; bookings(); }));
  $$('[data-open]').forEach((b) => (b.onclick = () => bookingDetail(all.find((x) => x.id === b.dataset.open)!)));
  $('#add-block').onclick = () => dialog(`<h2>Zavřený den</h2><div class="f2"><label>Od <input type="date" name="from" required></label><label>Do (včetně) <input type="date" name="to"></label></div><label>Důvod (jen pro vás) <input name="reason" placeholder="např. dovolená"></label>${acts()}`, async (fd) => {
    const from = new Date(String(fd.get('from')) + 'T12:00:00'); const to = fd.get('to') ? new Date(String(fd.get('to')) + 'T12:00:00') : from;
    for (let d = from; d <= to; d = new Date(d.getTime() + 864e5)) await save('blocked_days', { day: d.toISOString().slice(0, 10), reason: fd.get('reason') || null });
    toast('Uloženo'); bookings();
  });
  $$('[data-unblock]').forEach((b) => (b.onclick = async () => { await remove('blocked_days', b.dataset.unblock!).catch(fail); bookings(); }));
}

function bookingDetail(b: Row) {
  const mail = b.email ? `mailto:${encodeURIComponent(b.email)}?subject=${encodeURIComponent('Potvrzení termínu – A.T. Autoservis')}&body=${encodeURIComponent(`Dobrý den,\n\npotvrzujeme termín ${fmtDate(b.confirmed_date || b.date)} (${(b.services || []).join(', ')}).\nAdresa: Nádražní 272, Hostivice.\n\nS pozdravem\nA.T. Autoservis, 721 004 440`)}` : '';
  dialog(`<h2>Rezervace: ${esc(b.name)}</h2>
    <dl class="kv">
      <dt>Služba</dt><dd>${esc((b.services || []).join(', '))}</dd>
      <dt>Požadovaný den</dt><dd>${fmtDate(b.date)} · ${esc(b.time_window || '')}</dd>
      ${b.date_alt ? `<dt>Náhradní den</dt><dd>${fmtDate(b.date_alt)}</dd>` : ''}
      <dt>Během servisu</dt><dd>${esc(b.wait || '')}</dd>
      <dt>Telefon</dt><dd><a href="tel:${esc(String(b.phone).replace(/\s/g, ''))}">${esc(b.phone)}</a></dd>
      ${b.email ? `<dt>E-mail</dt><dd><a href="${mail}">${esc(b.email)}</a></dd>` : ''}
      <dt>Vůz</dt><dd>${esc([b.brand, b.model, b.year, b.engine, b.km && b.km + ' km'].filter(Boolean).join(' · '))}</dd>
      ${b.vin ? `<dt>VIN / převodovka</dt><dd>${esc(b.vin)}</dd>` : ''}
      ${b.message ? `<dt>Poznámka</dt><dd>${esc(b.message)}</dd>` : ''}
      <dt>Odesláno</dt><dd>${fmtTs(b.created_at)}</dd>
    </dl>
    <div class="f2">
      <label>Stav <select name="status">${Object.entries(statusLabel).map(([k, l]) => `<option value="${k}" ${b.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Potvrzený den <input type="date" name="confirmed_date" value="${esc(b.confirmed_date || b.date)}"></label>
    </div>
    <label>Interní poznámka <textarea name="admin_note" rows="2" style="min-height:70px">${esc(b.admin_note || '')}</textarea></label>
    <div class="dlg-acts"><button class="b b-danger" value="delete" formnovalidate>Smazat</button><span style="flex:1"></span>${b.email ? `<a class="b" href="${mail}">Napsat e-mail</a>` : ''}<button class="b" value="cancel" formnovalidate>Zavřít</button><button class="b b-red" value="ok">Uložit</button></div>`,
    async (fd, _form, action) => {
      if (action === 'delete') { if (!(await confirmDlg('Opravdu smazat tuto rezervaci?'))) return; await remove('bookings', b.id); toast('Smazáno'); }
      else { await save('bookings', { ...b, status: fd.get('status'), confirmed_date: fd.get('confirmed_date') || null, admin_note: fd.get('admin_note') || null }); toast('Uloženo'); }
      refreshBadge(); bookings();
    });
}

// potvrzení bez window.confirm (inline)
function confirmDlg(msg: string): Promise<boolean> {
  return new Promise((res) => {
    const d = document.createElement('dialog');
    d.innerHTML = `<form method="dialog" style="padding:1.25rem;display:grid;gap:1rem"><p>${esc(msg)}</p><div class="dlg-acts"><button class="b" value="no">Ne</button><button class="b b-red" value="yes">Ano, smazat</button></div></form>`;
    document.body.append(d); d.showModal(); d.onclose = () => { res(d.returnValue === 'yes'); d.remove(); };
  });
}

// ---------- FOTKY REALIZACÍ ----------
let galCat = 'vse';
async function gallery() {
  const all = await list('gallery_photos');
  const rows = galCat === 'vse' ? all : all.filter((p) => p.category === galCat);
  const cats = { ...categories, ostatni: 'Ostatní' } as Record<string, string>;
  view().innerHTML = `
    <div class="vh"><div><h1>Fotky realizací</h1><p>${all.length} fotek. Nahrávejte klidně přímo z mobilu, fotky se samy zmenší.</p></div>
      <div class="filters"><button class="chipb" data-c="vse" aria-pressed="${galCat === 'vse'}">Vše</button>${Object.entries(cats).map(([k, l]) => `<button class="chipb" data-c="${k}" aria-pressed="${galCat === k}">${esc(l)}</button>`).join('')}</div></div>
    <label class="drop" id="drop"><strong>Přidat fotky</strong><span class="cnt">Klikněte nebo sem fotky přetáhněte (JPG, PNG, HEIC)</span><input type="file" accept="image/*" multiple hidden id="files"></label>
    <div class="photos" style="margin-top:1rem">${rows.map((p, i) => `
      <div class="ph"><img src="${esc(photoUrl(p.storage_path))}" alt="" loading="lazy">
        <div class="ph-b"><strong>${esc(cats[p.category] || p.category)}</strong><p>${esc(p.alt)}</p>
          <div class="ph-acts"><button class="b b-sm" data-edit="${esc(p.id)}">Upravit</button><button class="b b-sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Posunout dopředu">◀</button><button class="b b-sm" data-down="${i}" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Posunout dozadu">▶</button></div>
        </div></div>`).join('')}</div>`;
  $$('[data-c]').forEach((b) => (b.onclick = () => { galCat = b.dataset.c!; gallery(); }));
  const input = $<HTMLInputElement>('#files'); const drop = $('#drop');
  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    const cat = galCat === 'vse' ? 'ostatni' : galCat;
    toast(`Nahrávám ${files.length} ${files.length === 1 ? 'fotku' : 'fotek'}…`);
    let pos = all.length;
    for (const f of Array.from(files)) {
      try { const up = await uploadPhoto(f); await save('gallery_photos', { storage_path: up.path, width: up.width, height: up.height, alt: `${cats[cat] || 'Převodovka'} – oprava v naší dílně`, category: cat, position: pos++ }); }
      catch (e) { fail(e); }
    }
    toast('Hotovo. Doplňte prosím k fotkám popisy.'); gallery();
  };
  input.onchange = () => handle(input.files);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); handle(e.dataTransfer?.files || null); };
  const swap = async (i: number, j: number) => { const a = rows[i], b = rows[j]; const pa = a.position, pb = b.position === pa ? pa + (j > i ? 1 : -1) : b.position; await save('gallery_photos', { ...a, position: pb }); await save('gallery_photos', { ...b, position: pa }); gallery(); };
  $$('[data-up]').forEach((b) => (b.onclick = () => swap(+b.dataset.up!, +b.dataset.up! - 1).catch(fail)));
  $$('[data-down]').forEach((b) => (b.onclick = () => swap(+b.dataset.down!, +b.dataset.down! + 1).catch(fail)));
  $$('[data-edit]').forEach((b) => (b.onclick = () => {
    const p = all.find((x) => x.id === b.dataset.edit)!;
    dialog(`<h2>Upravit fotku</h2><img src="${esc(photoUrl(p.storage_path))}" alt="" style="max-height:260px;width:auto;border-radius:6px">
      <label>Popis fotky (pro nevidomé a Google) <input name="alt" value="${esc(p.alt)}" required maxlength="140"></label>
      <label>Kategorie <select name="category">${Object.entries(cats).map(([k, l]) => `<option value="${k}" ${p.category === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <div class="dlg-acts"><button class="b b-danger" value="delete" formnovalidate>Smazat fotku</button><span style="flex:1"></span><button class="b" value="cancel" formnovalidate>Zrušit</button><button class="b b-red" value="ok">Uložit</button></div>`,
      async (fd, _f, action) => {
        if (action === 'delete') { if (!(await confirmDlg('Opravdu smazat tuto fotku?'))) return; await remove('gallery_photos', p.id); await deletePhotoFile(p.storage_path); toast('Fotka smazána'); }
        else { await save('gallery_photos', { ...p, alt: fd.get('alt'), category: fd.get('category') }); toast('Uloženo'); }
        gallery();
      });
  }));
}

// ---------- obecný seznam s pořadím (služby, menu) ----------
async function orderedList(t: Table, opts: { title: string; intro: string; addLabel: string; line: (r: Row) => [string, string]; form: (r: Row) => string; read: (fd: FormData, r: Row) => Row; render: () => Promise<void>; dim?: (r: Row) => boolean }) {
  const rows = await list(t);
  view().innerHTML = `
    <div class="vh"><div><h1>${opts.title}</h1><p>${opts.intro}</p></div><button class="b b-red" id="add">${opts.addLabel}</button></div>
    ${rows.some((r) => r._unsaved) ? '<p class="card" style="margin-bottom:1rem;font-size:.9rem">Zobrazuje se obsah z webu. Po první úpravě se uloží do databáze.</p>' : ''}
    <div class="rows">${rows.map((r, i) => { const [t1, t2] = opts.line(r); return `
      <div class="row ${opts.dim?.(r) ? 'muted' : ''}"><div class="mv"><button data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Nahoru">▲</button><button data-down="${i}" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Dolů">▼</button></div>
        <div style="min-width:0"><div class="row-t">${esc(t1)}</div><div class="row-s">${esc(t2)}</div></div>
        <div class="row-acts"><button class="b b-sm" data-edit="${i}">Upravit</button></div></div>`; }).join('')}</div>`;
  const persistAll = async (list_: Row[]) => { for (let i = 0; i < list_.length; i++) await save(t, { ...list_[i], position: i }); };
  const move = async (i: number, j: number) => { const copy = [...rows]; [copy[i], copy[j]] = [copy[j], copy[i]]; await persistAll(copy); opts.render(); };
  $$('[data-up]').forEach((b) => (b.onclick = () => move(+b.dataset.up!, +b.dataset.up! - 1).catch(fail)));
  $$('[data-down]').forEach((b) => (b.onclick = () => move(+b.dataset.down!, +b.dataset.down! + 1).catch(fail)));
  const edit = (r: Row, isNew: boolean) => dialog(`${opts.form(r)}
    <div class="dlg-acts">${isNew ? '' : '<button class="b b-danger" value="delete" formnovalidate>Smazat</button>'}<span style="flex:1"></span><button class="b" value="cancel" formnovalidate>Zrušit</button><button class="b b-red" value="ok">Uložit</button></div>`,
    async (fd, _f, action) => {
      if (action === 'delete') {
        if (!(await confirmDlg('Opravdu smazat?'))) return;
        if (rows.some((x) => x._unsaved)) { await persistAll(rows.filter((x) => x !== r)); } else await remove(t, r[keyOf(t)]);
        toast('Smazáno');
      } else {
        const updated = opts.read(fd, r);
        if (rows.some((x) => x._unsaved)) { const all_ = isNew ? [...rows, updated] : rows.map((x) => (x === r ? updated : x)); await persistAll(all_); }
        else await save(t, { ...updated, position: isNew ? rows.length : r.position });
        toast('Uloženo');
      }
      opts.render();
    });
  $('#add').onclick = () => edit({}, true);
  $$('[data-edit]').forEach((b) => (b.onclick = () => edit(rows[+b.dataset.edit!], false)));
}

// ---------- SLUŽBY ----------
const icons = { scan: 'Diagnostika', wrench: 'Klíč', gear: 'Ozubené kolo', oil: 'Olej', drop: 'Kapka', shield: 'Štít', search: 'Lupa' };
async function services() {
  await orderedList('services', {
    title: 'Služby', intro: 'Karty služeb na úvodní stránce. Pořadí měňte šipkami.', addLabel: 'Přidat službu', render: services,
    dim: (r) => !r.visible,
    line: (r) => [r.title + (r.visible ? '' : ' (skrytá)'), [r.summary, r.price_note && `Cena: ${r.price_note}`, r.bookable && 'lze rezervovat online'].filter(Boolean).join(' · ')],
    form: (r) => `<h2>${r.title ? 'Upravit službu' : 'Nová služba'}</h2>
      <label>Název <input name="title" value="${esc(r.title)}" required></label>
      <label>Krátký popis <textarea name="summary" rows="3" style="min-height:80px">${esc(r.summary)}</textarea></label>
      <div class="f2"><label>Cena (volitelné) <input name="price_note" value="${esc(r.price_note)}" placeholder="např. od 2 500 Kč"></label>
      <label>Ikona <select name="icon">${Object.entries(icons).map(([k, l]) => `<option value="${k}" ${r.icon === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label>Odkaz na stránku <input name="href" value="${esc(r.href)}" placeholder="/oprava-automaticke-prevodovky/"></label>
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap"><label class="inline"><input type="checkbox" name="visible" ${r.visible !== false ? 'checked' : ''}> Zobrazit na webu</label>
      <label class="inline"><input type="checkbox" name="bookable" ${r.bookable ? 'checked' : ''}> Lze rezervovat online</label></div>`,
    read: (fd, r) => ({ ...r, title: fd.get('title'), summary: fd.get('summary'), price_note: fd.get('price_note'), icon: fd.get('icon'), href: fd.get('href'), visible: fd.get('visible') === 'on', bookable: fd.get('bookable') === 'on' }),
  });
}

// ---------- MENU ----------
async function menu() {
  const pagesList = await list('pages');
  await orderedList('menu_items', {
    title: 'Menu', intro: 'Položky hlavního menu. Na počítači se v liště ukazují jen označené položky, na mobilu všechny.', addLabel: 'Přidat položku', render: menu,
    line: (r) => [r.label, `${r.href} · ${[r.in_header && 'lišta', r.in_mobile && 'mobil'].filter(Boolean).join(' + ') || 'skryto'}`],
    dim: (r) => !r.in_header && !r.in_mobile,
    form: (r) => `<h2>${r.label ? 'Upravit položku menu' : 'Nová položka menu'}</h2>
      <label>Text v menu <input name="label" value="${esc(r.label)}" required maxlength="30"></label>
      <label>Stránka <input name="href" value="${esc(r.href)}" list="pg" required placeholder="/kontakt/"></label>
      <datalist id="pg">${pagesList.map((p) => `<option value="/${p.slug ? p.slug + '/' : ''}">${esc(p.title)}</option>`).join('')}</datalist>
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap"><label class="inline"><input type="checkbox" name="in_header" ${r.in_header !== false ? 'checked' : ''}> V horní liště (počítač)</label>
      <label class="inline"><input type="checkbox" name="in_mobile" ${r.in_mobile !== false ? 'checked' : ''}> V mobilním menu</label></div>`,
    read: (fd, r) => ({ ...r, label: fd.get('label'), href: fd.get('href'), in_header: fd.get('in_header') === 'on', in_mobile: fd.get('in_mobile') === 'on' }),
  });
}

// ---------- STRÁNKY A SEO ----------
let pgQuery = '';
async function pages() {
  const rows = await list('pages');
  const shown = rows.filter((p) => !pgQuery || (p.title + p.slug + p.seo_title).toLowerCase().includes(pgQuery.toLowerCase()));
  const warn = (p: Row) => { const t = (p.seo_title || '').length, d = (p.seo_description || '').length; return t > 65 || t < 25 || d > 165 || d < 70; };
  view().innerHTML = `
    <div class="vh"><div><h1>Stránky a SEO</h1><p>Titulky a popisy pro Google. Vlastní stránky můžete přidat a pak je dát do menu.</p></div><button class="b b-red" id="addpage">Nová stránka</button></div>
    <input type="search" id="pgq" placeholder="Hledat stránku…" value="${esc(pgQuery)}" style="margin-bottom:1rem;max-width:360px">
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Stránka</th><th>Titulek v Googlu</th><th>SEO</th><th></th></tr></thead><tbody>
    ${shown.map((p) => `<tr><td><strong>${esc(p.title)}</strong><br><small>/${esc(p.slug)}${p.slug ? '/' : ''}${p.custom ? ' · vlastní' : ''}</small></td>
      <td>${esc(p.seo_title)}</td><td>${p.noindex ? '<span class="st st-zamitnuta">neindexovat</span>' : warn(p) ? '<span class="st st-nova">zkontrolovat</span>' : '<span class="st st-potvrzena">v pořádku</span>'}</td>
      <td><button class="b b-sm" data-pg="${esc(p.slug)}">Upravit</button></td></tr>`).join('')}
    </tbody></table></div>`;
  const q = $<HTMLInputElement>('#pgq'); q.oninput = () => { pgQuery = q.value; const pos = q.selectionStart; pages().then(() => { const n = $<HTMLInputElement>('#pgq'); n.focus(); n.setSelectionRange(pos, pos); }); };
  $('#addpage').onclick = () => pageEdit({ custom: true, slug: '', title: '' }, true);
  $$('[data-pg]').forEach((b) => (b.onclick = () => pageEdit(rows.find((p) => p.slug === b.dataset.pg)!, false)));
}

function pageEdit(p: Row, isNew: boolean) {
  const form = dialog(`<h2>${isNew ? 'Nová stránka' : esc(p.title)}</h2>
    ${isNew || p.custom ? `<div class="f2"><label>Název stránky (nadpis H1) <input name="title" value="${esc(p.title)}" required></label>
      <label>Adresa <input name="slug" value="${esc(p.slug)}" ${isNew ? '' : 'readonly'} required pattern="[a-z0-9-]+" placeholder="napr-pneuservis"></label></div>
      <label>Úvodní věta <input name="lead" value="${esc(p.lead)}"></label>
      <label>Obsah stránky <textarea name="body_md" rows="10" placeholder="Nadpis sekce začněte ## , odrážky - , tučně **text**">${esc(p.body_md)}</textarea></label>` : ''}
    <label>Titulek v Googlu <span class="cnt" data-cnt="seo_title"></span><input name="seo_title" value="${esc(p.seo_title)}" maxlength="90"></label>
    <label>Popis v Googlu <span class="cnt" data-cnt="seo_description"></span><textarea name="seo_description" rows="3" style="min-height:80px" maxlength="250">${esc(p.seo_description)}</textarea></label>
    <div><p class="cnt" style="margin-bottom:.35rem">Náhled ve vyhledávání</p><div class="serp"><div class="serp-u">www.atautoservis.cz › <span data-slug>${esc(p.slug)}</span></div><div class="serp-t" data-prev="seo_title"></div><div class="serp-d" data-prev="seo_description"></div></div></div>
    <label class="inline"><input type="checkbox" name="noindex" ${p.noindex ? 'checked' : ''}> Skrýt před vyhledávači (noindex)</label>
    <div class="dlg-acts">${p.custom && !isNew ? '<button class="b b-danger" value="delete" formnovalidate>Smazat stránku</button>' : ''}<span style="flex:1"></span><button class="b" value="cancel" formnovalidate>Zrušit</button><button class="b b-red" value="ok">Uložit</button></div>`,
    async (fd, _f, action) => {
      if (action === 'delete') { if (!(await confirmDlg('Opravdu smazat stránku?'))) return; await remove('pages', p.slug); toast('Smazáno'); return pages(); }
      const row: Row = { ...p, seo_title: fd.get('seo_title'), seo_description: fd.get('seo_description'), noindex: fd.get('noindex') === 'on', updated_at: new Date().toISOString() };
      if (isNew || p.custom) Object.assign(row, { title: fd.get('title'), slug: fd.get('slug'), lead: fd.get('lead'), body_md: fd.get('body_md'), custom: true });
      await save('pages', row); toast('Uloženo. Na web se dostane po publikování.'); pages();
    }, true);
  const lim: Record<string, [number, number]> = { seo_title: [25, 65], seo_description: [70, 165] };
  const upd = () => {
    for (const k of Object.keys(lim)) {
      const v = (form.elements.namedItem(k) as HTMLInputElement).value; const [lo, hi] = lim[k];
      const c = $(`[data-cnt=${k}]`, form); c.textContent = `${v.length} znaků (ideálně ${lo}–${hi})`; c.classList.toggle('bad', v.length < lo || v.length > hi);
      $(`[data-prev=${k}]`, form).textContent = v.length > hi ? v.slice(0, hi - 1) + '…' : v || '(nevyplněno)';
    }
    const s = form.elements.namedItem('slug') as HTMLInputElement | null; if (s) $('[data-slug]', form).textContent = s.value;
  };
  form.addEventListener('input', upd); upd();
  const title = form.elements.namedItem('title') as HTMLInputElement | null, slug = form.elements.namedItem('slug') as HTMLInputElement | null;
  if (isNew && title && slug) title.addEventListener('input', () => { slug.value = title.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); upd(); });
}
