// Fetch real weather data from Open-Meteo archive API for Oulu (65.0121°N, 25.4651°E)
// 1940-2024 in chunks of ~10 years

const fs = require('fs');

const LAT = 65.0121;
const LON = 25.4651;
const CHUNKS = [
  ['1940-01-01', '1949-12-31'],
  ['1950-01-01', '1959-12-31'],
  ['1960-01-01', '1969-12-31'],
  ['1970-01-01', '1979-12-31'],
  ['1980-01-01', '1989-12-31'],
  ['1990-01-01', '1999-12-31'],
  ['2000-01-01', '2009-12-31'],
  ['2010-01-01', '2019-12-31'],
  ['2020-01-01', '2024-12-31'],
];

async function fetchChunk(start, end, retries = 4) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=${start}&end_date=${end}&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum&timezone=Europe%2FHelsinki`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`Fetching ${start} to ${end} (attempt ${attempt + 1})...`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log(`  Got ${data.daily.time.length} days`);
      return data.daily;
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      if (attempt < retries) {
        const wait = Math.pow(2, attempt + 1) * 1000;
        console.log(`  Retrying in ${wait/1000}s...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  const allDays = [];

  for (const [start, end] of CHUNKS) {
    const daily = await fetchChunk(start, end);
    for (let i = 0; i < daily.time.length; i++) {
      allDays.push({
        date: daily.time[i],
        mean: daily.temperature_2m_mean[i],
        max: daily.temperature_2m_max[i],
        min: daily.temperature_2m_min[i],
        precip: daily.precipitation_sum[i],
        snow: daily.snowfall_sum[i],
      });
    }
  }

  console.log(`\nTotal days fetched: ${allDays.length}`);

  // Build DAILY object
  const DAILY = {};
  for (const day of allDays) {
    const [y, m, d] = day.date.split('-').map(Number);
    if (!DAILY[y]) DAILY[y] = {};
    if (!DAILY[y][m]) DAILY[y][m] = { days: [], max: [], min: [], precip: [], snow: [], dim: 0 };
    DAILY[y][m].days.push(day.mean != null ? +day.mean.toFixed(1) : null);
    DAILY[y][m].max.push(day.max != null ? +day.max.toFixed(1) : null);
    DAILY[y][m].min.push(day.min != null ? +day.min.toFixed(1) : null);
    DAILY[y][m].precip.push(day.precip != null ? +day.precip.toFixed(1) : null);
    DAILY[y][m].snow.push(day.snow != null ? +day.snow.toFixed(1) : null);
    DAILY[y][m].dim = DAILY[y][m].days.length;
  }

  // Build YR array
  const MONTHS_FI = ["Tammi","Helmi","Maalis","Huhti","Touko","Kesä","Heinä","Elo","Syys","Loka","Marras","Joulu"];
  const YR = [];
  for (let y = 1940; y <= 2024; y++) {
    if (!DAILY[y]) continue;
    let tempSum = 0, tempCount = 0, precipSum = 0, snowSum = 0;
    for (let m = 1; m <= 12; m++) {
      if (!DAILY[y][m]) continue;
      for (let i = 0; i < DAILY[y][m].days.length; i++) {
        if (DAILY[y][m].days[i] != null) { tempSum += DAILY[y][m].days[i]; tempCount++; }
        if (DAILY[y][m].precip[i] != null) precipSum += DAILY[y][m].precip[i];
        if (DAILY[y][m].snow[i] != null) snowSum += DAILY[y][m].snow[i];
      }
    }
    YR.push({
      year: y,
      temp: tempCount ? +(tempSum / tempCount).toFixed(1) : null,
      precip: +precipSum.toFixed(0),
      snow: +snowSum.toFixed(0)
    });
  }

  // Build MO array
  const MO = [];
  for (let y = 1940; y <= 2024; y++) {
    if (!DAILY[y]) continue;
    for (let m = 1; m <= 12; m++) {
      if (!DAILY[y][m]) continue;
      const md = DAILY[y][m];
      const validTemps = md.days.filter(t => t != null);
      const temp = validTemps.length ? +(validTemps.reduce((a, b) => a + b, 0) / validTemps.length).toFixed(1) : null;
      const precip = +(md.precip.filter(p => p != null).reduce((a, b) => a + b, 0)).toFixed(1);
      const snow = +(md.snow.filter(s => s != null).reduce((a, b) => a + b, 0)).toFixed(1);
      MO.push({
        label: `${MONTHS_FI[m-1]} ${y}`,
        short: `${m}/${String(y).slice(2)}`,
        year: y,
        month: m,
        temp,
        precip,
        snow
      });
    }
  }

  // Build NORMALS
  const NORMALS = [];
  for (let m = 1; m <= 12; m++) {
    const temps = [], maxes = [], mins = [], precips = [], snows = [];
    for (let y = 1940; y <= 2024; y++) {
      if (!DAILY[y] || !DAILY[y][m]) continue;
      const md = DAILY[y][m];
      const validT = md.days.filter(t => t != null);
      const validMax = md.max.filter(t => t != null);
      const validMin = md.min.filter(t => t != null);
      if (validT.length) temps.push(validT.reduce((a, b) => a + b, 0) / validT.length);
      if (validMax.length) maxes.push(validMax.reduce((a, b) => a + b, 0) / validMax.length);
      if (validMin.length) mins.push(validMin.reduce((a, b) => a + b, 0) / validMin.length);
      precips.push(md.precip.filter(p => p != null).reduce((a, b) => a + b, 0));
      snows.push(md.snow.filter(s => s != null).reduce((a, b) => a + b, 0));
    }
    NORMALS.push({
      m: MONTHS_FI[m-1],
      t: temps.length ? +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : 0,
      hi: maxes.length ? +(maxes.reduce((a, b) => a + b, 0) / maxes.length).toFixed(1) : 0,
      lo: mins.length ? +(mins.reduce((a, b) => a + b, 0) / mins.length).toFixed(1) : 0,
      p: precips.length ? +(precips.reduce((a, b) => a + b, 0) / precips.length).toFixed(0) : 0,
      s: snows.length ? +(snows.reduce((a, b) => a + b, 0) / snows.length).toFixed(0) : 0,
    });
  }

  // Compact DAILY for embedding (only mean temps + max/min for records)
  const DAILY_COMPACT = {};
  for (const y of Object.keys(DAILY)) {
    DAILY_COMPACT[y] = {};
    for (const m of Object.keys(DAILY[y])) {
      DAILY_COMPACT[y][m] = {
        days: DAILY[y][m].days,
        max: DAILY[y][m].max,
        min: DAILY[y][m].min,
        dim: DAILY[y][m].dim
      };
    }
  }

  const output = { YR, MO, NORMALS, DAILY: DAILY_COMPACT };

  fs.writeFileSync('/home/user/oulusaa/weather_data.json', JSON.stringify(output));
  console.log('\nData written to weather_data.json');
  console.log(`YR: ${YR.length} years`);
  console.log(`MO: ${MO.length} months`);
  console.log(`NORMALS: ${NORMALS.length} months`);
  console.log(`DAILY: ${Object.keys(DAILY_COMPACT).length} years`);

  const yr2024 = YR.find(y => y.year === 2024);
  console.log(`\n2024: temp=${yr2024?.temp}°C, precip=${yr2024?.precip}mm, snow=${yr2024?.snow}cm`);
  const yr1940 = YR.find(y => y.year === 1940);
  console.log(`1940: temp=${yr1940?.temp}°C, precip=${yr1940?.precip}mm, snow=${yr1940?.snow}cm`);
  console.log(`\nNormals:`, NORMALS.map(n => `${n.m}:${n.t}°`).join(', '));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
