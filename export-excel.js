/* ---- Excel export (SheetJS) ---- */
function rowsOrEmpty(rows){ return rows.length ? rows : [{ Note: 'No data recorded yet' }]; }

function buildOmExportRows(){
  return rowsOrEmpty(STATE.omRecords.map(r=>({
    'BMS ID': r.bmsId, 'Platform': r.model||'', 'IMEI': r.imei||'', 'Swap Station': r.site||'',
    'Date Received': r.dateReceived, 'Time Received': r.timeReceived, 'Visit #': r.visitNumber,
    'Current Stage': r.stage, 'Status': r.status, 'CAPA Cycles': r.capaCycles,
    'Stage1 Technician': r.stage1.technician||'', 'Stage1 Received By': r.stage1.receivedBy||'', 'Stage1 Completed At': r.stage1.completedAt||'',
    'Stage2 Technician': r.stage2.technician||'', 'Stage2 SOP': r.stage2.sopRef||'', 'Stage2 Parts Replaced': r.stage2.partsReplaced||'', 'Stage2 Repair Notes': r.stage2.repairAction||'', 'Stage2 Completed At': r.stage2.completedAt||'',
    'Stage3 Technician': r.stage3.technician||'', 'Pack Voltage (V)': r.stage3.tests.packVoltage||'', 'Min Cell (V)': r.stage3.tests.minCell||'', 'Max Cell (V)': r.stage3.tests.maxCell||'',
    'IR Measured (MΩ)': r.stage3.tests.irMeasured||'', 'IR Threshold (MΩ)': r.stage3.tests.irThreshold||'',
    'QC Disposition': r.finalDisposition||'', 'QC Notes': r.stage3.qcNote||'', 'Closed At': r.closedAt||'',
  })));
}
function buildPlantExportRows(){
  return rowsOrEmpty(STATE.plantRecords.map(r=>({
    'Date': r.date, 'Active Batteries': r.activeBatteries||0, 'Charged Today': r.chargedToday||0,
    'Unboxed Today': r.unboxedToday||0, 'Faulty Flagged': r.faultyBatteries||0, 'Notes': r.notes||'', 'Entered By': r.enteredBy||''
  })));
}
function buildStockLedgerExportRows(){
  const ledger = computeStockLedger(STATE.plantStockRecords);
  const rows = [];
  ledger.forEach(entry=>{
    entry.rows.forEach(r=>{
      rows.push({ Date: entry.date, Platform: r.platform, 'Opening Stock': r.opening, 'Stock Inwards': r.received, 'Stock Outwards': r.dispatched, 'Closing Stock': r.closing });
    });
    rows.push({ Date: entry.date, Platform: 'TOTAL', 'Opening Stock': entry.totals.opening, 'Stock Inwards': entry.totals.received, 'Stock Outwards': entry.totals.dispatched, 'Closing Stock': entry.totals.closing });
  });
  return rowsOrEmpty(rows);
}
function buildOemIdLogExportRows(){
  const rows = [];
  STATE.plantStockRecords.forEach(r=>{
    (r.receivedIds||[]).forEach(oid=> rows.push({ Date:r.date, Platform:r.platform, Direction:'RECEIVED', 'OEM Battery ID': oid, 'Entered By': r.enteredBy||'' }));
    (r.dispatchedIds||[]).forEach(oid=> rows.push({ Date:r.date, Platform:r.platform, Direction:'DISPATCHED', 'OEM Battery ID': oid, 'Entered By': r.enteredBy||'' }));
  });
  return rowsOrEmpty(rows);
}
function buildNewBatteryExportRows(){
  return rowsOrEmpty(STATE.newBatteryRecords.map(r=>({
    'Date': r.date, 'Platform': r.platform, 'Quantity': r.quantity, 'Batch/Lot': r.batchLot||'',
    'Source': r.source||'', 'Notes': r.notes||'', 'Logged By': r.loggedBy||''
  })));
}
function buildAdjustmentExportRows(){
  return rowsOrEmpty(STATE.adjustments.map(r=>({
    'Date': r.date, 'Platform': r.platform, 'Movement Type': movementLabel(r.type), 'Quantity': r.quantity,
    'Direction': movementDirection(r.type)>0?'IN':'OUT', 'Reference': r.reference||'', 'Notes': r.notes||'', 'Logged By': r.loggedBy||''
  })));
}
function buildWarrantyExportRows(){
  return rowsOrEmpty(STATE.warrantyRecords.map(r=>({
    'Date Escalated': r.dateEscalated, 'BMS ID': r.bmsId, 'Platform': r.model||'', 'Failure Category': r.failureCategory,
    'Status': r.status, 'Comments': r.comments||''
  })));
}
function buildStockSummaryRows(){
  const stock = stockByPlatform();
  return rowsOrEmpty(Object.keys(stock).map(p=>({ Platform:p, 'Current Stock': stock[p] })));
}
function buildFpyExportRows(fpy){
  return [{ 'Overall FPY %': fpy.overallFPY.toFixed(1), 'Total Closed Packs': fpy.total, 'First-Pass Closures': fpy.firstPass }];
}
function buildFpyByPlatformRows(fpy){
  return rowsOrEmpty(Object.keys(fpy.byPlatform).map(p=>{
    const s = fpy.byPlatform[p];
    return { Platform:p, 'Total Closed': s.total, 'First-Pass': s.firstPass, 'FPY %': s.total ? (s.firstPass/s.total*100).toFixed(1) : '0.0' };
  }));
}
function buildFpyByMonthRows(fpy){
  return rowsOrEmpty(Object.keys(fpy.byMonth).sort().map(m=>{
    const s = fpy.byMonth[m];
    return { Month:m, 'Total Closed': s.total, 'First-Pass': s.firstPass, 'FPY %': s.total ? (s.firstPass/s.total*100).toFixed(1) : '0.0' };
  }));
}

async function exportAllDataToExcel(){
  if(typeof XLSX === 'undefined'){ toast('Excel library failed to load — check your connection and try again.'); return; }
  STATE.exportingExcel = true; render();
  STATE.omRecords = await loadOm();
  STATE.plantRecords = await loadPlant();
  STATE.plantStockRecords = await loadPlantStock();
  STATE.newBatteryRecords = await loadNewBattery();
  STATE.adjustments = await loadAdjustments();
  STATE.warrantyRecords = await loadWarranty();

  const fpy = fpyStats();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildOmExportRows()), 'OM Chain Records');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildPlantExportRows()), 'Plant Logs');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildStockLedgerExportRows()), 'Stock Ledger');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildOemIdLogExportRows()), 'OEM ID Log');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildNewBatteryExportRows()), 'New Battery Intake');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildAdjustmentExportRows()), 'Stock Movements');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildStockSummaryRows()), 'Stock Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildWarrantyExportRows()), 'Warranty Escalations');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildFpyExportRows(fpy)), 'FPY Overall');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildFpyByPlatformRows(fpy)), 'FPY by Platform');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildFpyByMonthRows(fpy)), 'FPY by Month');

  const filename = `battery-qc-report-${todayStr()}.xlsx`;
  XLSX.writeFile(wb, filename);
  STATE.exportingExcel = false;
  toast('Excel report downloaded: '+filename);
}
