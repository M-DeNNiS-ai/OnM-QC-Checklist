/* ==================== QUALITY ANALYTICS — FPY charts, inventory charts ==================== */

function monthKey(dateStr){ return (dateStr||'').slice(0,7); }
function cssVar(name){ return (getComputedStyle(document.documentElement).getPropertyValue(name)||'').trim() || '#888'; }

function fpyStats(){
  const closed = STATE.omRecords.filter(r=>r.status.startsWith('CLOSED'));
  const total = closed.length;
  const firstPass = closed.filter(r=>r.capaCycles===0 && r.finalDisposition==='PASS').length;
  const overallFPY = total>0 ? (firstPass/total*100) : 0;
  const byPlatform = {};
  closed.forEach(r=>{
    const p = r.model || 'Unknown';
    if(!byPlatform[p]) byPlatform[p] = {total:0, firstPass:0};
    byPlatform[p].total++;
    if(r.capaCycles===0 && r.finalDisposition==='PASS') byPlatform[p].firstPass++;
  });
  const byMonth = {};
  closed.forEach(r=>{
    const mk = monthKey(r.closedAt ? r.closedAt.slice(0,10) : r.dateReceived);
    if(!byMonth[mk]) byMonth[mk] = {total:0, firstPass:0};
    byMonth[mk].total++;
    if(r.capaCycles===0 && r.finalDisposition==='PASS') byMonth[mk].firstPass++;
  });
  return { overallFPY, total, firstPass, byPlatform, byMonth };
}

/* ---- Chart.js config builders (theme-aware colors pulled from CSS vars) ---- */
function chartBaseOptions(opts={}){
  const textColor = cssVar('--muted');
  const gridColor = cssVar('--line');
  return {
    responsive:true, maintainAspectRatio:false,
    animation: { duration: 500, easing: 'easeOutCubic' },
    plugins:{ legend:{ display: !!opts.legend, position:'bottom', labels:{color:textColor, font:{size:11}, boxWidth:12} } },
    scales: opts.noScales ? {} : {
      x:{ ticks:{color:textColor, font:{size:10}}, grid:{color:gridColor} },
      y:{ ticks:{color:textColor, font:{size:10}, callback: v=> (opts.suffix ? v+opts.suffix : v)}, grid:{color:gridColor}, suggestedMax: opts.suggestedMax, beginAtZero:true }
    }
  };
}
function baseBarConfig(labels, datasets, opts={}){
  return { type:'bar', data:{ labels, datasets: datasets.map(d=>({ label:d.label, data:d.data, backgroundColor:d.color, borderRadius:3, maxBarThickness:46 })) }, options: chartBaseOptions({...opts, legend: datasets.length>1}) };
}
function baseLineConfig(labels, datasets, opts={}){
  return { type:'line', data:{ labels, datasets: datasets.map(d=>({ label:d.label, data:d.data, borderColor:d.color, backgroundColor:d.color, tension:0.3, fill:false, pointRadius:3 })) }, options: chartBaseOptions({...opts, legend: datasets.length>1}) };
}
function chartCard(title, config){
  const card = el('div',{class:'chart-card'});
  card.appendChild(el('h3',{},title));
  const wrap = el('div',{class:'chart-wrap'});
  const canvas = el('canvas');
  wrap.appendChild(canvas);
  card.appendChild(wrap);
  pendingCharts.push({canvas, config});
  return card;
}

function fpyTrendConfig(fpy){
  const months = Object.keys(fpy.byMonth).sort();
  const data = months.map(m=> fpy.byMonth[m].total ? (fpy.byMonth[m].firstPass/fpy.byMonth[m].total*100) : 0);
  if(months.length===0) return baseLineConfig(['No data'], [{label:'FPY %', data:[0], color:cssVar('--pass')}], {suggestedMax:100, suffix:'%'});
  return baseLineConfig(months, [{ label:'FPY %', data, color: cssVar('--pass') }], {suggestedMax:100, suffix:'%'});
}
function fpyByPlatformConfig(fpy){
  const platforms = Object.keys(fpy.byPlatform);
  if(platforms.length===0) return baseBarConfig(['No data'], [{label:'FPY %', data:[0], color:cssVar('--accent')}], {suggestedMax:100, suffix:'%'});
  const data = platforms.map(p=>{ const s=fpy.byPlatform[p]; return s.total? (s.firstPass/s.total*100):0; });
  return baseBarConfig(platforms, [{label:'FPY %', data, color: cssVar('--accent')}], {suggestedMax:100, suffix:'%'});
}
function dispositionConfig(){
  const closed = STATE.omRecords.filter(r=>r.status.startsWith('CLOSED'));
  const passed = closed.filter(r=>r.finalDisposition==='PASS').length;
  const scrapped = closed.filter(r=>r.finalDisposition==='SCRAPPED').length;
  return {
    type:'doughnut',
    data:{ labels:['Passed','Scrapped'], datasets:[{ data:[passed,scrapped], backgroundColor:[cssVar('--pass'), cssVar('--fail')] }] },
    options: chartBaseOptions({legend:true, noScales:true})
  };
}
function capaDistributionConfig(){
  const buckets = {'0 (First Pass)':0,'1':0,'2':0,'3+':0};
  STATE.omRecords.forEach(r=>{
    const c = r.capaCycles;
    if(c<=0) buckets['0 (First Pass)']++;
    else if(c===1) buckets['1']++;
    else if(c===2) buckets['2']++;
    else buckets['3+']++;
  });
  return baseBarConfig(Object.keys(buckets), [{label:'Packs', data:Object.values(buckets), color: cssVar('--capa')}], {});
}
function stockByPlatformConfig(){
  const stock = stockByPlatform();
  return baseBarConfig(PLATFORMS, [{label:'Units in Stock', data: PLATFORMS.map(p=>stock[p]), color: cssVar('--accent')}], {});
}
function movementsByMonthConfig(){
  const months = new Set();
  const inByMonth = {}, outByMonth = {};
  STATE.newBatteryRecords.forEach(r=>{ const m=monthKey(r.date); months.add(m); inByMonth[m]=(inByMonth[m]||0)+(r.quantity||0); });
  STATE.adjustments.forEach(r=>{
    const m=monthKey(r.date); months.add(m);
    const dir=movementDirection(r.type);
    if(dir>0) inByMonth[m]=(inByMonth[m]||0)+(r.quantity||0);
    else outByMonth[m]=(outByMonth[m]||0)+(r.quantity||0);
  });
  const sortedMonths = [...months].sort();
  if(sortedMonths.length===0) return baseBarConfig(['No data'], [{label:'Stock In', data:[0], color:cssVar('--pass')}], {});
  return baseBarConfig(sortedMonths, [
    {label:'Stock In', data: sortedMonths.map(m=>inByMonth[m]||0), color: cssVar('--pass')},
    {label:'Stock Out', data: sortedMonths.map(m=>outByMonth[m]||0), color: cssVar('--fail')},
  ], {});
}
function warrantyByCategoryConfig(){
  const counts = {};
  STATE.warrantyRecords.forEach(w=>{ counts[w.failureCategory]=(counts[w.failureCategory]||0)+1; });
  const labels = Object.keys(counts);
  if(labels.length===0) return baseBarConfig(['No data'], [{label:'Escalations', data:[0], color:cssVar('--warn')}], {});
  return baseBarConfig(labels, [{label:'Escalations', data:labels.map(l=>counts[l]), color: cssVar('--warn')}], {});
}
function warrantyByStatusConfig(){
  const counts = {};
  STATE.warrantyRecords.forEach(w=>{ counts[w.status]=(counts[w.status]||0)+1; });
  const labels = Object.keys(counts);
  const palette = [cssVar('--warn'), cssVar('--capa'), cssVar('--fail'), cssVar('--pass')];
  if(labels.length===0) return { type:'pie', data:{labels:['No data'], datasets:[{data:[1], backgroundColor:[cssVar('--line-dark')]}]}, options: chartBaseOptions({legend:true, noScales:true}) };
  return { type:'pie', data:{ labels, datasets:[{ data: labels.map(l=>counts[l]), backgroundColor: labels.map((_,i)=>palette[i%palette.length]) }] }, options: chartBaseOptions({legend:true, noScales:true}) };
}
function stockLedgerTrendConfig(){
  const ledger = computeStockLedger(STATE.plantStockRecords);
  if(ledger.length===0) return baseLineConfig(['No data'], [{label:'Closing Stock', data:[0], color:cssVar('--accent')}], {});
  const labels = ledger.map(e=>e.date);
  return baseLineConfig(labels, [{label:'Total Closing Stock', data: ledger.map(e=>e.totals.closing), color: cssVar('--accent')}], {});
}
