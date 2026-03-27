#!/usr/bin/env node
// Build index.html with embedded weather data
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/home/user/oulusaa/weather_data.json', 'utf8'));

// Compact data formats
const YR = data.YR.map(y => [y.year, y.temp, y.precip, y.snow]);
const MO = data.MO.map(m => [m.year, m.month, m.temp, m.precip, m.snow]);
const NORMALS = data.NORMALS;

// Daily data as comma-separated integer strings (temp * 10)
const DAILY_STR = {};
for (const y of Object.keys(data.DAILY)) {
  const allDays = [];
  for (let m = 1; m <= 12; m++) {
    if (data.DAILY[y][m]) {
      allDays.push(...data.DAILY[y][m].days.map(t => t != null ? Math.round(t * 10) : ''));
    }
  }
  DAILY_STR[y] = allDays.join(',');
}

// Also store max/min per day for record calculations
const DAILY_MAX_STR = {};
const DAILY_MIN_STR = {};
for (const y of Object.keys(data.DAILY)) {
  const allMax = [], allMin = [];
  for (let m = 1; m <= 12; m++) {
    if (data.DAILY[y][m]) {
      allMax.push(...data.DAILY[y][m].max.map(t => t != null ? Math.round(t * 10) : ''));
      allMin.push(...data.DAILY[y][m].min.map(t => t != null ? Math.round(t * 10) : ''));
    }
  }
  DAILY_MAX_STR[y] = allMax.join(',');
  DAILY_MIN_STR[y] = allMin.join(',');
}

const dataBlock = `
// ═══ EMBEDDED WEATHER DATA (generated from climate records) ═══
// To update with real Open-Meteo API data, run: node fetch_data.js && node build.js
const MONTHS_FI=["Tammi","Helmi","Maalis","Huhti","Touko","Kesä","Heinä","Elo","Syys","Loka","Marras","Joulu"];
const NORMALS=${JSON.stringify(NORMALS)};
const YR=${JSON.stringify(YR)}.map(([y,t,p,s])=>({year:y,temp:t,precip:p,snow:s}));
const MO=${JSON.stringify(MO)}.map(([y,m,t,p,s])=>({label:MONTHS_FI[m-1]+' '+y,short:m+'/'+String(y).slice(2),year:y,month:m,temp:t,precip:p,snow:s}));

// Daily data: decode from compact integer strings
const DAYS_IN_MONTH=[31,29,31,30,31,30,31,31,30,31,30,31];
const _DS=${JSON.stringify(DAILY_STR)};
const _DX=${JSON.stringify(DAILY_MAX_STR)};
const _DN=${JSON.stringify(DAILY_MIN_STR)};
function _decodeDailyStr(str){return str.split(',').map(v=>v===''?null:+v/10);}
const DAILY={};
Object.keys(_DS).forEach(y=>{
  const vals=_decodeDailyStr(_DS[y]);
  const maxV=_decodeDailyStr(_DX[y]);
  const minV=_decodeDailyStr(_DN[y]);
  const yr=+y;const leap=(yr%4===0&&yr%100!==0)||yr%400===0;
  DAILY[yr]={};let idx=0;
  for(let m=1;m<=12;m++){
    const dim=DAYS_IN_MONTH[m-1]-(m===2&&!leap?1:0);
    DAILY[yr][m]={days:vals.slice(idx,idx+dim),max:maxV.slice(idx,idx+dim),min:minV.slice(idx,idx+dim),dim:dim};
    idx+=dim;
  }
});
`;

console.log('Data block size:', (dataBlock.length / 1024).toFixed(0), 'KB');
fs.writeFileSync('/home/user/oulusaa/data_block.js', dataBlock);
console.log('Written to data_block.js');
