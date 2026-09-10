function PlantEntryView(){
  const d = STATE.plantDraft;
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Plant & Inventory — Daily Plant Log'));
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Daily Plant Log'));
  card.appendChild(el('div',{class:'sub'},'One entry per day summarizing plant-side battery activity.'));

  const g = el('div',{class:'grid'});
  g.appendChild(field('Date', textInput(d.date, v=>d.date=v, {type:'date'})));
  g.appendChild(field('Active Batteries in Field', textInput(d.activeBatteries, v=>d.activeBatteries=v, {type:'number', mono:true})));
  g.appendChild(field('Charged Today', textInput(d.chargedToday, v=>d.chargedToday=v, {type:'number', mono:true})));
  g.appendChild(field('Unboxed Today', textInput(d.unboxedToday, v=>d.unboxedToday=v, {type:'number', mono:true})));
  g.appendChild(field('Faulty Batteries Flagged', textInput(d.faultyBatteries, v=>d.faultyBatteries=v, {type:'number', mono:true})));
  g.appendChild(field('Entered By', textInput(d.enteredBy, v=>d.enteredBy=v)));
  card.appendChild(g);
  card.appendChild(field('Notes', textareaInput(d.notes, v=>d.notes=v)));

  const actions = el('div',{class:'footer-actions'});
  const clearBtn = el('button',{disabled: STATE.plantSaving},'Reset');
  clearBtn.addEventListener('click', ()=>{ STATE.plantDraft = emptyPlantDraft(); render(); });
  const saveBtn = el('button',{class:'btn-primary', disabled: STATE.plantSaving}, STATE.plantSaving ? loadingLabel(true,'Saving…') : 'Save Daily Log');
  saveBtn.addEventListener('click', async ()=>{
    if(STATE.plantSaving) return;
    if(!d.date){ toast('Date is required.'); return; }
    const entry = { id: uid(), createdAt: nowIso(), ...JSON.parse(JSON.stringify(d)) };
    const updated = [...STATE.plantRecords, entry];
    STATE.plantSaving = true; render();
    const ok = await savePlant(updated);
    STATE.plantSaving = false;
    if(!ok){ toast('⚠ Could not save — check your connection and try again.'); render(); return; }
    STATE.plantRecords = updated;
    STATE.plantDraft = emptyPlantDraft();
    toast('Plant log saved for '+entry.date+'.');
  });
  actions.appendChild(clearBtn); actions.appendChild(saveBtn);
  card.appendChild(actions);
  container.appendChild(card);
  return container;
}

function PlantHistoryView(){
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Plant & Inventory — Plant Log History'));
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Plant Log History'));
  card.appendChild(el('div',{class:'sub'}, `Total entries: ${STATE.plantRecords.length}`));
  if(STATE.plantRecords.length===0){ card.appendChild(el('div',{class:'empty-note'},'No plant log entries yet.')); container.appendChild(card); return container; }

  const wrap = el('div',{class:'table-wrap'});
  const tbl = el('table');
  tbl.appendChild(el('thead',{},[el('tr',{},[
    el('th',{},'Date'), el('th',{},'Active'), el('th',{},'Charged'), el('th',{},'Unboxed'), el('th',{},'Faulty'), el('th',{},'By')
  ])]));
  const tbody = el('tbody');
  [...STATE.plantRecords].reverse().forEach(r=>{
    tbody.appendChild(el('tr',{},[
      el('td',{class:'mono'}, r.date),
      el('td',{class:'mono'}, r.activeBatteries||'0'),
      el('td',{class:'mono'}, r.chargedToday||'0'),
      el('td',{class:'mono'}, r.unboxedToday||'0'),
      el('td',{class:'mono'}, r.faultyBatteries||'0'),
      el('td',{}, r.enteredBy||'—'),
    ]));
  });
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  card.appendChild(wrap);
  container.appendChild(card);
  return container;
}

function WarrantyStockView(){
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Plant & Inventory — Warranty & Scrap Stock (read-only, reflects the Quality team\'s warranty log)'));
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Batteries Currently Under Warranty & Scrapped, by Brand'));
  card.appendChild(el('div',{class:'sub'},'Active = escalated to warranty and not yet scrapped or repaired & returned. Scrapped = removed from the fleet by Quality.'));
  const active = STATE.warrantyRecords.filter(w=>w.status!=='Scrapped by QC' && w.status!=='Repaired & Returned');
  const scrapped = STATE.warrantyRecords.filter(w=>w.status==='Scrapped by QC');
  card.appendChild(el('div',{class:'stat-grid'},[statBox(active.length,'Active Under Warranty'), statBox(scrapped.length,'Scrapped Total')]));
  container.appendChild(card);

  function groupTable(list, title){
    const c = el('div',{class:'card'});
    c.appendChild(el('h3',{},title));
    if(list.length===0){ c.appendChild(el('div',{class:'empty-note'},'None on file.')); return c; }
    const groups = {};
    list.forEach(w=>{
      const brand = w.model||'Unknown';
      const key = brand+'|'+w.failureCategory;
      if(!groups[key]) groups[key] = { brand, issue:w.failureCategory, count:0 };
      groups[key].count++;
    });
    const wrap = el('div',{class:'table-wrap'});
    const tbl = el('table');
    tbl.appendChild(el('thead',{},[el('tr',{},[el('th',{},'Brand'),el('th',{},'Issue / Reason'),el('th',{},'Count')])]));
    const tbody = el('tbody');
    Object.values(groups).sort((a,b)=> a.brand.localeCompare(b.brand)||a.issue.localeCompare(b.issue)).forEach(g=>{
      tbody.appendChild(el('tr',{},[el('td',{},g.brand),el('td',{},g.issue),el('td',{class:'mono',style:'font-weight:700;'},String(g.count))]));
    });
    tbl.appendChild(tbody); wrap.appendChild(tbl); c.appendChild(wrap);
    return c;
  }
  container.appendChild(groupTable(active, 'Active Warranty Stock — by Brand & Issue'));
  container.appendChild(groupTable(scrapped, 'Scrapped Stock — by Brand & Reason'));
  return container;
}
