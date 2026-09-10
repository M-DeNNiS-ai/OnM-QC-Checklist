/* ==================== O&M ADMIN — oversight of the chain ==================== */

function OmDashboardView(){
  const container = el('div');
  const introCard = el('div',{class:'card'});
  introCard.appendChild(el('h3',{},'Pipeline Oversight'));
  introCard.appendChild(el('div',{class:'sub'},'Stage 1–3 data is logged by Quality Technicians; this view gives the O&M Manager real-time oversight of the whole repair pipeline.'));
  container.appendChild(introCard);
  const recs = STATE.omRecords;
  const total = recs.length;
  const s1open = recs.filter(r=>r.stage===1 && !r.status.startsWith('CLOSED')).length;
  const s2open = recs.filter(r=>r.stage===2 && !r.status.startsWith('CLOSED')).length;
  const s3open = recs.filter(r=>r.stage===3 && !r.status.startsWith('CLOSED')).length;
  const passed = recs.filter(r=>r.status==='CLOSED_PASS').length;
  const scrapped = recs.filter(r=>r.status==='CLOSED_SCRAPPED').length;
  const underCapa = recs.filter(r=>r.capaCycles>0 && !r.status.startsWith('CLOSED')).length;

  const stats = el('div',{class:'stat-grid'});
  stats.appendChild(statBox(total, 'Total Intakes'));
  stats.appendChild(statBox(s1open, 'Awaiting Stage 1'));
  stats.appendChild(statBox(s2open, 'Awaiting Stage 2'));
  stats.appendChild(statBox(s3open, 'Awaiting Stage 3'));
  stats.appendChild(statBox(underCapa, 'Under Corrective Action'));
  stats.appendChild(statBox(passed, 'Closed — Passed'));
  stats.appendChild(statBox(scrapped, 'Closed — Scrapped'));
  container.appendChild(stats);
  container.appendChild(OmHistoryView());
  return container;
}

function OmHistoryView(){
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Full Chain History'));
  card.appendChild(el('div',{class:'sub'}, `Total records: ${STATE.omRecords.length}`));
  if(STATE.omRecords.length===0){ card.appendChild(el('div',{class:'empty-note'},'No service entries found.')); return card; }

  const wrap = el('div',{class:'table-wrap'});
  const tbl = el('table');
  tbl.appendChild(el('thead',{},[el('tr',{},[
    el('th',{},'Received'), el('th',{},'BMS ID'), el('th',{},'Platform'), el('th',{},'Visit'),
    el('th',{},'Stage 1 By'), el('th',{},'Stage 2 By'), el('th',{},'Stage 3 By'),
    el('th',{},'CAPA'), el('th',{},'Status')
  ])]));
  const tbody = el('tbody');
  [...STATE.omRecords].reverse().forEach(r=>{
    const tr = el('tr',{},[
      el('td',{class:'mono'}, r.dateReceived),
      el('td',{class:'mono',style:'font-weight:700;'}, r.bmsId),
      el('td',{}, r.model||'Unknown'),
      el('td',{class:'mono'}, '#'+r.visitNumber),
      el('td',{}, r.stage1.technician||'—'),
      el('td',{}, r.stage2.technician||'—'),
      el('td',{}, r.stage3.technician||'—'),
      el('td',{}, r.capaCycles>0 ? el('span',{class:'status-chip CAPA'},'Cycle '+r.capaCycles) : '—'),
      el('td',{}, el('span',{class:'status-chip '+r.status}, r.status.replace(/_/g,' ')))
    ]);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  card.appendChild(wrap);
  return card;
}
