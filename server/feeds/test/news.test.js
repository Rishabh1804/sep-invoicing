// The news: what /news accepts, what it asks GDELT, how GDELT's answer is read, and how the
// copy is kept, served, refreshed and served stale.
import { describe, it, expect } from 'vitest';
import {
  TOPIC_IDS,
  parseTopics,
  parseModels,
  topicQuery,
  modelsQuery,
  gdeltUrl,
  decodeEntities,
  cleanTitleText,
  clipTitle,
  cleanUrl,
  seenAt,
  normaliseArticles,
  parseLooseJson,
} from '../src/news.js';
import { upstreamGet } from '../src/upstream.js';
import { makeApp, makeClock, makeUpstream, newBase, call, jsonResponse, deferred } from './helpers.js';
import { gdeltAnswer, gdeltArticle } from './fixtures/gdelt.js';

const ALL = '/news?topics=tata-cv,tata-plant,tata-models,tata-exports&models=Prima,Signa,Ultra,Azura';
const MIN = 60000;

// A GDELT that answers each topic with `n` articles whose titles say which topic and version.
function gdeltFor(clock, { n = 3, version = () => 1, fail = () => null, hold = () => null, took = 0 } = {}) {
  return makeUpstream({
    clock,
    gdelt: async (url, c) => {
      const h = hold();
      if (h) await h;
      if (took) clock.advance(took);
      const f = fail(c.topic);
      if (f) return f;
      const v = version();
      return jsonResponse({
        articles: Array.from({ length: n }, (_, i) => ({
          ...gdeltArticle(i, { topic: c.topic }),
          title: `${c.topic} v${v} headline ${i}`,
        })),
      });
    },
  });
}

describe('topics', () => {
  it("takes any of the four, once each, in the answer's order", () => {
    expect(TOPIC_IDS).toEqual(['tata-cv', 'tata-plant', 'tata-models', 'tata-exports']);
    expect(parseTopics('tata-exports, TATA-CV ,tata-exports,')).toEqual({ topics: ['tata-cv', 'tata-exports'] });
  });

  it('refuses an unknown topic, and none at all', () => {
    expect(parseTopics('tata-cv,tata-cars').error).toBe('Unknown topic: tata-cars');
    expect(parseTopics('constructor').error).toBe('Unknown topic: constructor');
    expect(parseTopics('').error).toMatch(/^topics is needed/);
    expect(parseTopics(' , ').error).toMatch(/^topics is needed/);
    expect(parseTopics(null).error).toMatch(/^topics is needed/);
  });

  it('answers 400 for a bad topics list and asks GDELT nothing', async () => {
    const clock = makeClock();
    const upstream = gdeltFor(clock);
    const app = makeApp({ upstream, clock });
    const base = newBase();
    for (const [path, error] of [
      ['/news', /^topics is needed/],
      ['/news?topics=', /^topics is needed/],
      ['/news?topics=tata-cv,weather', /^Unknown topic: weather$/],
      ['/news?topics=tata-models', /^models is needed for tata-models$/],
      ['/news?topics=tata-models&models=', /^models is needed for tata-models$/],
    ]) {
      const { res, body } = await call(app, base, path);
      expect(res.status, path).toBe(400);
      expect(body.error, path).toMatch(error);
    }
    expect(upstream.calls).toHaveLength(0);
  });
});

describe('models', () => {
  it('takes up to 8 words of letters, digits, spaces and dots, 16 characters each', () => {
    expect(parseModels('Prima,Signa,Ultra,Azura')).toEqual({ models: ['azura', 'prima', 'signa', 'ultra'] });
    expect(parseModels(' Ultra  T.7 ,LPT 1918,,prima,PRIMA ')).toEqual({ models: ['lpt 1918', 'prima', 'ultra t.7'] });
    expect(parseModels('a,b,c,d,e,f,g,h').models).toHaveLength(8);
    expect(parseModels('Sixteen chars ok').models).toEqual(['sixteen chars ok']);
    expect(parseModels(null)).toEqual({ models: [] });
  });

  it('refuses a ninth word, a long word, and any other character', () => {
    expect(parseModels('a,b,c,d,e,f,g,h,i').error).toBe('At most 8 models');
    expect(parseModels('Seventeen chars!!').error).toMatch(/^A model is 16 characters at most/);
    expect(parseModels('Seventeen charsxx').error).toMatch(/^A model is 16 characters at most/);
    for (const bad of ['Prima;', 'Signa-X', '"Ultra"', '<b>', 'Azura OR x:y', '...', 'Prima\u00e9', 'Ultra/1918']) {
      expect(parseModels(bad).error, bad).toMatch(/^A model is (letters|16)/);
    }
    expect(parseModels('x'.repeat(201)).error).toBe('models is too long');
  });

  it('answers 400 for bad models, even for topics that do not read them', async () => {
    const clock = makeClock();
    const upstream = gdeltFor(clock);
    const app = makeApp({ upstream, clock });
    const base = newBase();
    for (const path of [
      '/news?topics=tata-models&models=a,b,c,d,e,f,g,h,i',
      '/news?topics=tata-models&models=Prima;Signa',
      '/news?topics=tata-cv&models=%3Cscript%3E',
    ]) {
      const { res, body } = await call(app, base, path);
      expect(res.status, path).toBe(400);
      expect(body.error).toMatch(/model/);
    }
    expect(upstream.calls).toHaveLength(0);
  });
});

describe('the queries', () => {
  it('asks GDELT the four queries of section 9a', () => {
    expect(topicQuery('tata-cv', [])).toBe('"tata motors" (sales OR trucks OR "commercial vehicles") sourcecountry:IN');
    expect(topicQuery('tata-plant', [])).toBe('"tata motors" jamshedpur');
    expect(topicQuery('tata-exports', [])).toBe('"tata motors" (exports OR "international business")');
  });

  it('builds tata-models from the words sent: a quoted phrase each, joined by OR', () => {
    const { models } = parseModels('Prima,Signa,Ultra,Azura');
    expect(topicQuery('tata-models', models)).toBe('("tata azura" OR "tata prima" OR "tata signa" OR "tata ultra")');
    expect(modelsQuery(['ultra t.7', 'lpt 1918'])).toBe('("tata ultra t.7" OR "tata lpt 1918")');
    expect(modelsQuery(['prima'])).toBe('"tata prima"');
  });

  it('asks for 25 articles of the last 14 days, newest first, as JSON', () => {
    const u = new URL(gdeltUrl('"tata motors" jamshedpur'));
    expect(u.origin + u.pathname).toBe('https://api.gdeltproject.org/api/v2/doc/doc');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      query: '"tata motors" jamshedpur',
      mode: 'ArtList',
      format: 'json',
      maxrecords: '25',
      timespan: '14d',
      sort: 'DateDesc',
    });
  });

  it('sends exactly those requests for the four topics, the models among them', async () => {
    const clock = makeClock();
    const upstream = gdeltFor(clock);
    const app = makeApp({ upstream, clock });
    const { res } = await call(app, newBase(), ALL);
    expect(res.status).toBe(200);
    const asked = upstream.gdeltCalls();
    expect(asked.map((c) => c.topic)).toEqual(TOPIC_IDS);
    expect(asked.map((c) => c.url.searchParams.get('query'))).toEqual([
      '"tata motors" (sales OR trucks OR "commercial vehicles") sourcecountry:IN',
      '"tata motors" jamshedpur',
      '("tata azura" OR "tata prima" OR "tata signa" OR "tata ultra")',
      '"tata motors" (exports OR "international business")',
    ]);
    for (const c of asked) {
      expect(c.url.href).toBe(gdeltUrl(c.url.searchParams.get('query')));
      expect(c.headers.get('User-Agent')).toBe('sep-feeds/1');
      expect(c.signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe('a headline, read', () => {
  it('decodes named, numeric and hex entities, and Windows-1252 numbers as a browser does', () => {
    expect(decodeEntities('Tata &amp; Sons &lt;3 &quot;CV&quot; &apos;26 &#39;Prima&#39;')).toBe('Tata & Sons <3 "CV" \'26 \'Prima\'');
    expect(decodeEntities('&#8377;1,200 cr &#x20B9;5 &eacute;t&eacute; &nbsp;&mdash;&hellip;')).toBe('₹1,200 cr ₹5 été \u00a0—…');
    expect(decodeEntities('&#146;s &#150; &#128;')).toBe('’s – €');
    expect(decodeEntities('&#0; &#xD800; &#1114112;')).toBe('\uFFFD \uFFFD \uFFFD');
    expect(decodeEntities('&unknown; &amp no semicolon &constructor;')).toBe('&unknown; &amp no semicolon &constructor;');
  });

  it('drops tags, written raw or as entities, and keeps a < or > that is text', () => {
    expect(cleanTitleText('<b>Tata Motors</b> sales <em>rise</em>')).toBe('Tata Motors sales rise');
    expect(cleanTitleText('Tata&lt;b&gt;Prima&lt;/b&gt; launched')).toBe('TataPrima launched');
    expect(cleanTitleText('Line one<br>line two<p>three</p>')).toBe('Line one line two three');
    expect(cleanTitleText('Margins < 5% > last year')).toBe('Margins < 5% > last year');
    expect(cleanTitleText('Q3 <2026> outlook')).toBe('Q3 <2026> outlook');
  });

  it('takes out control and zero-width characters, and collapses the spaces', () => {
    expect(cleanTitleText('  Tata\tMotors\r\n\u0007sales\u200b up&shy;\u00a0 \ufeff ')).toBe('Tata Motors sales up');
    expect(cleanTitleText(42)).toBe('');
  });

  it('keeps 200 characters at most, the last an ellipsis, never splitting a pair', () => {
    const long = 'x'.repeat(250);
    expect(clipTitle(long)).toHaveLength(200);
    expect(clipTitle(long).endsWith('…')).toBe(true);
    expect(clipTitle('y'.repeat(200))).toBe('y'.repeat(200));
    const emoji = '🚚'.repeat(201); // 402 UTF-16 units, 201 characters
    const cut = clipTitle(emoji);
    expect(Array.from(cut)).toHaveLength(200);
    expect(cut).toBe(`${'🚚'.repeat(199)}…`);
    expect(clipTitle('🚚'.repeat(150))).toBe('🚚'.repeat(150)); // 300 units, 150 characters: kept whole
  });

  it('keeps a link only when it is http or https, with no user name or password', () => {
    expect(cleanUrl(' https://news.example.in/a?b=1#c ')).toBe('https://news.example.in/a?b=1#c');
    expect(cleanUrl('http://NEWS.example.in/x')).toBe('http://news.example.in/x');
    for (const bad of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://files.example.in/a',
      'mailto:a@example.in',
      '/relative/path',
      '//news.example.in/x',
      'https://news.example.in@evil.example/x',
      'https://user:pass@news.example.in/',
      'https://',
      `https://news.example.in/${'a'.repeat(2000)}`,
      '',
      null,
      12,
    ]) {
      expect(cleanUrl(bad), String(bad).slice(0, 40)).toBeNull();
    }
  });

  it("reads GDELT's seen date as an ISO time", () => {
    expect(seenAt('20261015T084500Z')).toBe('2026-10-15T08:45:00.000Z');
    expect(seenAt('2026-10-15T08:45:00Z')).toBe('2026-10-15T08:45:00.000Z');
    for (const bad of ['20261315T084500Z', '20261032T084500Z', '20261015T254500Z', '2026-10-15', 'yesterday', '', null]) {
      expect(seenAt(bad), String(bad)).toBeNull();
    }
  });
});

describe("GDELT's answer, read", () => {
  it('makes each article {title, url, source, at, lang}', () => {
    const items = normaliseArticles(gdeltAnswer(9));
    expect(items).toHaveLength(9);
    expect(Object.keys(items[0])).toEqual(['title', 'url', 'source', 'at', 'lang']);
    expect(items[0]).toEqual({
      title: 'Tata Motors commercial vehicle sales rise 1% in September as freight demand firms up after the monsoon',
      url: gdeltArticle(0).url,
      source: 'autonews.example.in',
      at: '2026-10-16T03:30:00.000Z',
      lang: 'English',
    });
    expect(items[1].source).toBe('business-daily.example.com'); // www. taken off
    expect(items[1].title).toBe('Tata Motors truck volumes slip 8% in September & dealers report longer waiting periods');
    expect(items[3].title).toContain('– what it means for suppliers in Adityapur');
    expect(items[4].title).toContain('with exports to "neighbouring markets" up');
    expect(items[6].title).toContain("as the company's new range reaches showrooms");
    expect(items[8]).toMatchObject({ lang: 'Spanish', title: 'Tata Motors aumenta un 19% sus exportaciones de camiones a México y Centroamérica' });
  });

  it('passes over an article with no usable link or title, and keeps the same title once', () => {
    const a = (title, url, extra = {}) => ({ title, url, seendate: '20261015T084500Z', language: 'English', ...extra });
    const items = normaliseArticles({
      articles: [
        a('Tata Motors posts record CV sales', 'https://one.example.in/1'),
        a('TATA MOTORS POSTS RECORD CV SALES!', 'https://two.example.in/2'), // the same title
        a('Tata Motors posts record CV sales', 'https://three.example.in/3'), // the same again
        a('Another story', 'https://one.example.in/1'), // the same link
        a('Click here', 'javascript:alert(1)'),
        a('No link at all', undefined),
        a('<b></b>', 'https://four.example.in/4'), // nothing left of the title
        a('   ', 'https://five.example.in/5'),
        null,
        'not an article',
        a('Tata Motors posts record CV sales in Jharkhand', 'https://six.example.in/6', { language: undefined, seendate: 'soon' }),
      ],
    });
    expect(items.map((i) => i.url)).toEqual(['https://one.example.in/1', 'https://six.example.in/6']);
    expect(items[1]).toMatchObject({ at: null, lang: null });
  });

  it('keeps 25 at most, and two long titles that differ after the cut are both kept', () => {
    expect(normaliseArticles(gdeltAnswer(40))).toHaveLength(25);
    const base = 'Tata Motors '.repeat(20); // 240 characters
    const items = normaliseArticles({
      articles: [
        { title: `${base}ends one way`, url: 'https://a.example.in/1' },
        { title: `${base}ends another`, url: 'https://a.example.in/2' },
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe(items[1].title);
    expect(items[0].title).toHaveLength(200);
  });

  it('reads no articles from an answer that has none', () => {
    expect(normaliseArticles({})).toEqual([]);
    expect(normaliseArticles({ articles: 'nope' })).toEqual([]);
    expect(normaliseArticles(null)).toEqual([]);
  });

  it("mends the two faults GDELT's JSON is known for, and gives up on anything else", () => {
    expect(parseLooseJson('{"articles":[]}')).toEqual({ articles: [] });
    expect(parseLooseJson('{"articles":[{"title":"Tata\'s \\\'big\\\' day\nnew line","url":"https://a.example.in/x"}]}')).toEqual({
      articles: [{ title: "Tata's 'big' day new line", url: 'https://a.example.in/x' }],
    });
    expect(parseLooseJson('{"a":"C:\\\\path\\\\x"}')).toEqual({ a: 'C:\\path\\x' }); // a real escaped backslash stays
    expect(parseLooseJson('Please limit requests to one every 5 seconds.')).toBeUndefined();
    expect(parseLooseJson('')).toBeUndefined();
  });

  it("answers the app with the items read, the credit, and each topic's time", async () => {
    const clock = makeClock();
    const upstream = makeUpstream({ clock, gdelt: () => jsonResponse(gdeltAnswer(30)) });
    const app = makeApp({ upstream, clock });
    const start = clock.t;
    const { res, body } = await call(app, newBase(), ALL);
    expect(res.status).toBe(200);
    expect(Object.keys(body)).toEqual(['at', 'topics', 'credit']);
    expect(body.credit).toEqual({ name: 'The GDELT Project', url: 'https://www.gdeltproject.org/' });
    expect(Object.keys(body.topics)).toEqual(TOPIC_IDS);
    TOPIC_IDS.forEach((id, k) => {
      expect(body.topics[id].items).toHaveLength(25);
      expect(body.topics[id].at).toBe(new Date(start + k * 6000).toISOString());
      expect(body.topics[id].stale).toBeUndefined();
    });
    expect(body.at).toBe(new Date(start + 18000).toISOString());
    expect(body.stale).toBeUndefined();
  });

  it("takes GDELT's empty answer as no headlines, not a failure", async () => {
    const clock = makeClock();
    const upstream = makeUpstream({ clock, gdelt: () => jsonResponse({}) });
    const { res, body } = await call(makeApp({ upstream, clock }), newBase(), '/news?topics=tata-plant');
    expect(res.status).toBe(200);
    expect(body.topics['tata-plant']).toEqual({ at: new Date(clock.t).toISOString(), items: [] });
    expect(body.stale).toBeUndefined();
  });
});

describe('GDELT asked one topic at a time, 6 s apart', () => {
  it('starts each request at least 6 s after the one before, never two at once', async () => {
    const clock = makeClock();
    const upstream = gdeltFor(clock);
    await call(makeApp({ upstream, clock }), newBase(), ALL);
    const starts = upstream.gdeltCalls().map((c) => c.at);
    expect(starts).toHaveLength(4);
    for (let k = 1; k < starts.length; k++) expect(starts[k] - starts[k - 1]).toBeGreaterThanOrEqual(6000);
    expect(clock.sleeps).toEqual([6000, 6000, 6000]);
    expect(upstream.maxOpen()).toBe(1);
  });

  it('waits only what is left of the 6 s after a slow answer, and none after a slower one', async () => {
    const clock = makeClock();
    const upstream = gdeltFor(clock, { took: 4000 });
    await call(makeApp({ upstream, clock }), newBase(), ALL);
    expect(clock.sleeps).toEqual([2000, 2000, 2000]);
    const slow = makeClock();
    const slower = gdeltFor(slow, { took: 7000 });
    await call(makeApp({ upstream: slower, clock: slow }), newBase(), ALL);
    expect(slow.sleeps).toEqual([]);
    const starts = slower.gdeltCalls().map((c) => c.at);
    for (let k = 1; k < starts.length; k++) expect(starts[k] - starts[k - 1]).toBe(7000);
  });

  it('keeps a refresh within its 25 s: a topic with no time left is not asked', async () => {
    const clock = makeClock();
    const upstream = gdeltFor(clock, { took: 9000 });
    const { body } = await call(makeApp({ upstream, clock }), newBase(), ALL);
    expect(upstream.gdeltCalls().map((c) => c.topic)).toEqual(['tata-cv', 'tata-plant', 'tata-models']);
    expect(body.topics['tata-exports']).toEqual({ at: null, items: [], stale: true, error: 'No time was left in this refresh' });
    expect(body.stale).toBe(true);
  });

  it("cuts each request's time-out to what is left of the refresh, 10 s at most", async () => {
    let seen = [];
    const realTimeout = AbortSignal.timeout;
    AbortSignal.timeout = (ms) => {
      seen.push(ms);
      return realTimeout.call(AbortSignal, ms);
    };
    try {
      const clock = makeClock();
      const upstream = gdeltFor(clock, { took: 9000 });
      await call(makeApp({ upstream, clock }), newBase(), ALL);
      expect(seen).toEqual([10000, 10000, 7000]);
    } finally {
      AbortSignal.timeout = realTimeout;
    }
    seen = [];
  });
});

describe('what goes wrong upstream, said', () => {
  it('names a request that timed out, and one that never connected', async () => {
    const hang = (url, init) =>
      new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    await expect(upstreamGet(hang, 'GDELT', 'https://api.gdeltproject.org/x', {}, 500)).rejects.toThrow('GDELT did not answer within 1 s');
    const down = async () => {
      throw new TypeError('Network connection lost.');
    };
    await expect(upstreamGet(down, 'GDELT', 'https://api.gdeltproject.org/x', {}, 500)).rejects.toThrow('GDELT could not be reached');
  });

  it("passes GDELT's own line of text on, and its status", async () => {
    const clock = makeClock();
    const answers = {
      'tata-cv': () => new Response('Please limit requests to one every 5 seconds or contact kalev for larger queries.', { status: 429 }),
      'tata-plant': () => new Response('Your search contained a keyword that was too short.', { status: 200 }),
      'tata-models': () => new Response('<html><body><h1>502 Bad Gateway</h1></body></html>', { status: 502 }),
      'tata-exports': () => jsonResponse([1, 2, 3]),
    };
    const upstream = makeUpstream({ clock, gdelt: (url, c) => answers[c.topic]() });
    const { res, body } = await call(makeApp({ upstream, clock }), newBase(), ALL);
    expect(res.status).toBe(503);
    expect(body.error).toBe('GDELT answered 429: Please limit requests to one every 5 seconds or contact kalev for larger queries.');
    const again = makeClock();
    const app = makeApp({ upstream: makeUpstream({ clock: again, gdelt: (url, c) => (c.topic === 'tata-cv' ? jsonResponse({}) : answers[c.topic]()) }), clock: again });
    const partial = await call(app, newBase(), ALL);
    expect(partial.res.status).toBe(200);
    expect(partial.body.topics['tata-plant'].error).toBe('GDELT answered: Your search contained a keyword that was too short.');
    expect(partial.body.topics['tata-models'].error).toBe('GDELT answered 502: 502 Bad Gateway');
    expect(partial.body.topics['tata-exports'].error).toBe('GDELT answered something other than an article list');
  });

  it('does not read an answer bigger than either service sends', async () => {
    const clock = makeClock();
    const huge = `{"articles":[{"title":"${'x'.repeat(2 * 1024 * 1024)}","url":"https://a.example.in/1"}]}`;
    const upstream = makeUpstream({ clock, gdelt: () => new Response(huge) });
    const { res, body } = await call(makeApp({ upstream, clock }), newBase(), '/news?topics=tata-cv');
    expect(res.status).toBe(503);
    expect(body.error).toBe('GDELT answered with more than is read');
  });
});

describe('the copy', () => {
  it('serves a second request from the cache, with no request to GDELT', async () => {
    const clock = makeClock();
    const upstream = gdeltFor(clock);
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const first = await call(app, base, ALL);
    expect(upstream.gdeltCalls()).toHaveLength(4);
    clock.advance(10 * MIN);
    const second = await call(app, base, ALL);
    await second.settle();
    expect(second.res.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(upstream.gdeltCalls()).toHaveLength(4);
  });

  it('keeps one copy whatever the order, case, repeats or other parameters of the question', async () => {
    const clock = makeClock();
    const upstream = gdeltFor(clock);
    const app = makeApp({ upstream, clock });
    const base = newBase();
    await call(app, base, ALL);
    for (const path of [
      '/news?models=azura,ULTRA,signa,prima,Prima&topics=tata-exports,tata-models,tata-plant,tata-cv',
      '/news?topics=tata-cv&topics=tata-plant,tata-models,tata-exports&models=Prima%20&models=Signa,Ultra,Azura&_=1760590000',
    ]) {
      const { res } = await call(app, base, path);
      expect(res.status).toBe(200);
    }
    expect(upstream.gdeltCalls()).toHaveLength(4);
    // models sent with topics that do not read them change nothing either
    await call(app, base, '/news?topics=tata-cv');
    await call(app, base, '/news?topics=tata-cv&models=Prima');
    expect(upstream.gdeltCalls()).toHaveLength(5);
    // other models are another question
    await call(app, base, '/news?topics=tata-models&models=Prima');
    expect(upstream.gdeltCalls()).toHaveLength(6);
  });

  it('serves a copy 30 minutes old at once, refreshes it behind the answer, and the next request gets the new one', async () => {
    const clock = makeClock();
    let version = 1;
    let gate = null;
    const upstream = gdeltFor(clock, { version: () => version, hold: () => gate && gate.promise });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const first = await call(app, base, ALL);
    const firstAt = first.body.at;

    clock.advance(29 * MIN);
    const early = await call(app, base, ALL);
    await early.settle();
    expect(upstream.gdeltCalls()).toHaveLength(4); // not due yet

    clock.advance(2 * MIN);
    version = 2;
    gate = deferred();
    const due = await call(app, base, ALL); // GDELT is held open: this answer did not wait for it
    expect(due.res.status).toBe(200);
    expect(due.body.at).toBe(firstAt);
    expect(due.body.topics['tata-cv'].items[0].title).toBe('tata-cv v1 headline 0');
    expect(due.body.stale).toBeUndefined();
    expect(upstream.gdeltCalls()).toHaveLength(5);

    const meanwhile = await call(app, base, ALL); // a second request while the refresh runs starts no other
    expect(meanwhile.body.at).toBe(firstAt);
    expect(upstream.gdeltCalls()).toHaveLength(5);

    gate.resolve();
    await due.settle();
    await meanwhile.settle();
    expect(upstream.gdeltCalls()).toHaveLength(8);

    const next = await call(app, base, ALL);
    expect(next.body.at).not.toBe(firstAt);
    expect(next.body.topics['tata-cv'].items[0].title).toBe('tata-cv v2 headline 0');
    expect(upstream.gdeltCalls()).toHaveLength(8);
  });

  it('serves the last copy with stale: true when GDELT fails, and tries again five minutes on', async () => {
    const clock = makeClock();
    let failing = false;
    const upstream = gdeltFor(clock, { fail: () => (failing ? new Response('busy', { status: 503 }) : null) });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const first = await call(app, base, ALL);

    clock.advance(31 * MIN);
    failing = true;
    const due = await call(app, base, ALL);
    expect(due.body.stale).toBeUndefined(); // served at once, before the refresh failed
    await due.settle();
    expect(upstream.gdeltCalls()).toHaveLength(8);

    const stale = await call(app, base, ALL);
    expect(stale.res.status).toBe(200);
    expect(stale.body.stale).toBe(true);
    expect(stale.body.at).toBe(first.body.at);
    for (const id of TOPIC_IDS) {
      expect(stale.body.topics[id]).toEqual({ ...first.body.topics[id], stale: true, error: 'GDELT answered 503: busy' });
    }
    await stale.settle();
    expect(upstream.gdeltCalls()).toHaveLength(8); // the retry waits five minutes

    clock.advance(5 * MIN);
    failing = false;
    const retry = await call(app, base, ALL);
    expect(retry.body.stale).toBe(true);
    await retry.settle();
    expect(upstream.gdeltCalls()).toHaveLength(12);
    const mended = await call(app, base, ALL);
    expect(mended.body.stale).toBeUndefined();
    expect(mended.body.at).not.toBe(first.body.at);
  });

  it('refreshes the topics that answer and keeps what the others had, marked stale', async () => {
    const clock = makeClock();
    let version = 1;
    let broken = null;
    const upstream = gdeltFor(clock, {
      version: () => version,
      fail: (topic) => (topic === broken ? new Response('', { status: 500 }) : null),
    });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const first = await call(app, base, ALL);
    clock.advance(31 * MIN);
    version = 2;
    broken = 'tata-plant';
    await (await call(app, base, ALL)).settle();
    const after = await call(app, base, ALL);
    expect(after.body.stale).toBe(true);
    expect(after.body.topics['tata-cv'].items[0].title).toBe('tata-cv v2 headline 0');
    expect(after.body.topics['tata-cv'].stale).toBeUndefined();
    expect(after.body.topics['tata-plant']).toEqual({ ...first.body.topics['tata-plant'], stale: true, error: 'GDELT answered 500' });
    await after.settle();
    expect(upstream.gdeltCalls()).toHaveLength(8); // a partial refresh is retried after five minutes, not at once
  });

  it('answers 503 with no copy at all, and does not ask again for five minutes', async () => {
    const clock = makeClock();
    let failing = true;
    const upstream = gdeltFor(clock, { fail: () => (failing ? new Response('down for maintenance', { status: 503 }) : null) });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const first = await call(app, base, ALL);
    expect(first.res.status).toBe(503);
    expect(first.body).toEqual({ error: 'GDELT answered 503: down for maintenance' });
    expect(first.res.headers.get('Cache-Control')).toBe('no-store');
    expect(upstream.gdeltCalls()).toHaveLength(4);

    clock.advance(4 * MIN);
    const second = await call(app, base, ALL);
    expect(second.res.status).toBe(503);
    expect(second.body.error).toBe('GDELT answered 503: down for maintenance');
    expect(upstream.gdeltCalls()).toHaveLength(4);

    clock.advance(2 * MIN);
    failing = false;
    const third = await call(app, base, ALL);
    expect(third.res.status).toBe(200);
    expect(third.body.stale).toBeUndefined();
    expect(upstream.gdeltCalls()).toHaveLength(8);
  });

  it('answers the topics that came, with the one that never did empty and stale', async () => {
    const clock = makeClock();
    const upstream = gdeltFor(clock, { fail: (topic) => (topic === 'tata-exports' ? new Response('', { status: 500 }) : null) });
    const { res, body } = await call(makeApp({ upstream, clock }), newBase(), ALL);
    expect(res.status).toBe(200);
    expect(body.stale).toBe(true);
    expect(body.topics['tata-exports']).toEqual({ at: null, items: [], stale: true, error: 'GDELT answered 500' });
    expect(body.topics['tata-cv'].items).toHaveLength(3);
  });

  it('lets a client that gives up waiting leave the fetch running, so the next request is served', async () => {
    const clock = makeClock();
    const gate = deferred();
    const upstream = gdeltFor(clock, { hold: () => gate.promise });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const { createExecutionContext, waitOnExecutionContext, env } = await import('cloudflare:test');
    const ctx = createExecutionContext();
    const pending = app.fetch(new Request(base + ALL), { ...env }, ctx); // nobody waits for this answer
    gate.resolve();
    await waitOnExecutionContext(ctx); // the fetch was handed to waitUntil
    await pending;
    const later = await call(app, base, ALL);
    expect(later.res.status).toBe(200);
    expect(upstream.gdeltCalls()).toHaveLength(4);
  });
});
