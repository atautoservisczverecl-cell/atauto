// Ověřené údaje převzaté ze stávajícího webu atautoservis.cz (11/2026).
export const site = {
  name: 'A.T. AUTOSERVIS',
  legalName: 'A.T. AUTO SERVICE s.r.o.',
  url: 'https://www.atautoservis.cz',
  ico: '25669338',
  dic: 'CZ25669338',
  phone: '+420 721 004 440',
  phoneShort: '721 004 440',
  phoneHref: 'tel:+420721004440',
  email: 'info@atautoservis.cz',
  street: 'Nádražní 272',
  city: 'Hostivice',
  zip: '253 01',
  region: 'Praha-západ',
  mapUrl: 'https://maps.app.goo.gl/4oi2L1k2nFpYzSNEA', // profil firmy na Google Mapách (recenze, navigace)
  hours: 'Po–Pá 8:30–17:30',
  hoursSchema: { days: ['Monday','Tuesday','Wednesday','Thursday','Friday'], opens: '08:30', closes: '17:30' },
  since: 1991,
  warranty: 'až 24 měsíců',
  // Z obchodních podmínek: 24 měs. na nové díly, 6 měs. na repasované; podmínkou bezplatná záruční prohlídka po 1 000 km nebo do 2 měsíců.
  warrantyDetail: 'Na nové náhradní díly a komponenty poskytujeme záruku 24 měsíců, na repasované nebo revidované díly 6 měsíců od montáže. Podmínkou je bezplatná záruční prohlídka převodovky po ujetí 1 000 km nebo do 2 měsíců od převzetí vozu.',
  priceDiag: 'Diagnostika závady a kontrola funkčnosti komponent stojí od 2 500 Kč, samotné načtení chybových kódů 600 Kč (ceny bez DPH).',
  // Doplnit před spuštěním:
  gtmId: '', // např. GTM-XXXXXXX
  ga4Id: '', // např. G-XXXXXXXXXX
};
export const yearsOnMarket = new Date().getFullYear() - site.since;
