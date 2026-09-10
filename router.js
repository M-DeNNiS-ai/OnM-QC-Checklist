/* ---------- Top level router ---------- */
function View(){
  if(!STATE.role) return LoginView();
  const wrap = el('div',{class:'app'});
  wrap.appendChild(Header());
  if(STATE.toast) wrap.appendChild(Toast());

  if(STATE.role==='omtech'){
    wrap.appendChild(Nav(['main','myclosed'], {main:'My Docket', myclosed:'My Completed Work'}));
    wrap.appendChild(STATE.view==='myclosed' ? OmTechClosedView() : OmTechDocketView());
  } else if(STATE.role==='omadmin'){
    wrap.appendChild(Nav(['dashboard','integrity','history'], {dashboard:'Pipeline Oversight', integrity:'Data Integrity', history:'Full Chain History'}));
    if(STATE.view==='integrity') wrap.appendChild(DataIntegrityView());
    else if(STATE.view==='history') wrap.appendChild(OmHistoryView());
    else wrap.appendChild(OmDashboardView());
  } else if(STATE.role==='plant' || STATE.role==='inventory'){
    wrap.appendChild(Nav(['bulk','ledger','warrantystock','newintake','adjust','stock','entry','history','integrity'], {
      bulk:'Bulk Stock Entry', ledger:'Daily Stock Table', warrantystock:'Warranty & Scrap Stock',
      newintake:'New Battery Intake', adjust:'Stock Movement', stock:'Stock Summary',
      entry:'Daily Plant Log', history:'Plant Log History', integrity:'Data Integrity'
    }));
    if(STATE.view==='ledger') wrap.appendChild(StockLedgerView());
    else if(STATE.view==='warrantystock') wrap.appendChild(WarrantyStockView());
    else if(STATE.view==='newintake') wrap.appendChild(NewBatteryView());
    else if(STATE.view==='adjust') wrap.appendChild(AdjustmentView());
    else if(STATE.view==='stock') wrap.appendChild(StockView());
    else if(STATE.view==='entry') wrap.appendChild(PlantEntryView());
    else if(STATE.view==='history') wrap.appendChild(PlantHistoryView());
    else if(STATE.view==='integrity') wrap.appendChild(DataIntegrityView());
    else wrap.appendChild(BulkStockEntryView());
  } else if(STATE.role==='quality'){
    wrap.appendChild(Nav(['warranty','overview','ledger','analytics'], {warranty:'Warranty & Escalations', overview:'Sector Overview', ledger:'Stock Ledger', analytics:'Analytics & Reports'}));
    if(STATE.view==='overview') wrap.appendChild(QualityOverviewView());
    else if(STATE.view==='ledger') wrap.appendChild(StockLedgerView());
    else if(STATE.view==='analytics') wrap.appendChild(QualityAnalyticsView());
    else wrap.appendChild(WarrantyView());
  }
  return wrap;
}
