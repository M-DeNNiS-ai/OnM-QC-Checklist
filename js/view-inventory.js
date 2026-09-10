/* ==================== INVENTORY MANAGER — separate sector store ==================== */

function NewBatteryView(){
  const d = STATE.newBatteryDraft;
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Plant & Inventory — New Battery Intake'));
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'New Battery Intake'));
  card.appendChild(el('div',{class:'sub'},'Log freshly received stock into the warehouse.'));

  const g = el('div',{class:'grid'});
  g.appendChild(field('Date', textInput(d.date, v=>d.date=v, {type:'date'})));
  g.appendChild(field('Platform', selectInput(d.platform, PLATFORMS.map(p=>[p,p]), v=>d.platform=v)));
  g.appendChild(field('Quantity', textInput(d.quantity, v=>d.quantity=v, {type:'number', mono:true})));
  g.appendChild(field('Batch / Lot', textInput(d.batchLot, v=>d.batchLot=v, {mono:true})));
  g.appendChild(field('Source', textInput(d.source, v=>d.source=v)));
  g.appendChild(field('Logged By', textInput(d.loggedBy, v=>d.loggedBy=v)));
  card.appendChild(g);
  card.appendChild(field('Notes', textareaInput(d.notes, v=>d.notes=v)));

  const actions = el('div',{class:'footer-actions'});
  const saveBtn = el('button',{class:'btn-primary', disabled: STATE.newBatterySaving}, STATE.newBatterySaving ? loadingLabel(true,'Saving…') : 'Save Intake');
  saveBtn.addEventListener('click', async ()=>{
    if(STATE.newBatterySaving) return;
    if(!d.date || !d.quantity){ toast('Date and quantity are required.'); return; }
    const entry = { id: uid(), createdAt: nowIso(), ...JSON.parse(JSON.stringify(d)), quantity: parseInt(d.quantity)||0 };
    const updated = [...STATE.newBatteryRecords, entry];
    STATE.newBatterySaving = true; render();
    const ok = await saveNewBattery(updated);
    STATE.newBatterySaving = false;
    if(!ok){ toast('⚠ Could not save — check your connection and try again.'); render(); return; }
    STATE.newBatteryRecords = updated;
    STATE.newBatteryDraft = emptyNewBatteryDraft();
    toast(`Logged ${entry.quantity} ${entry.platform} unit(s).`);
  });
  actions.appendChild(saveBtn);
  card.appendChild(actions);
  container.appendChild(card);

  const listCard = el('div',{class:'card'});
  listCard.appendChild(el('h3',{},'Recent Intakes'));
  if(STATE.newBatteryRecords.length===0){
    listCard.appendChild(el('div',{class:'empty-note'},'No intake entries yet.'));
  } else {
    const wrap = el('div',{class:'table-wrap'});
    const tbl = el('table');
    tbl.appendChild(el('thead',{},[el('tr',{},[el('th',{},'Date'),el('th',{},'Platform'),el('th',{},'Qty'),el('th',{},'Batch'),el('th',{},'Source'),el('th',{},'By')])]));
    const tbody = el('tbody');
    [...STATE.newBatteryRecords].reverse().forEach(r=>{
      tbody.appendChild(el('tr',{},[
        el('td',{class:'mono'}, r.date), el('td',{}, r.platform), el('td',{class:'mono'}, r.quantity),
        el('td',{class:'mono'}, r.batchLot||'—'), el('td',{}, r.source||'—'), el('td',{}, r.loggedBy||'—')
      ]));
    });
    tbl.appendChild(tbody); wrap.appendChild(tbl); listCard.appendChild(wrap);
  }
  container.appendChild(listCard);
  return container;
}

function AdjustmentView(){
  const d = STATE.adjustmentDraft;
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Plant & Inventory — Stock Movement'));
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Stock Movement'));
  card.appendChild(el('div',{class:'sub'},'Record stock leaving or being corrected against the warehouse baseline.'));

  const g = el('div',{class:'grid'});
  g.appendChild(field('Date', textInput(d.date, v=>d.date=v, {type:'date'})));
  g.appendChild(field('Platform', selectInput(d.platform, PLATFORMS.map(p=>[p,p]), v=>d.platform=v)));
  g.appendChild(field('Movement Type', selectInput(d.type, MOVEMENT_TYPES, v=>d.type=v)));
  g.appendChild(field('Quantity', textInput(d.quantity, v=>d.quantity=v, {type:'number', mono:true})));
  g.appendChild(field('Reference', textInput(d.reference, v=>d.reference=v)));
  g.appendChild(field('Logged By', textInput(d.loggedBy, v=>d.loggedBy=v)));
  card.appendChild(g);
  card.appendChild(field('Notes', textareaInput(d.notes, v=>d.notes=v)));

  const actions = el('div',{class:'footer-actions'});
  const saveBtn = el('button',{class:'btn-primary', disabled: STATE.adjustmentSaving}, STATE.adjustmentSaving ? loadingLabel(true,'Saving…') : 'Save Movement');
  saveBtn.addEventListener('click', async ()=>{
    if(STATE.adjustmentSaving) return;
    if(!d.date || !d.quantity){ toast('Date and quantity are required.'); return; }
    const entry = { id: uid(), createdAt: nowIso(), ...JSON.parse(JSON.stringify(d)), quantity: parseInt(d.quantity)||0 };
    const updated = [...STATE.adjustments, entry];
    STATE.adjustmentSaving = true; render();
    const ok = await saveAdjustments(updated);
    STATE.adjustmentSaving = false;
    if(!ok){ toast('⚠ Could not save — check your connection and try again.'); render(); return; }
    STATE.adjustments = updated;
    STATE.adjustmentDraft = emptyAdjustmentDraft();
    toast('Stock movement recorded.');
  });
  actions.appendChild(saveBtn);
  card.appendChild(actions);
  container.appendChild(card);

  const listCard = el('div',{class:'card'});
  listCard.appendChild(el('h3',{},'Recent Movements'));
  if(STATE.adjustments.length===0){
    listCard.appendChild(el('div',{class:'empty-note'},'No movements yet.'));
  } else {
    const wrap = el('div',{class:'table-wrap'});
    const tbl = el('table');
    tbl.appendChild(el('thead',{},[el('tr',{},[el('th',{},'Date'),el('th',{},'Platform'),el('th',{},'Type'),el('th',{},'Qty'),el('th',{},'Reference'),el('th',{},'By')])]));
    const tbody = el('tbody');
    [...STATE.adjustments].reverse().forEach(r=>{
      tbody.appendChild(el('tr',{},[
        el('td',{class:'mono'}, r.date), el('td',{}, r.platform), el('td',{}, movementLabel(r.type)),
        el('td',{class:'mono'}, r.quantity), el('td',{}, r.reference||'—'), el('td',{}, r.loggedBy||'—')
      ]));
    });
    tbl.appendChild(tbody); wrap.appendChild(tbl); listCard.appendChild(wrap);
  }
  container.appendChild(listCard);
  return container;
}

function StockView(){
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Plant & Inventory — Stock Summary'));
  const stock = stockByPlatform();
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Current Stock by Platform'));
  card.appendChild(el('div',{class:'sub'},'Computed from all intake and movement records logged in this sector.'));
  const stats = el('div',{class:'stat-grid'});
  PLATFORMS.forEach(p=> stats.appendChild(statBox(stock[p], p)));
  stats.appendChild(statBox(Object.values(stock).reduce((a,b)=>a+b,0), 'Total Stock'));
  card.appendChild(stats);
  container.appendChild(card);
  return container;
}
