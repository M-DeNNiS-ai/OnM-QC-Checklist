/* ---------- Live docket refresh ----------
   Polls the shared store in the background and re-renders the docket list so a battery sent
   from Stage 1 appears for a Stage 2 technician without them having to sign out and back in.
   Skips refreshing while the user is actively typing so it never yanks focus mid-entry. */
function userIsTypingInForm(){
  const active = document.activeElement;
  if(!active || !root.contains(active)) return false;
  const tag = active.tagName;
  return tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT';
}
async function autoRefreshDocket(){
  try{
    if(userIsTypingInForm()) return;
    if(STATE.role==='omtech' && STATE.openId===null && STATE.view==='main'){
      STATE.omRecords = await loadOm();
      STATE.omLastRefreshed = nowTime();
      STATE.omSyncOk = true;
      render();
    } else if(STATE.role==='omadmin' && (STATE.view==='dashboard' || STATE.view==='history')){
      STATE.omRecords = await loadOm();
      STATE.omLastRefreshed = nowTime();
      STATE.omSyncOk = true;
      render();
    }
  }catch(e){
    console.error('Auto-refresh failed', e);
    STATE.omSyncOk = false;
  }
}
setInterval(autoRefreshDocket, 4000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && !userIsTypingInForm()) autoRefreshDocket(); });

/* ---------- Boot ---------- */
function removeBootLoader(){
  const l = document.getElementById('boot-loader');
  if(l) l.remove();
}
async function restoreSession(){
  try{
    const s=await apiFetch('/api/auth/me');
    if(!s.authenticated){ render(); removeBootLoader(); return; }
    STATE.role=s.user.role; STATE.stage=s.user.stage||null; STATE.techName=s.user.name||'';
    if(STATE.role==='omtech'){STATE.view='main';STATE.omRecords=await loadOm();STATE.intakeDraft=emptyIntakeDraft(STATE.techName);}
    else if(STATE.role==='omadmin'){STATE.view='dashboard';STATE.omRecords=await loadOm(); STATE.plantStockRecords=await loadPlantStock(); STATE.warrantyRecords=await loadWarranty();}
    else if(STATE.role==='plant' || STATE.role==='inventory'){ STATE.view='bulk'; await loadPlantInventorySector(); }
    else if(STATE.role==='quality'){STATE.view='warranty';STATE.warrantyRecords=await loadWarranty();STATE.warrantyDraft=emptyWarrantyDraft();STATE.omRecords=await loadOm();STATE.plantRecords=await loadPlant();STATE.plantStockRecords=await loadPlantStock();STATE.newBatteryRecords=await loadNewBattery();STATE.adjustments=await loadAdjustments();}
    render();
    removeBootLoader();
  }catch(e){ console.error(e); render(); removeBootLoader(); }
}

restoreSession();
