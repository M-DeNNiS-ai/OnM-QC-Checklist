/* ---------- O&M chain record model ---------- */
function emptyIntakeDraft(techName){
  return {
    dateReceived: todayStr(), timeReceived: nowTime(), bmsId:'', model:'', imei:'', site:'', receivedBy: techName||'',
    pre:{}, issues:{}, otherNote:'',
  };
}
function newOmRecord(d, visitNumber, techName){
  return {
    id: uid(), createdAt: nowIso(),
    bmsId: d.bmsId.trim(), model: d.model, imei: d.imei, site: d.site,
    dateReceived: d.dateReceived, timeReceived: d.timeReceived,
    visitNumber,
    stage: 2, status: 'STAGE2_OPEN',
    capaCycles: 0, isCorrectiveAction: false, capaLog: [],
    stage1: { technician: techName, receivedBy: d.receivedBy, pre: d.pre, issues: d.issues, otherNote: d.otherNote, completedAt: nowIso() },
    stage2: { technician:'', sopRef: STANDARD_SOPS[0], repairAction:'', partsReplaced:'', post:{}, completedAt:null },
    stage3: { technician:'', tests:{packVoltage:'',minCell:'',maxCell:'',irMeasured:'',irThreshold:550}, testBools:{}, qcPassed:'', qcNote:'', completedAt:null },
    finalDisposition: null, closedAt: null,
  };
}
function closedRecordsForBms(records, bmsId){
  const clean = (bmsId||'').trim().toUpperCase();
  if(!clean) return [];
  return records.filter(r => r.bmsId.trim().toUpperCase()===clean && r.status.startsWith('CLOSED'));
}
function openRecordForBms(records, bmsId){
  const clean = (bmsId||'').trim().toUpperCase();
  if(!clean) return null;
  return records.find(r => r.bmsId.trim().toUpperCase()===clean && !r.status.startsWith('CLOSED')) || null;
}
function stageQueue(records, stage){
  return records.filter(r => r.stage===stage && !r.status.startsWith('CLOSED')).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}
function findRecord(records, id){ return records.find(r=>r.id===id); }

/* ---------- Plant bulk stock ledger model ---------- */
function emptyBulkStockDraft(){
  return {
    date: todayStr(),
    enteredBy: '',
    rows: PLATFORMS.map(p=>({
      platform: p, receivedQty:'', receivedIds:'', dispatchedQty:'', dispatchedIds:'',
      _existingReceivedIds:[], _existingDispatchedIds:[],
    })),
  };
}
function findStockRecord(records, date, platform){
  return records.find(r=> r.date===date && r.platform===platform) || null;
}
function buildStockRecordFromRow(existing, date, row, enteredBy, skipIdsSet){
  let newReceivedIds = parseIdList(row.receivedIds);
  let newDispatchedIds = parseIdList(row.dispatchedIds);
  let skippedCount = 0;
  if(skipIdsSet && skipIdsSet.size){
    const beforeR = newReceivedIds.length, beforeD = newDispatchedIds.length;
    newReceivedIds = newReceivedIds.filter(id=>!skipIdsSet.has(id));
    newDispatchedIds = newDispatchedIds.filter(id=>!skipIdsSet.has(id));
    skippedCount = (beforeR-newReceivedIds.length)+(beforeD-newDispatchedIds.length);
  }
  const mergedReceivedIds = existing ? Array.from(new Set([...(existing.receivedIds||[]), ...newReceivedIds])) : newReceivedIds;
  const mergedDispatchedIds = existing ? Array.from(new Set([...(existing.dispatchedIds||[]), ...newDispatchedIds])) : newDispatchedIds;
  const receivedQty = row.receivedQty!=='' ? (parseInt(row.receivedQty)||0) : (existing? existing.receivedQty : 0);
  const dispatchedQty = row.dispatchedQty!=='' ? (parseInt(row.dispatchedQty)||0) : (existing? existing.dispatchedQty : 0);
  const record = {
    id: existing? existing.id : uid(),
    date, platform: row.platform,
    receivedQty, dispatchedQty,
    receivedIds: mergedReceivedIds, dispatchedIds: mergedDispatchedIds,
    enteredBy: enteredBy||(existing?existing.enteredBy:''),
    createdAt: existing? existing.createdAt : nowIso(),
    updatedAt: nowIso(),
  };
  return { record, skippedCount };
}
function computeStockLedger(records){
  const dates = Array.from(new Set(records.map(r=>r.date))).sort();
  const running = {}; PLATFORMS.forEach(p=>running[p]=0);
  const table = [];
  dates.forEach(date=>{
    const rows = PLATFORMS.map(p=>{
      const rec = findStockRecord(records, date, p);
      const opening = running[p];
      const received = rec ? rec.receivedQty : 0;
      const dispatched = rec ? rec.dispatchedQty : 0;
      const closing = opening + received - dispatched;
      running[p] = closing;
      return { platform:p, opening, received, dispatched, closing, rec };
    });
    const totals = rows.reduce((acc,r)=>({
      opening: acc.opening+r.opening, received: acc.received+r.received,
      dispatched: acc.dispatched+r.dispatched, closing: acc.closing+r.closing
    }), {opening:0, received:0, dispatched:0, closing:0});
    table.push({ date, rows, totals });
  });
  return table;
}
function loadDraftForDate(){
  const d = STATE.bulkStockDraft;
  d.rows = PLATFORMS.map(p=>{
    const existing = findStockRecord(STATE.plantStockRecords, d.date, p);
    return {
      platform: p,
      receivedQty: existing ? String(existing.receivedQty) : '',
      receivedIds: '',
      dispatchedQty: existing ? String(existing.dispatchedQty) : '',
      dispatchedIds: '',
      _existingReceivedIds: existing ? (existing.receivedIds||[]) : [],
      _existingDispatchedIds: existing ? (existing.dispatchedIds||[]) : [],
    };
  });
}
async function loadPlantInventorySector(){
  STATE.plantRecords = await loadPlant();
  STATE.plantStockRecords = await loadPlantStock();
  STATE.newBatteryRecords = await loadNewBattery();
  STATE.adjustments = await loadAdjustments();
  STATE.warrantyRecords = await loadWarranty();
  STATE.plantDraft = emptyPlantDraft();
  STATE.newBatteryDraft = emptyNewBatteryDraft();
  STATE.adjustmentDraft = emptyAdjustmentDraft();
  STATE.bulkStockDraft = emptyBulkStockDraft();
  loadDraftForDate();
}
function allIdsForPlatform(records, platform, excludeRecordId){
  const set = new Set();
  records.forEach(r=>{
    if(r.platform!==platform) return;
    if(excludeRecordId && r.id===excludeRecordId) return;
    (r.receivedIds||[]).forEach(id=>set.add(id));
    (r.dispatchedIds||[]).forEach(id=>set.add(id));
  });
  return set;
}
function findDuplicateOpenOmGroups(records){
  const map = {};
  records.forEach(r=>{
    if(r.status.startsWith('CLOSED')) return;
    const key = r.bmsId.trim().toUpperCase();
    if(!map[key]) map[key]=[];
    map[key].push(r);
  });
  return Object.values(map).filter(list=>list.length>1).map(list=>list.slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt)));
}
function findDuplicateOemIdOccurrences(records){
  const byPlatform = {};
  PLATFORMS.forEach(p=> byPlatform[p] = { received:{}, dispatched:{} });
  records.forEach(r=>{
    (r.receivedIds||[]).forEach(id=>{
      byPlatform[r.platform].received[id] = byPlatform[r.platform].received[id]||[];
      byPlatform[r.platform].received[id].push({date:r.date, recordId:r.id});
    });
    (r.dispatchedIds||[]).forEach(id=>{
      byPlatform[r.platform].dispatched[id] = byPlatform[r.platform].dispatched[id]||[];
      byPlatform[r.platform].dispatched[id].push({date:r.date, recordId:r.id});
    });
  });
  const dups = [];
  PLATFORMS.forEach(p=>{
    ['received','dispatched'].forEach(dir=>{
      Object.entries(byPlatform[p][dir]).forEach(([id,occ])=>{
        if(occ.length>1) dups.push({ platform:p, direction:dir, id, occurrences: occ.slice().sort((a,b)=>a.date.localeCompare(b.date)) });
      });
    });
  });
  return dups;
}
function findDuplicateActiveWarrantyGroups(records){
  const map = {};
  records.forEach(w=>{
    if(w.status==='Scrapped by QC') return;
    const key = w.bmsId.trim().toUpperCase();
    if(!map[key]) map[key]=[];
    map[key].push(w);
  });
  return Object.values(map).filter(list=>list.length>1).map(list=>list.slice().sort((a,b)=>a.dateEscalated.localeCompare(b.dateEscalated)));
}

/* ---------- Plant Admin drafts ---------- */
function emptyPlantDraft(){
  return { date: todayStr(), activeBatteries:'', chargedToday:'', unboxedToday:'', faultyBatteries:'', notes:'', enteredBy:'' };
}

/* ---------- Inventory Manager drafts ---------- */
function emptyNewBatteryDraft(){
  return { date: todayStr(), platform: PLATFORMS[0], quantity:'', batchLot:'', source:'', notes:'', loggedBy:'' };
}
function emptyAdjustmentDraft(){
  return { date: todayStr(), platform: PLATFORMS[0], type: MOVEMENT_TYPES[0][0], quantity:'', reference:'', notes:'', loggedBy:'' };
}
function allInventoryMovements(){
  const received = STATE.newBatteryRecords.map(r=>({ date:r.date, platform:r.platform, qty:r.quantity, direction:1 }));
  const adjusted = STATE.adjustments.map(r=>({ date:r.date, platform:r.platform, qty:r.quantity, direction: movementDirection(r.type) }));
  return [...received, ...adjusted];
}
function stockByPlatform(){
  const stock = {}; PLATFORMS.forEach(p=>stock[p]=0);
  allInventoryMovements().forEach(m=>{ stock[m.platform] = (stock[m.platform]||0) + m.direction*m.qty; });
  return stock;
}

/* ---------- Quality warranty draft ---------- */
function emptyWarrantyDraft(){
  return { bmsId:'', model:'', failureCategory:'Charging Port Failure', status:'Waiting for Spare Parts', comments:'', };
}
