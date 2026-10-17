// Made-up headlines in the shape of a GDELT DOC 2.0 ArtList answer, on example domains: nothing
// here is real news. Long tracking links, entities and image links, as GDELT's answers carry them.

const SITES = [
  'autonews.example.in',
  'www.business-daily.example.com',
  'markets.example.in',
  'www.cvtimes.example.in',
  'steelcity-herald.example.in',
  'fleet-weekly.example.com',
  'www.trade-desk.example.com',
];
const SUBJECTS = [
  'commercial vehicle sales',
  'truck volumes',
  'CV exports',
  'heavy truck demand',
  'Jamshedpur plant output',
  'fleet orders',
  'monthly dispatches',
];
const VERBS = ['rise', 'slip', 'hold steady', 'climb', 'ease', 'jump', 'dip'];
const TAILS = [
  'as freight demand firms up after the monsoon',
  '&amp; dealers report longer waiting periods',
  'on the back of infrastructure spending, say analysts',
  '&#8211; what it means for suppliers in Adityapur',
  'with exports to &quot;neighbouring markets&quot; up',
  'while the industry waits for the festive season',
  'as the company&#39;s new range reaches showrooms',
];

const pad = (n) => String(n).padStart(2, '0');
export function seendate(ms) {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export const NEWEST = Date.UTC(2026, 9, 16, 3, 30);

export function gdeltArticle(i, { topic = 'tata-cv', newest = NEWEST } = {}) {
  const site = SITES[i % SITES.length];
  const pct = ((i * 7) % 19) + 1;
  const spanish = i % 9 === 8;
  const title = spanish
    ? `Tata Motors aumenta un ${pct}% sus exportaciones de camiones a M&eacute;xico y Centroam&eacute;rica`
    : `Tata Motors ${SUBJECTS[i % SUBJECTS.length]} ${VERBS[i % VERBS.length]} ${pct}% in September ${TAILS[i % TAILS.length]}`;
  const slug = title
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const id = 100000 + i * 7919;
  return {
    url: `https://${site}/industry/auto/${topic}/${slug}-${id}.html?utm_source=gdelt&utm_medium=referral&utm_campaign=newsfeed`,
    url_mobile: `https://${site}/amp/industry/auto/${slug}-${id}.cms`,
    title,
    seendate: seendate(newest - i * 4 * 3600000 - (i % 3) * 900000),
    socialimage: `https://img.${site.replace(/^www\./, '')}/photo/${200000 + i * 31}/${slug.slice(0, 48)}.jpg?imgsize=${40000 + i * 97}&width=1200&height=900&resizemode=75`,
    domain: site.replace(/^www\./, ''),
    language: spanish ? 'Spanish' : 'English',
    sourcecountry: spanish ? 'Mexico' : 'India',
  };
}

export function gdeltAnswer(n = 25, opts = {}) {
  return { articles: Array.from({ length: n }, (_, i) => gdeltArticle(i, opts)) };
}
