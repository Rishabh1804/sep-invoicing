// A forecast in the shape of MET Norway's Locationforecast 2.0 compact answer, made up for
// Adityapur in October: hourly steps for at least 60 hours from `from`, up to the next 6-hour
// mark, then a step every 6 hours (at 00, 06, 12 and 18 UTC) to about 9.5 days ahead, the last
// with only its instant: about 90 steps. Temperatures follow a day's curve: 22 °C before dawn,
// 32 °C mid-afternoon, India time.

const H = 3600000;
const IST = 330 * 60000;

export const isoZ = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');

export function tempAt(ms) {
  const hIst = ((ms + IST) % (24 * H)) / H;
  return Math.round((27 + 5 * Math.sin((2 * Math.PI * (hIst - 8.5)) / 24)) * 10) / 10;
}

const daySym = (ms, word) => {
  const hIst = ((ms + IST) % (24 * H)) / H;
  return `${word}_${hIst >= 6 && hIst < 18 ? 'day' : 'night'}`;
};

// `thunder`: ISO hours whose hour (or 6-hour step) is a thunder shower; `rain`: ISO hour → mm.
export function metCompact({
  from = '2026-10-16T04:00:00Z',
  hourly = 60,
  days = 9.5,
  updated = '2026-10-16T03:41:12Z',
  thunder = [],
  rain = {},
} = {}) {
  const start = Date.parse(from);
  const times = [];
  const sixHourly = Math.ceil((start + hourly * H) / (6 * H)) * 6 * H;
  for (let t = start; t < sixHourly; t += H) times.push(t);
  const hourlySteps = times.length;
  const end = start + days * 24 * H;
  for (let t = sixHourly; t <= end; t += 6 * H) times.push(t);
  const thunderSet = new Set(thunder.map((s) => Date.parse(s)));
  const rainAt = new Map(Object.entries(rain).map(([k, v]) => [Date.parse(k), v]));

  const timeseries = times.map((ms, idx) => {
    const isHourly = idx < hourlySteps;
    const isLast = idx === times.length - 1;
    const instant = {
      details: {
        air_pressure_at_sea_level: Math.round((1009 + 3 * Math.cos(idx / 7)) * 10) / 10,
        air_temperature: tempAt(ms),
        cloud_area_fraction: Math.round((40 + 30 * Math.sin(idx / 5)) * 10) / 10,
        relative_humidity: Math.round((68 + 18 * Math.cos(idx / 6)) * 10) / 10,
        wind_from_direction: Math.round((140 + 40 * Math.sin(idx / 4)) * 10) / 10,
        wind_speed: Math.round((1.8 + Math.abs(Math.sin(idx / 3))) * 10) / 10,
      },
    };
    if (isLast) return { time: isoZ(ms), data: { instant } };
    const wet = thunderSet.has(ms) ? 'rainshowersandthunder' : rainAt.has(ms) ? 'lightrain' : 'partlycloudy';
    // A period's _day or _night is the sun's over its middle.
    const data = {
      instant,
      next_12_hours: { summary: { symbol_code: daySym(ms + 6 * H, 'partlycloudy') }, details: {} },
      next_6_hours: {
        summary: { symbol_code: daySym(ms + 3 * H, isHourly ? 'partlycloudy' : wet) },
        details: {
          air_temperature_max: Math.max(tempAt(ms), tempAt(ms + 3 * H), tempAt(ms + 6 * H)),
          air_temperature_min: Math.min(tempAt(ms), tempAt(ms + 3 * H), tempAt(ms + 6 * H)),
          precipitation_amount: isHourly ? 0 : (rainAt.get(ms) ?? 0),
        },
      },
    };
    if (isHourly) {
      data.next_1_hours = {
        summary: { symbol_code: daySym(ms + H / 2, wet) },
        details: { precipitation_amount: rainAt.get(ms) ?? 0 },
      };
    }
    return { time: isoZ(ms), data };
  });

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [86.15, 22.79, 140] },
    properties: {
      meta: {
        updated_at: updated,
        units: {
          air_pressure_at_sea_level: 'hPa',
          air_temperature: 'celsius',
          cloud_area_fraction: '%',
          precipitation_amount: 'mm',
          relative_humidity: '%',
          wind_from_direction: 'degrees',
          wind_speed: 'm/s',
        },
      },
      timeseries,
    },
  };
}

// One hand-made step, for the tests that need exact figures.
export function step(timeIso, { temp, p1, p6, p12 } = {}) {
  const data = {};
  if (temp !== undefined) data.instant = { details: { air_temperature: temp } };
  const period = (p) => ({
    summary: p.sym ? { symbol_code: p.sym } : {},
    details: {
      ...(p.rain !== undefined ? { precipitation_amount: p.rain } : {}),
      ...(p.tmax !== undefined ? { air_temperature_max: p.tmax } : {}),
      ...(p.tmin !== undefined ? { air_temperature_min: p.tmin } : {}),
      ...(p.pp !== undefined ? { probability_of_precipitation: p.pp } : {}),
      ...(p.pt !== undefined ? { probability_of_thunder: p.pt } : {}),
    },
  });
  if (p1) data.next_1_hours = period(p1);
  if (p6) data.next_6_hours = period(p6);
  if (p12) data.next_12_hours = period(p12);
  return { time: timeIso, data };
}

export const forecast = (timeseries, updated = '2026-10-16T03:41:12Z') => ({
  type: 'Feature',
  properties: { meta: { updated_at: updated }, timeseries },
});
