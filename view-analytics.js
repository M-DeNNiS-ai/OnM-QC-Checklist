/* ---- Quality Analytics view ---- */
function QualityAnalyticsView(){
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Quality Analytics — computed live from all sector stores'));

  const fpy = fpyStats();

  const headerCard = el('div',{class:'card'});
  const headerTop = el('div',{style:'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;'});
  headerTop.appendChild(el('h3',{},'First Pass Yield (FPY) & Inventory Analytics'));
  const exportBtn = el('button',{class:'btn-primary', disabled: STATE.exportingExcel}, STATE.exportingExcel ? loadingLabel(true,'Preparing…') : '⬇ Download Full Excel Report');
  exportBtn.addEventListener('click', ()=>{ exportAllDataToExcel(); });
  headerTop.appendChild(exportBtn);
  headerCard.appendChild(headerTop);
  headerCard.appendChild(el('div',{class:'sub'},'FPY = packs that passed final QC on the first attempt (zero corrective-action cycles) out of all closed packs. All charts and the export below refresh from live sector data on every visit to this tab.'));
  const stats = el('div',{class:'stat-grid'});
  stats.appendChild(statBox(fpy.overallFPY.toFixed(1)+'%', 'Overall FPY'));
  stats.appendChild(statBox(fpy.total, 'Total Closed Packs'));
  stats.appendChild(statBox(fpy.firstPass, 'First-Pass Closures'));
  stats.appendChild(statBox(STATE.omRecords.filter(r=>r.capaCycles>0).length, 'Ever Under CAPA'));
  stats.appendChild(statBox(STATE.warrantyRecords.length, 'Warranty Escalations'));
  headerCard.appendChild(stats);
  container.appendChild(headerCard);

  const row1 = el('div',{class:'chart-row'});
  row1.appendChild(chartCard('FPY Trend by Month', fpyTrendConfig(fpy)));
  row1.appendChild(chartCard('FPY by Platform', fpyByPlatformConfig(fpy)));
  container.appendChild(row1);

  const row2 = el('div',{class:'chart-row'});
  row2.appendChild(chartCard('Final Disposition Breakdown', dispositionConfig()));
  row2.appendChild(chartCard('Corrective Action (CAPA) Cycles', capaDistributionConfig()));
  container.appendChild(row2);

  const row3 = el('div',{class:'chart-row'});
  row3.appendChild(chartCard('Current Stock by Platform', stockByPlatformConfig()));
  row3.appendChild(chartCard('Inventory Movements by Month', movementsByMonthConfig()));
  container.appendChild(row3);

  const row4 = el('div',{class:'chart-row'});
  row4.appendChild(chartCard('Warranty Escalations by Failure Category', warrantyByCategoryConfig()));
  row4.appendChild(chartCard('Warranty Escalations by Status', warrantyByStatusConfig()));
  container.appendChild(row4);

  const row5 = el('div',{class:'chart-row'});
  row5.appendChild(chartCard('Total Closing Stock by Date (Bulk Ledger)', stockLedgerTrendConfig()));
  container.appendChild(row5);

  const exportCard = el('div',{class:'card'});
  exportCard.appendChild(el('h3',{},'Excel Report Contents'));
  exportCard.appendChild(el('div',{class:'sub'},'One workbook, eleven sheets — every sector\'s raw records plus computed analysis, ready to download.'));
  const list = el('div');
  [
    'OM Chain Records — every intake/repair/QC record across all 3 stages, with technicians, tests, and CAPA cycles',
    'Plant Logs — full daily plant log history',
    'Stock Ledger — the computed daily Opening/Inwards/Outwards/Closing table for every platform',
    'OEM ID Log — every received/dispatched OEM battery ID captured through Bulk Stock Entry',
    'New Battery Intake — all warehouse intake entries',
    'Stock Movements — every issue, correction, and return with direction',
    'Stock Summary — current computed stock per platform',
    'Warranty Escalations — all escalated packs with category, status, comments',
    'FPY Overall — headline first-pass-yield figures',
    'FPY by Platform — first-pass-yield broken down per battery platform',
    'FPY by Month — first-pass-yield trended by closing month',
  ].forEach(t=> list.appendChild(el('div',{class:'check-row'},[el('span',{},t)])));
  exportCard.appendChild(list);
  const exportBtn2 = el('button',{class:'btn-primary', style:'margin-top:10px;', disabled: STATE.exportingExcel}, STATE.exportingExcel ? loadingLabel(true,'Preparing…') : '⬇ Download Full Excel Report');
  exportBtn2.addEventListener('click', ()=>{ exportAllDataToExcel(); });
  exportCard.appendChild(exportBtn2);
  container.appendChild(exportCard);

  return container;
}
