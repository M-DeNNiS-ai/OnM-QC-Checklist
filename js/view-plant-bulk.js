/* ---- Bulk OEM stock intake / dispatch entry (received & dispatched, per platform, per date) ---- */
function BulkPlatformRowCard(row, date){
  const meta = PLATFORM_META[row.platform];
  const existingRec = findStockRecord(STATE.plantStockRecords, date, row.platform);
  const card = el('div',{class:'card'});
  const head = el('div',{style:'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px;'});
  head.appendChild(el('h3',{}, meta.emoji+' '+meta.label));
  if(existingRec) head.appendChild(el('span',{class:'badge'},'Entry exists — saving merges with it'));
  card.appendChild(head);

  const g = el('div',{class:'grid'});
  g.appendChild(field('Received Qty', textInput(row.receivedQty, v=>{row.receivedQty=v; render();}, {type:'number', mono:true, key:'bulk-'+row.platform+'-recvQty'})));
  g.appendChild(field('Dispatched Qty', textInput(row.dispatchedQty, v=>{row.dispatchedQty=v; render();}, {type:'number', mono:true, key:'bulk-'+row.platform+'-dispQty'})));
  card.appendChild(g);

  const idGrid = el('div',{class:'grid'});

  const recvWrap = el('div');
  recvWrap.appendChild(el('label',{},'Received OEM IDs — one per line or comma-separated (optional, can add later)'));
  recvWrap.appendChild(textareaInput(row.receivedIds, v=>{row.receivedIds=v; render();}, {mono:true, extraClass:'id-textarea', key:'bulk-'+row.platform+'-recvIds'}));
  const recvNew = parseIdList(row.receivedIds).length;
  const recvExisting = (row._existingReceivedIds||[]).length;
  const recvTarget = parseInt(row.receivedQty)||0;
  const recvTotal = recvNew + recvExisting;
  let recvClass = '';
  if(recvTarget>0 && recvTotal===recvTarget) recvClass='ok';
  else if(recvTarget>0 && recvTotal>recvTarget) recvClass='over';
  recvWrap.appendChild(el('div',{class:'id-count '+recvClass},
    `${recvTotal} / ${recvTarget||'?'} IDs logged` + (recvExisting? ` (${recvExisting} already saved)`:'')));
  idGrid.appendChild(recvWrap);

  const dispWrap = el('div');
  dispWrap.appendChild(el('label',{},'Dispatched OEM IDs — one per line or comma-separated (optional, can add later)'));
  dispWrap.appendChild(textareaInput(row.dispatchedIds, v=>{row.dispatchedIds=v; render();}, {mono:true, extraClass:'id-textarea', key:'bulk-'+row.platform+'-dispIds'}));
  const dispNew = parseIdList(row.dispatchedIds).length;
  const dispExisting = (row._existingDispatchedIds||[]).length;
  const dispTarget = parseInt(row.dispatchedQty)||0;
  const dispTotal = dispNew + dispExisting;
  let dispClass = '';
  if(dispTarget>0 && dispTotal===dispTarget) dispClass='ok';
  else if(dispTarget>0 && dispTotal>dispTarget) dispClass='over';
  dispWrap.appendChild(el('div',{class:'id-count '+dispClass},
    `${dispTotal} / ${dispTarget||'?'} IDs logged` + (dispExisting? ` (${dispExisting} already saved)`:'')));
  idGrid.appendChild(dispWrap);

  card.appendChild(idGrid);
  return card;
}

function renderLedgerDayTable(entry){
  const wrap = el('div',{class:'table-wrap'});
  const tbl = el('table');
  tbl.appendChild(el('thead',{},[el('tr',{},[
    el('th',{},'Battery'), el('th',{},'Opening Stock'), el('th',{},'Stock Inwards'), el('th',{},'Stock Outwards'), el('th',{},'Closing Stock')
  ])]));
  const tbody = el('tbody');
  entry.rows.forEach(r=>{
    const meta = PLATFORM_META[r.platform];
    tbody.appendChild(el('tr',{},[
      el('td',{}, meta.emoji+' '+meta.label),
      el('td',{class:'mono'}, String(r.opening)),
      el('td',{class:'mono'}, String(r.received)),
      el('td',{class:'mono'}, String(r.dispatched)),
      el('td',{class:'mono',style:'font-weight:700;'}, String(r.closing)),
    ]));
  });
  tbody.appendChild(el('tr',{style:'font-weight:700;background:var(--panel2);'},[
    el('td',{},'Total'),
    el('td',{class:'mono'}, String(entry.totals.opening)),
    el('td',{class:'mono'}, String(entry.totals.received)),
    el('td',{class:'mono'}, String(entry.totals.dispatched)),
    el('td',{class:'mono'}, String(entry.totals.closing)),
  ]));
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  return wrap;
}

function StockLedgerPreviewCard(date){
  const ledger = computeStockLedger(STATE.plantStockRecords);
  const entry = ledger.find(e=>e.date===date);
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Computed Stock Table — '+date));
  card.appendChild(el('div',{class:'sub'},'Auto-computed from all bulk entries — opening stock carries over from the previous saved date automatically. See "Daily Stock Table" for the full history.'));
  if(!entry){
    card.appendChild(el('div',{class:'empty-note'},'No entries saved for this date yet.'));
    return card;
  }
  card.appendChild(renderLedgerDayTable(entry));
  return card;
}

function BulkStockEntryView(){
  const d = STATE.bulkStockDraft;
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Plant & Inventory — Bulk OEM Stock Intake / Dispatch'));

  const dateCard = el('div',{class:'card'});
  dateCard.appendChild(el('h3',{},'Bulk Stock Entry'));
  dateCard.appendChild(el('div',{class:'sub'},'Enter received and dispatched quantities per platform for one date. OEM battery IDs are optional at first and can be pasted in later — quantities and ID counts are tracked separately so a partial ID list never blocks saving.'));
  const dateRow = el('div',{class:'grid narrow'});
  dateRow.appendChild(field('Date', textInput(d.date, v=>{ d.date=v; loadDraftForDate(); render(); }, {type:'date', key:'bulk-date'})));
  dateRow.appendChild(field('Entered By', textInput(d.enteredBy, v=>d.enteredBy=v, {key:'bulk-enteredBy'})));
  dateCard.appendChild(dateRow);
  if(STATE.bulkStockError){
    dateCard.appendChild(el('div',{class:'banner err'}, '⚠ '+STATE.bulkStockError));
  }
  container.appendChild(dateCard);

  d.rows.forEach(row=>{
    container.appendChild(BulkPlatformRowCard(row, d.date));
  });

  const actions = el('div',{class:'footer-actions'});
  if(STATE.bulkStockSaving) actions.appendChild(el('span',{class:'sync-line'},'Saving…'));
  const saveBtn = el('button',{class:'btn-primary', disabled: STATE.bulkStockSaving}, STATE.bulkStockSaving ? loadingLabel(true,'Saving…') : ('Save Bulk Entry for '+d.date));
  saveBtn.addEventListener('click', async ()=>{
    if(STATE.bulkStockSaving) return;
    STATE.bulkStockError = null;
    const hasAny = d.rows.some(r=> r.receivedQty!=='' || r.dispatchedQty!=='' || r.receivedIds.trim() || r.dispatchedIds.trim());
    if(!hasAny){ STATE.bulkStockError = 'Enter at least one quantity or ID list before saving.'; render(); return; }
    STATE.plantStockRecords = await loadPlantStock();
    let updated = [...STATE.plantStockRecords];
    let totalSkipped = 0;
    d.rows.forEach(row=>{
      if(row.receivedQty==='' && row.dispatchedQty==='' && !row.receivedIds.trim() && !row.dispatchedIds.trim()) return;
      const existing = findStockRecord(updated, d.date, row.platform);
      const skipSet = allIdsForPlatform(updated, row.platform, existing? existing.id : null);
      const { record: rec, skippedCount } = buildStockRecordFromRow(existing, d.date, row, d.enteredBy||STATE.techName||'', skipSet);
      totalSkipped += skippedCount;
      if(existing){ updated = updated.map(r=> r.id===rec.id ? rec : r); }
      else { updated = [...updated, rec]; }
    });
    STATE.bulkStockSaving = true; render();
    const ok = await savePlantStock(updated);
    STATE.bulkStockSaving = false;
    if(!ok){
      STATE.bulkStockError = 'Could not save to the shared record — check your connection and try again. Your entries have not been lost.';
      render();
      return;
    }
    STATE.plantStockRecords = updated;
    loadDraftForDate();
    toast(`✓ Bulk stock entry saved for ${d.date}.` + (totalSkipped>0 ? ` Skipped ${totalSkipped} duplicate OEM ID(s) already on file.` : ''));
  });
  actions.appendChild(saveBtn);
  container.appendChild(actions);

  container.appendChild(StockLedgerPreviewCard(d.date));
  return container;
}

function StockLedgerView(){
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'}, STATE.role==='quality' ? 'Read-only — computed live from Plant & Inventory\'s bulk entries' : 'Plant & Inventory — Daily Stock Table'));
  const ledger = computeStockLedger(STATE.plantStockRecords).slice().reverse();
  if(ledger.length===0){
    const card = el('div',{class:'card'});
    card.appendChild(el('h3',{},'Daily Stock Table'));
    card.appendChild(el('div',{class:'empty-note'},'No bulk stock entries recorded yet.'));
    container.appendChild(card);
    return container;
  }
  ledger.forEach(entry=>{
    const card = el('div',{class:'card'});
    card.appendChild(el('h3',{}, entry.date));
    card.appendChild(renderLedgerDayTable(entry));
    const details = el('details',{style:'margin-top:8px;'});
    details.appendChild(el('summary',{style:'cursor:pointer;font-size:11px;color:var(--muted);font-weight:700;'},'View OEM ID log for this date'));
    let anyIds = false;
    entry.rows.forEach(r=>{
      if(!r.rec) return;
      const meta = PLATFORM_META[r.platform];
      if((r.rec.receivedIds||[]).length){
        anyIds = true;
        details.appendChild(el('div',{class:'sop-box', style:'margin-top:6px;'},[
          el('div',{style:'font-weight:700;margin-bottom:4px;'}, meta.emoji+' '+meta.label+' — Received ('+r.rec.receivedIds.length+')'),
          el('div',{class:'mono', style:'word-break:break-all;'}, r.rec.receivedIds.join(', '))
        ]));
      }
      if((r.rec.dispatchedIds||[]).length){
        anyIds = true;
        details.appendChild(el('div',{class:'sop-box', style:'margin-top:6px;'},[
          el('div',{style:'font-weight:700;margin-bottom:4px;'}, meta.emoji+' '+meta.label+' — Dispatched ('+r.rec.dispatchedIds.length+')'),
          el('div',{class:'mono', style:'word-break:break-all;'}, r.rec.dispatchedIds.join(', '))
        ]));
      }
    });
    if(!anyIds) details.appendChild(el('div',{class:'empty-note'},'No OEM IDs logged for this date yet.'));
    card.appendChild(details);
    container.appendChild(card);
  });
  return container;
}
