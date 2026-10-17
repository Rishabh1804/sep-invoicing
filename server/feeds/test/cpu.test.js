// What a request costs the Worker in CPU (docs/UI_PASS_3.md §9a: "U2 measures it in the Worker's
// tests"). The free plan allows 10 ms of CPU a request; waiting on GDELT, MET Norway or the cache
// is not CPU and is not counted. Measured here is all the work the Worker does itself: reading
// GDELT's four answers and keeping the copy (a news refresh), reading MET's forecast and keeping it
// (a weather refresh), and serving each copy. Each is timed on its first call, before anything
// has warmed it (an isolate the runtime has just started), and as the mean of 300 calls after.
import { it, expect } from 'vitest';
import { NEWS_CREDIT, normaliseArticles, parseLooseJson } from '../src/news.js';
import { WEATHER_CREDIT, readForecast, weatherAnswer } from '../src/weather.js';
import { gdeltAnswer } from './fixtures/gdelt.js';
import { metCompact } from './fixtures/met.js';

const LIMIT_MS = 10; // the free plan's CPU a request
const WELL_UNDER_MS = 5; // "well under" is held to half of it
const RUNS = 300;
const NOW = Date.parse('2026-10-16T04:10:00Z');
const TOPICS = ['tata-cv', 'tata-plant', 'tata-models', 'tata-exports'];

// The smallest step the clock takes here: the Workers runtime coarsens it.
function clockStep() {
  let best = Infinity;
  for (let k = 0; k < 5; k++) {
    const a = performance.now();
    let b = a;
    for (let spin = 0; b === a && spin < 1e8; spin++) b = performance.now();
    best = Math.min(best, b - a);
  }
  return best;
}

function measure(fn) {
  const t0 = performance.now();
  fn();
  const first = performance.now() - t0;
  for (let k = 0; k < 20; k++) fn();
  const t1 = performance.now();
  for (let k = 0; k < RUNS; k++) fn();
  return { first, each: (performance.now() - t1) / RUNS };
}

it('reads, keeps and serves each feed well under the 10 ms a request allows', () => {
  const gdeltTexts = TOPICS.map((topic) => JSON.stringify(gdeltAnswer(25, { topic })));
  const metText = JSON.stringify(metCompact());
  const at = new Date(NOW).toISOString();

  // A news refresh: GDELT's four answers read, the copy written as the cache keeps it.
  const newsRefresh = () => {
    const topics = {};
    TOPICS.forEach((id, k) => {
      topics[id] = { at, items: normaliseArticles(parseLooseJson(gdeltTexts[k])) };
    });
    return JSON.stringify({ v: 1, due: NOW + 1800000, data: { at, topics } });
  };
  const newsRefreshT = measure(newsRefresh);
  const newsCopy = newsRefresh();
  expect(Object.values(JSON.parse(newsCopy).data.topics).every((t) => t.items.length === 25)).toBe(true);

  // A news request served from the copy.
  const newsServeT = measure(() => {
    const rec = JSON.parse(newsCopy);
    return JSON.stringify({ at: rec.data.at, topics: rec.data.topics, credit: NEWS_CREDIT });
  });

  // A weather refresh: MET's compact forecast read, the copy written.
  const weatherRefresh = () => {
    const f = readForecast(JSON.parse(metText));
    return JSON.stringify({ v: 1, due: NOW + 1800000, lastModified: null, data: { at, updated: f.updated, series: f.series } });
  };
  const weatherRefreshT = measure(weatherRefresh);
  const weatherCopy = weatherRefresh();

  // A weather request served from the copy: 48 hours and 7 days cut from it.
  const weatherServeT = measure(() => {
    const rec = JSON.parse(weatherCopy);
    const body = { at: rec.data.at, updated: rec.data.updated, lat: 22.79, lon: 86.15, ...weatherAnswer(rec.data, NOW), credit: WEATHER_CREDIT };
    return JSON.stringify(body);
  });
  const served = weatherAnswer(JSON.parse(weatherCopy).data, NOW);
  expect([served.hours.length, served.days.length]).toEqual([48, 7]);

  const kb = (s) => `${(s.length / 1024).toFixed(1)} KB`;
  const rows = [
    ['news refresh', `4 topics x 25 articles, ${kb(gdeltTexts.join(''))} of GDELT JSON`, newsRefreshT],
    ['news served from the copy', kb(newsCopy), newsServeT],
    ['weather refresh', `${JSON.parse(metText).properties.timeseries.length} steps, ${kb(metText)} of MET JSON`, weatherRefreshT],
    ['weather served from the copy', `48 hours and 7 days from ${kb(weatherCopy)}`, weatherServeT],
  ];
  const step = clockStep();
  console.log(
    [
      `CPU in workerd (clock step ${step} ms; mean of ${RUNS} warm runs, then the first call):`,
      ...rows.map(([what, of, t]) => `  ${what} (${of}): ${t.each.toFixed(3)} ms; first call ${t.first.toFixed(0)} ms`),
    ].join('\n'),
  );
  for (const [what, , t] of rows) {
    expect(t.each, what).toBeLessThan(WELL_UNDER_MS);
    expect(t.first, `${what}, first call`).toBeLessThan(LIMIT_MS);
  }
});
