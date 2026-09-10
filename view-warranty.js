/* ==================== QUALITY ENGINEER — warranty store + read-only overview ==================== */

function WarrantyView(){
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Quality Sector — warranty store, kept separate from other sectors'));
  const d = STATE.warrantyDraft;
  const form = el('div',{class:'card'});
  form.appendChild(el('h3',{},'Escalate Pack to Warranty'));

  const g = el('div',{class:'grid'});
  const bmsInp = textInput(d.bmsId, v=>{
    d.bmsId=v;
    const detected = detectModelFromBMS(v);
    if(detected) d.model=detected;
  }, {mono:true, placeholder:'Scan BMS Barcode'});
  g.appendChild(field('BMS ID', bmsInp));
  g.appendChild(field('Platform', textInput(d.model, v=>d.model=v)));
  g.appendChild(field('Failure Category', selectInput(d.failureCategory,
    ['Charging Port Failure','Cell Degradation','BMS Defect','IoT Board Failure','Water Ingress'].map(f=>[f,f]), v=>d.failureCategory=v)));
  g.appendChild(field('Warranty Status', selectInput(d.status,
    ['Waiting for Spare Parts','Under Supplier Review','Scrapped by QC','Repaired & Returned'].map(s=>[s,s]), v=>d.status=v)));
  form.appendChild(g);
  form.appendChild(field('Escalation Comments', textareaInput(d.comments, v=>d.comments=v)));

  const addBtn = el('button',{class:'btn-primary', style:'margin-top:8px;', disabled: STATE.warrantySaving}, STATE.warrantySaving ? loadingLabel(true,'Logging…') : 'Log Escalation');
  addBtn.addEventListener('click', async ()=>{
    if(STATE.warrantySaving) return;
    if(!d.bmsId.trim()){ toast('BMS ID is required.'); return; }
    const entry = { id: uid(), ...JSON.parse(JSON.stringify(d)), dateEscalated: todayStr() };
    const updated = [...STATE.warrantyRecords, entry];
    STATE.warrantySaving = true; render();
    const ok = await saveWarranty(updated);
    STATE.warrantySaving = false;
    if(!ok){ toast('⚠ Could not save — check your connection and try again.'); render(); return; }
    STATE.warrantyRecords = updated;
    STATE.warrantyDraft = emptyWarrantyDraft();
    toast(`Escalated ${entry.bmsId} to Warranty.`);
  });
  form.appendChild(addBtn);
  container.appendChild(form);

  const listCard = el('div',{class:'card'});
  listCard.appendChild(el('h3',{},'Active Warranty Escalations'));
  if(STATE.warrantyRecords.length===0){
    listCard.appendChild(el('div',{class:'empty-note'},'No active warranty escalations.'));
  } else {
    const wrap = el('div',{class:'table-wrap'});
    const tbl = el('table');
    tbl.appendChild(el('thead',{},[el('tr',{},[el('th',{},'Date'),el('th',{},'BMS ID'),el('th',{},'Platform'),el('th',{},'Category'),el('th',{},'Status'),el('th',{},'')])]));
    const tbody = el('tbody');
    STATE.warrantyRecords.forEach(w=>{
      const tr = el('tr',{},[
        el('td',{class:'mono'}, w.dateEscalated),
        el('td',{class:'mono',style:'font-weight:700;'}, w.bmsId),
        el('td',{}, w.model||'Unknown'),
        el('td',{}, w.failureCategory),
        el('td',{}, el('span',{class:'badge'}, w.status)),
      ]);
      const actionTd = el('td',{});
      if(w.status!=='Scrapped by QC'){
        const scrapBtn = el('button',{class:'btn-danger btn-sm'},'Scrap Pack');
        scrapBtn.addEventListener('click', async ()=>{
          const prior = w.status;
          w.status='Scrapped by QC';
          const ok = await saveWarranty(STATE.warrantyRecords);
          if(!ok){ w.status = prior; toast('⚠ Could not save — try again.'); render(); return; }
          toast(`Pack ${w.bmsId} scrapped.`);
        });
        actionTd.appendChild(scrapBtn);
      } else {
        actionTd.appendChild(el('span',{class:'status-chip FAIL'},'SCRAPPED'));
      }
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody); wrap.appendChild(tbl); listCard.appendChild(wrap);
  }
  container.appendChild(listCard);
  return container;
}

function QualityOverviewView(){
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Read-only summary — each sector\'s data still lives in its own store'));

  const omCard = el('div',{class:'card'});
  omCard.appendChild(el('h3',{},'O&M Chain'));
  const recs = STATE.omRecords;
  const stats1 = el('div',{class:'stat-grid'});
  stats1.appendChild(statBox(recs.length, 'Total Intakes'));
  stats1.appendChild(statBox(recs.filter(r=>!r.status.startsWith('CLOSED')).length, 'In Pipeline'));
  stats1.appendChild(statBox(recs.filter(r=>r.capaCycles>0 && !r.status.startsWith('CLOSED')).length, 'Under Corrective Action'));
  stats1.appendChild(statBox(recs.filter(r=>r.status==='CLOSED_PASS').length, 'Closed — Passed'));
  omCard.appendChild(stats1);
  container.appendChild(omCard);

  const plantCard = el('div',{class:'card'});
  plantCard.appendChild(el('h3',{},'Plant — Latest Log'));
  const lastPlant = STATE.plantRecords[STATE.plantRecords.length-1];
  if(lastPlant){
    plantCard.appendChild(el('div',{class:'sub'}, `${lastPlant.date} · logged by ${lastPlant.enteredBy||'—'}`));
    const stats2 = el('div',{class:'stat-grid'});
    stats2.appendChild(statBox(lastPlant.activeBatteries||'0', 'Active'));
    stats2.appendChild(statBox(lastPlant.chargedToday||'0', 'Charged Today'));
    stats2.appendChild(statBox(lastPlant.faultyBatteries||'0', 'Faulty Flagged'));
    plantCard.appendChild(stats2);
  } else {
    plantCard.appendChild(el('div',{class:'empty-note'},'No plant logs yet.'));
  }
  container.appendChild(plantCard);

  const ledgerCard = el('div',{class:'card'});
  ledgerCard.appendChild(el('h3',{},'Plant — Bulk Stock Ledger (latest date)'));
  const ledger = computeStockLedger(STATE.plantStockRecords);
  const latest = ledger[ledger.length-1];
  if(latest){
    ledgerCard.appendChild(el('div',{class:'sub'}, `Latest computed entry: ${latest.date}. See "Stock Ledger" tab for the full history and OEM ID logs.`));
    ledgerCard.appendChild(renderLedgerDayTable(latest));
  } else {
    ledgerCard.appendChild(el('div',{class:'empty-note'},'No bulk stock entries logged yet.'));
  }
  container.appendChild(ledgerCard);

  const invCard = el('div',{class:'card'});
  invCard.appendChild(el('h3',{},'Inventory — Current Stock'));
  const stock = stockByPlatform();
  const stats3 = el('div',{class:'stat-grid'});
  PLATFORMS.forEach(p=> stats3.appendChild(statBox(stock[p], p)));
  invCard.appendChild(stats3);
  container.appendChild(invCard);

  return container;
}
