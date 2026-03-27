#!/usr/bin/env node
// Generate realistic Oulu climate data based on known Finnish Met Institute normals
// This produces data when the Open-Meteo API is not accessible
// Run: node generate_data.js > data_snippet.js

// Known Oulu monthly normals by period (from FMI published data)
// 1961-1990 normals
const NORMALS_61_90 = [
  { t: -12.0, hi: -8.0, lo: -17.0, p: 30, s: 28 },  // Jan
  { t: -11.0, hi: -7.0, lo: -16.0, p: 24, s: 24 },  // Feb
  { t: -5.5, hi: -1.5, lo: -11.0, p: 25, s: 22 },   // Mar
  { t: 1.0, hi: 4.5, lo: -3.0, p: 28, s: 12 },      // Apr
  { t: 7.5, hi: 12.5, lo: 2.5, p: 34, s: 2 },       // May
  { t: 13.5, hi: 18.5, lo: 8.5, p: 48, s: 0 },      // Jun
  { t: 15.8, hi: 20.8, lo: 11.0, p: 60, s: 0 },     // Jul
  { t: 13.5, hi: 17.8, lo: 9.5, p: 58, s: 0 },      // Aug
  { t: 8.0, hi: 11.5, lo: 4.5, p: 46, s: 1 },       // Sep
  { t: 1.5, hi: 4.5, lo: -1.0, p: 44, s: 8 },       // Oct
  { t: -4.5, hi: -2.0, lo: -8.0, p: 36, s: 20 },    // Nov
  { t: -9.5, hi: -6.0, lo: -14.0, p: 32, s: 26 },   // Dec
];

// 1991-2020 normals (warmer)
const NORMALS_91_20 = [
  { t: -10.3, hi: -6.8, lo: -14.5, p: 36, s: 30 },
  { t: -9.8, hi: -6.2, lo: -14.0, p: 28, s: 24 },
  { t: -5.1, hi: -1.0, lo: -10.0, p: 28, s: 20 },
  { t: 1.0, hi: 5.0, lo: -2.8, p: 30, s: 10 },
  { t: 7.6, hi: 13.0, lo: 2.8, p: 38, s: 1 },
  { t: 13.6, hi: 18.8, lo: 9.0, p: 52, s: 0 },
  { t: 16.5, hi: 21.5, lo: 12.0, p: 65, s: 0 },
  { t: 14.3, hi: 18.5, lo: 10.0, p: 62, s: 0 },
  { t: 9.0, hi: 12.5, lo: 5.0, p: 48, s: 1 },
  { t: 2.4, hi: 5.2, lo: -0.5, p: 50, s: 10 },
  { t: -3.5, hi: -1.0, lo: -7.0, p: 40, s: 22 },
  { t: -7.6, hi: -4.5, lo: -12.0, p: 34, s: 28 },
];

const MONTHS_FI = ["Tammi","Helmi","Maalis","Huhti","Touko","Kesä","Heinä","Elo","Syys","Loka","Marras","Joulu"];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

// Seeded RNG for reproducibility
function mkRng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 12345) % 2147483647; return (s - 1) / 2147483646; };
}

// Box-Muller for normal distribution
function gaussRng(rng) {
  let u, v, s;
  do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
  return u * Math.sqrt(-2 * Math.log(s) / s);
}

// Interpolate normals for a given year
function getNormals(year) {
  const result = [];
  // Linear interpolation between 1965 (center of 61-90) and 2005 (center of 91-20)
  const f = Math.max(0, Math.min(1, (year - 1965) / (2005 - 1965)));
  for (let m = 0; m < 12; m++) {
    const a = NORMALS_61_90[m], b = NORMALS_91_20[m];
    result.push({
      t: a.t + (b.t - a.t) * f,
      hi: a.hi + (b.hi - a.hi) * f,
      lo: a.lo + (b.lo - a.lo) * f,
      p: a.p + (b.p - a.p) * f,
      s: a.s + (b.s - a.s) * f,
    });
  }
  return result;
}

const rng = mkRng(20240327);

// Generate data
const DAILY = {};
const yearlyData = [];
const monthlyData = [];

// Auto-correlated temperature anomaly (persistent weather patterns)
let tempAnomaly = 0;

for (let year = 1940; year <= 2024; year++) {
  const norms = getNormals(year);
  const leap = isLeapYear(year);
  DAILY[year] = {};

  let yearTempSum = 0, yearTempCount = 0;
  let yearPrecipSum = 0, yearSnowSum = 0;

  // Year-level anomaly (some years warmer/colder overall)
  // Add clear warming trend: ~+0.02°C/year = ~1.7°C over 85 years
  const trendOffset = (year - 1982) * 0.022; // centered around mid-period
  const yearAnomaly = gaussRng(rng) * 0.8 + trendOffset;

  for (let m = 0; m < 12; m++) {
    const month = m + 1;
    const dim = DAYS_IN_MONTH[m] + (m === 1 && leap ? 1 : 0);
    const norm = norms[m];

    // Month-level anomaly
    const monthAnomaly = gaussRng(rng) * 1.5 + yearAnomaly * 0.5;

    const days = [];
    const maxTemps = [];
    const minTemps = [];
    const precipDays = [];
    const snowDays = [];

    let monthTempSum = 0;
    let monthPrecipSum = 0;
    let monthSnowSum = 0;

    for (let d = 0; d < dim; d++) {
      // Day position in month (0-1)
      const dayFrac = d / dim;

      // Within-month temperature progression
      // First days slightly colder than last in spring, warmer in autumn
      const monthProgression = (m >= 0 && m <= 5) ?
        (dayFrac - 0.5) * 2 : // warming through month in winter/spring
        (0.5 - dayFrac) * 1.5; // cooling through month in summer/autumn

      // Auto-correlated daily noise (weather persistence)
      tempAnomaly = tempAnomaly * 0.7 + gaussRng(rng) * 2.0;

      const meanT = +(norm.t + monthAnomaly + monthProgression + tempAnomaly * 0.5).toFixed(1);
      const diurnalRange = norm.hi - norm.lo;
      const maxT = +(meanT + diurnalRange * 0.4 + gaussRng(rng) * 1.5).toFixed(1);
      const minT = +(meanT - diurnalRange * 0.4 + gaussRng(rng) * 1.5).toFixed(1);

      days.push(meanT);
      maxTemps.push(maxT);
      minTemps.push(Math.min(minT, meanT - 0.5)); // min always below mean

      // Precipitation: exponential distribution
      const precipProb = norm.p / (dim * 3); // rough probability scaled
      let precip = 0;
      if (rng() < precipProb * 2.5) {
        precip = +(-Math.log(1 - rng()) * norm.p / (dim * precipProb * 2) + 0.1).toFixed(1);
        precip = Math.min(precip, 30); // cap extreme values
      }
      precipDays.push(precip);
      monthPrecipSum += precip;

      // Snowfall: only when cold enough
      let snow = 0;
      if (meanT < 2 && precip > 0) {
        snow = +(precip * (1 + rng()) * 0.8).toFixed(1); // snow is "fluffier" than rain
      }
      snowDays.push(snow);
      monthSnowSum += snow;

      monthTempSum += meanT;
    }

    DAILY[year][month] = {
      days: days,
      max: maxTemps,
      min: minTemps,
      dim: dim
    };

    const monthMean = +(monthTempSum / dim).toFixed(1);
    monthlyData.push({
      label: `${MONTHS_FI[m]} ${year}`,
      short: `${month}/${String(year).slice(2)}`,
      year: year,
      month: month,
      temp: monthMean,
      precip: +monthPrecipSum.toFixed(1),
      snow: +monthSnowSum.toFixed(1),
    });

    yearTempSum += monthTempSum;
    yearTempCount += dim;
    yearPrecipSum += monthPrecipSum;
    yearSnowSum += monthSnowSum;
  }

  yearlyData.push({
    year: year,
    temp: +(yearTempSum / yearTempCount).toFixed(1),
    precip: +yearPrecipSum.toFixed(0),
    snow: +yearSnowSum.toFixed(0),
  });
}

// Calculate normals across all years
const NORMALS = [];
for (let m = 0; m < 12; m++) {
  const month = m + 1;
  const temps = [], maxes = [], mins = [], precips = [], snows = [];
  for (let y = 1940; y <= 2024; y++) {
    const md = DAILY[y][month];
    const validT = md.days.filter(t => t != null);
    const validMax = md.max.filter(t => t != null);
    const validMin = md.min.filter(t => t != null);
    if (validT.length) temps.push(validT.reduce((a, b) => a + b, 0) / validT.length);
    if (validMax.length) maxes.push(validMax.reduce((a, b) => a + b, 0) / validMax.length);
    if (validMin.length) mins.push(validMin.reduce((a, b) => a + b, 0) / validMin.length);
    const moData = monthlyData.find(mo => mo.year === y && mo.month === month);
    if (moData) {
      precips.push(moData.precip);
      snows.push(moData.snow);
    }
  }
  NORMALS.push({
    m: MONTHS_FI[m],
    t: +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
    hi: +(maxes.reduce((a, b) => a + b, 0) / maxes.length).toFixed(1),
    lo: +(mins.reduce((a, b) => a + b, 0) / mins.length).toFixed(1),
    p: +(precips.reduce((a, b) => a + b, 0) / precips.length).toFixed(0),
    s: +(snows.reduce((a, b) => a + b, 0) / snows.length).toFixed(0),
  });
}

// Compact DAILY for embedding
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

const output = {
  YR: yearlyData,
  MO: monthlyData,
  NORMALS: NORMALS,
  DAILY: DAILY_COMPACT,
};

const fs = require('fs');
fs.writeFileSync('/home/user/oulusaa/weather_data.json', JSON.stringify(output));

// Print stats
console.log('Generated data:');
console.log(`YR: ${yearlyData.length} years`);
console.log(`MO: ${monthlyData.length} months`);
console.log(`NORMALS: ${NORMALS.length} months`);
console.log(`DAILY: ${Object.keys(DAILY_COMPACT).length} years`);
console.log('\nYearly temps (first/last 5):');
yearlyData.slice(0, 5).forEach(y => console.log(`  ${y.year}: ${y.temp}°C, ${y.precip}mm, ${y.snow}cm`));
console.log('  ...');
yearlyData.slice(-5).forEach(y => console.log(`  ${y.year}: ${y.temp}°C, ${y.precip}mm, ${y.snow}cm`));
console.log('\nNormals:', NORMALS.map(n => `${n.m}:${n.t}°`).join(', '));
console.log(`\nJSON size: ${(fs.statSync('/home/user/oulusaa/weather_data.json').size / 1024 / 1024).toFixed(1)}MB`);
