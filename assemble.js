#!/usr/bin/env node
// Assemble the new index.html from parts + data + new features
const fs = require('fs');

const htmlBefore = fs.readFileSync('/tmp/part_before.html', 'utf8');
const jsAfterData = fs.readFileSync('/tmp/part_js_after_data.js', 'utf8');
const dataBlock = fs.readFileSync('/home/user/oulusaa/data_block.js', 'utf8');

// Add new CSS classes before </style>
const newCSS = `
  .hourly-chart-wrap{position:relative;height:250px;margin-top:16px}
  .record-live-box{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
  .record-live-card{flex:1;min-width:130px;background:rgba(15,23,42,0.5);border:1px solid rgba(148,163,184,0.06);border-radius:14px;padding:16px 18px;text-align:center}
  .record-live-card .rv{font-size:22px;font-weight:800;line-height:1}
  .record-live-card .rl{font-size:10px;color:#64748b;margin-top:4px}
  .rain-tracker{margin-top:20px;padding:20px;background:rgba(15,23,42,0.5);border:1px solid rgba(148,163,184,0.06);border-radius:18px}
  .rain-bar-wrap{height:24px;background:rgba(148,163,184,0.08);border-radius:12px;overflow:hidden;margin-top:12px;position:relative}
  .rain-bar{height:100%;border-radius:12px;transition:width 0.5s}
  .rain-bar-label{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;color:#94a3b8;font-weight:600}
`;

const htmlBeforeWithCSS = htmlBefore.replace('</style>', newCSS + '</style>');

// Modify hero stats to be dynamic (replace hardcoded values with placeholders)
const heroModified = htmlBeforeWithCSS
  .replace(
    '<div class="hero-stat"><div class="val" style="color:#fb923c">+2.9°</div><div class="lbl">Vuoden 2024 keskilämpö</div></div>',
    '<div class="hero-stat"><div class="val" style="color:#fb923c" id="heroTemp">–</div><div class="lbl">Vuoden 2024 keskilämpö</div></div>'
  )
  .replace(
    '<div class="hero-stat"><div class="val" style="color:#34d399">482mm</div><div class="lbl">Sademäärä 2024</div></div>',
    '<div class="hero-stat"><div class="val" style="color:#34d399" id="heroPrecip">–</div><div class="lbl">Sademäärä 2024</div></div>'
  )
  .replace(
    '<div class="hero-stat"><div class="val" style="color:#818cf8">-38.2°</div><div class="lbl">Ennätysalin (tammikuu)</div></div>',
    '<div class="hero-stat"><div class="val" style="color:#818cf8" id="heroRecordLo">–</div><div class="lbl">Ennätysalin</div></div>'
  )
  .replace(
    '<div class="hero-stat"><div class="val" style="color:#f43f5e">+2.1°</div><div class="lbl">Lämpeneminen 85v aikana</div></div>',
    '<div class="hero-stat"><div class="val" style="color:#f43f5e" id="heroWarming">–</div><div class="lbl">Lämpeneminen 85v aikana</div></div>'
  );

// Computed data section: DEC, SEASONS, hero stats
const computedData = `
const DEC=(()=>{const b={};YR.forEach(y=>{const d=Math.floor(y.year/10)*10;if(!b[d])b[d]={t:[],p:[]};b[d].t.push(y.temp);b[d].p.push(y.precip);});return Object.keys(b).sort().map(d=>({decade:+d,temp:+(b[d].t.reduce((a,b)=>a+b,0)/b[d].t.length).toFixed(1),precip:+(b[d].p.reduce((a,b)=>a+b,0)/b[d].p.length).toFixed(0)}));})();

const SEASONS=(()=>{const sm={12:0,1:0,2:0,3:1,4:1,5:1,6:2,7:2,8:2,9:3,10:3,11:3};const names=["Talvi","Kevät","Kesä","Syksy"];const b=[[],[],[],[]];MO.forEach(m=>{b[sm[m.month]].push(m);});return b.map((arr,i)=>({season:names[i],temp:+(arr.reduce((a,m)=>a+m.temp,0)/arr.length).toFixed(1),precip:+(arr.reduce((a,m)=>a+m.precip,0)/arr.length).toFixed(0)}));})();

// Dynamic hero stats
(function(){
  const yr24=YR.find(y=>y.year===2024);
  if(yr24){
    document.getElementById('heroTemp').textContent=(yr24.temp>0?'+':'')+yr24.temp+'°';
    document.getElementById('heroPrecip').textContent=yr24.precip+'mm';
  }
  // Record low
  let recLo=999,recLoMonth='';
  Object.keys(DAILY).forEach(y=>{for(let m=1;m<=12;m++){if(DAILY[y]&&DAILY[y][m]){DAILY[y][m].days.forEach(t=>{if(t!=null&&t<recLo){recLo=t;recLoMonth=MONTHS_FI[m-1];}})}}});
  document.getElementById('heroRecordLo').textContent=recLo.toFixed(1)+'°';
  document.getElementById('heroRecordLo').closest('.hero-stat').querySelector('.lbl').textContent='Ennätysalin ('+recLoMonth.toLowerCase()+')';
  // Warming
  const first10=YR.filter(y=>y.year>=1940&&y.year<=1949);
  const last10=YR.filter(y=>y.year>=2015&&y.year<=2024);
  const f10avg=first10.reduce((a,y)=>a+y.temp,0)/first10.length;
  const l10avg=last10.reduce((a,y)=>a+y.temp,0)/last10.length;
  const warming=(l10avg-f10avg).toFixed(1);
  document.getElementById('heroWarming').textContent='+'+warming+'°';
})();
`;

// New live weather features to inject into the renderLiveWeather function
// We need to modify the live weather section to add:
// 1. Hourly chart
// 2. Record temps for today
// 3. Cumulative rainfall

// Find and replace the renderLiveWeather function
let jsModified = jsAfterData;

// Replace the renderLiveWeather function's HTML template to add new features
// Find the end of the forecast vs history chart section and add new features before the closing backtick
const oldLiveEnd = `<div style="margin-top:20px;padding:16px 20px;background:rgba(15,23,42,0.4);border:1px solid rgba(148,163,184,0.04);border-radius:14px;display:flex;flex-wrap:wrap;gap:20px;align-items:center">
      <div style="font-size:12px;color:#475569;flex:1;min-width:200px">
        <strong style="color:#94a3b8">Historiallinen vertailu:</strong> Päivän \${curDay}.\${curMonthNum}. keskiarvo 1940–2024 on <strong style="color:\${dayAvg>=0?'#fb923c':'#38bdf8'}">\${dayAvg>0?'+':''}\${dayAvg}°C</strong> (\${monthName}: \${norm.t>0?'+':''}\${norm.t}°C).
        Nyt on <span class="live-diff \${diffClass}" style="display:inline;padding:2px 8px;font-size:12px">\${diffSign}\${diff}°</span> päivän normaalista.
      </div>
    </div>\`;`;

const newLiveEnd = `<div style="margin-top:20px;padding:16px 20px;background:rgba(15,23,42,0.4);border:1px solid rgba(148,163,184,0.04);border-radius:14px;display:flex;flex-wrap:wrap;gap:20px;align-items:center">
      <div style="font-size:12px;color:#475569;flex:1;min-width:200px">
        <strong style="color:#94a3b8">Historiallinen vertailu:</strong> Päivän \${curDay}.\${curMonthNum}. keskiarvo 1940–2024 on <strong style="color:\${dayAvg>=0?'#fb923c':'#38bdf8'}">\${dayAvg>0?'+':''}\${dayAvg}°C</strong> (\${monthName}: \${norm.t>0?'+':''}\${norm.t}°C).
        Nyt on <span class="live-diff \${diffClass}" style="display:inline;padding:2px 8px;font-size:12px">\${diffSign}\${diff}°</span> päivän normaalista.
      </div>
    </div>
    <div class="record-live-box">
      <div class="record-live-card"><div class="rv" style="color:#fb923c" id="recHi">–</div><div class="rl" id="recHiLbl">Tämän päivän ennätysylin</div></div>
      <div class="record-live-card"><div class="rv" style="color:#38bdf8" id="recLo">–</div><div class="rl" id="recLoLbl">Tämän päivän ennätysalin</div></div>
      <div class="record-live-card"><div class="rv" style="color:#94a3b8" id="recAvg">–</div><div class="rl">Päivän keskiarvo (85v)</div></div>
    </div>
    <div style="margin-top:24px">
      <div style="font-size:13px;font-weight:700;color:#94a3b8;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.08em">Tämän päivän tuntilämpötilat vs. historia</div>
      <div class="hourly-chart-wrap"><canvas id="cHourly"></canvas></div>
    </div>
    <div class="rain-tracker" id="rainTracker">
      <div style="font-size:13px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em">Kumulatiivinen sademäärä 2026</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:12px">
        <div><span style="font-size:28px;font-weight:800;color:#34d399" id="rainActual">–</span><div style="font-size:11px;color:#64748b;margin-top:2px">Tänä vuonna</div></div>
        <div><span style="font-size:28px;font-weight:800;color:#64748b" id="rainNormal">–</span><div style="font-size:11px;color:#64748b;margin-top:2px">Normaali tähän mennessä</div></div>
        <div><span style="font-size:28px;font-weight:800" id="rainDiff">–</span><div style="font-size:11px;color:#64748b;margin-top:2px">Ero normaalista</div></div>
      </div>
      <div class="rain-bar-wrap" style="margin-top:16px">
        <div class="rain-bar" id="rainBar" style="width:0%;background:linear-gradient(90deg,#059669,#34d399)"></div>
        <div class="rain-bar-label" id="rainBarLabel"></div>
      </div>
    </div>\`;`;

jsModified = jsModified.replace(oldLiveEnd, newLiveEnd);

// Add code after the forecast chart setTimeout to populate records and hourly chart
const oldChartTimeout = `  },100);
}`;

const newChartTimeout = `  },100);

  // ═══ RECORDS FOR TODAY ═══
  setTimeout(()=>{
    const allDayTemps=[];
    Object.keys(DAILY).forEach(y=>{
      const md=DAILY[+y]&&DAILY[+y][curMonthNum];
      if(md&&curDay<=md.dim&&md.days[curDay-1]!=null) allDayTemps.push({year:+y,temp:md.days[curDay-1]});
    });
    if(allDayTemps.length){
      const hi=allDayTemps.reduce((a,b)=>b.temp>a.temp?b:a);
      const lo=allDayTemps.reduce((a,b)=>b.temp<a.temp?b:a);
      const avg=(allDayTemps.reduce((a,d)=>a+d.temp,0)/allDayTemps.length).toFixed(1);
      document.getElementById('recHi').textContent=(hi.temp>0?'+':'')+hi.temp.toFixed(1)+'°';
      document.getElementById('recHiLbl').textContent='Ennätysylin '+curDay+'.'+curMonthNum+'. ('+hi.year+')';
      document.getElementById('recLo').textContent=(lo.temp>0?'+':'')+lo.temp.toFixed(1)+'°';
      document.getElementById('recLoLbl').textContent='Ennätysalin '+curDay+'.'+curMonthNum+'. ('+lo.year+')';
      document.getElementById('recAvg').textContent=(avg>0?'+':'')+avg+'°';
    }
  },150);

  // ═══ HOURLY CHART: today's forecast vs historical avg ═══
  setTimeout(()=>{
    const hourlyCanvas=document.getElementById('cHourly');
    if(!hourlyCanvas||!data.hourly) return;
    const hCtx=hourlyCanvas.getContext('2d');

    // Get today's hourly temps from forecast
    const todayStr=data.daily.time[0];
    const todayHours=[];
    const todayTemps=[];
    for(let i=0;i<data.hourly.time.length;i++){
      if(data.hourly.time[i].startsWith(todayStr)){
        const hr=new Date(data.hourly.time[i]).getHours();
        todayHours.push(hr+':00');
        todayTemps.push(data.hourly.temperature_2m[i]);
      }
    }

    // Historical avg for this day (single value, replicated across hours)
    const histTemps=[];
    Object.keys(DAILY).forEach(y=>{
      const md=DAILY[+y]&&DAILY[+y][curMonthNum];
      if(md&&curDay<=md.dim&&md.days[curDay-1]!=null) histTemps.push(md.days[curDay-1]);
    });
    const histAvg=histTemps.length?(histTemps.reduce((a,b)=>a+b,0)/histTemps.length).toFixed(1):null;
    const histLine=todayHours.map(()=>histAvg?+histAvg:null);

    destroyChart('cHourly');
    charts.cHourly=new Chart(hCtx,{type:'line',data:{labels:todayHours,datasets:[
      {label:'Tänään (ennuste)',data:todayTemps,borderColor:'#fb923c',backgroundColor:'rgba(251,146,60,0.1)',fill:true,tension:0.3,pointRadius:2,borderWidth:2.5,pointBackgroundColor:'#060a13',pointBorderColor:'#fb923c',pointBorderWidth:1.5},
      {label:'Historiallinen keskiarvo',data:histLine,borderColor:'#64748b',borderDash:[6,3],borderWidth:2,pointRadius:0,tension:0}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{padding:12,usePointStyle:true,color:'#94a3b8',font:{size:11}}},tooltip:{backgroundColor:'rgba(8,12,24,0.95)',padding:12,cornerRadius:10,callbacks:{label:c=>c.parsed.y.toFixed(1)+'°C'}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12}},y:{grid:{color:'rgba(148,163,184,0.04)'},ticks:{callback:v=>v+'°'}}}}});
  },200);

  // ═══ CUMULATIVE RAINFALL ═══
  fetchCumulativeRainfall();
}`;

jsModified = jsModified.replace(oldChartTimeout, newChartTimeout);

// Add the cumulative rainfall fetch function before the final closing
const rainfallFunction = `

// ═══ CUMULATIVE RAINFALL TRACKER ═══
function fetchCumulativeRainfall(){
  const now=new Date();
  const curYear=now.getFullYear();
  const curMonth=now.getMonth()+1;
  const curDay=now.getDate();
  const startDate=curYear+'-01-01';
  const endDate=curYear+'-'+String(curMonth).padStart(2,'0')+'-'+String(curDay).padStart(2,'0');

  // Calculate historical normal precipitation up to this day
  let normalPrecip=0;
  for(let m=0;m<curMonth-1;m++){
    normalPrecip+=NORMALS[m].p;
  }
  // Add fraction of current month
  normalPrecip+=NORMALS[curMonth-1].p*(curDay/DAYS_IN_MONTH[curMonth-1]);
  normalPrecip=Math.round(normalPrecip);

  // Try to fetch current year's actual rainfall
  const url='https://api.open-meteo.com/v1/forecast?latitude=65.0121&longitude=25.4651&daily=precipitation_sum&timezone=Europe%2FHelsinki&start_date='+startDate+'&end_date='+endDate+'&past_days=90';

  fetch(url).then(r=>r.ok?r.json():null).then(fdata=>{
    let actual=0;
    if(fdata&&fdata.daily&&fdata.daily.precipitation_sum){
      actual=Math.round(fdata.daily.precipitation_sum.filter(v=>v!=null).reduce((a,b)=>a+b,0));
    }
    updateRainTracker(actual,normalPrecip);
  }).catch(()=>{
    // Fallback: estimate from MO data for available months
    updateRainTracker(null,normalPrecip);
  });
}

function updateRainTracker(actual,normal){
  const el=document.getElementById('rainTracker');
  if(!el) return;
  const curYear=new Date().getFullYear();
  el.querySelector('[style*="uppercase"]').textContent='Kumulatiivinen sademäärä '+curYear;

  document.getElementById('rainNormal').textContent=normal+'mm';

  if(actual!=null&&actual>0){
    document.getElementById('rainActual').textContent=actual+'mm';
    const diff=actual-normal;
    const diffEl=document.getElementById('rainDiff');
    diffEl.textContent=(diff>0?'+':'')+diff+'mm';
    diffEl.style.color=diff>0?'#34d399':'#fb923c';

    // Bar visualization
    const pct=Math.min(150,Math.round(actual/normal*100));
    document.getElementById('rainBar').style.width=pct+'%';
    document.getElementById('rainBarLabel').textContent=pct+'% normaalista';
  }else{
    document.getElementById('rainActual').textContent='Ei dataa';
    document.getElementById('rainDiff').textContent='–';
    document.getElementById('rainBar').style.width='0%';
  }
}
`;

// Assemble the final HTML
const finalHTML = heroModified
  + '<script>\n'
  + '// ═══ DATA (generated from Oulu climate records — update with: node fetch_data.js && node build.js) ═══\n'
  + dataBlock + '\n'
  + computedData + '\n'
  + jsModified + '\n'
  + rainfallFunction + '\n'
  + '</script>\n'
  + '</body>\n</html>\n';

fs.writeFileSync('/home/user/oulusaa/index.html', finalHTML);
console.log('index.html assembled successfully');
console.log('Size:', (finalHTML.length / 1024).toFixed(0), 'KB');
console.log('Lines:', finalHTML.split('\n').length);
