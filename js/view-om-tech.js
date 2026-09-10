/* ==================== O&M TECHNICIAN — 3-STAGE CHAIN ==================== */

function OmTechDocketView(){
  const container = el('div');

  if(STATE.openId){
    const rec = findRecord(STATE.omRecords, STATE.openId);
    if(rec){
      const back = el('button',{class:'btn-sm', style:'margin-bottom:10px;'},'← Back to Docket');
      back.addEventListener('click', ()=>{ STATE.openId=null; STATE.serialWarning=null; STATE.intakeError=null; render(); });
      container.appendChild(back);
      if(rec.capaCycles>0){
        container.appendChild(el('div',{class:'banner capa'},
          `Under Corrective Action — Cycle ${rec.capaCycles}. This is not a new repeat failure; it is the same visit returning to O&M for correction.`));
      }
      if(STATE.stage===1) container.appendChild(Stage1EditCard(rec));
      else if(STATE.stage===2) container.appendChild(Stage2Card(rec));
      else if(STATE.stage===3) container.appendChild(Stage3Card(rec));
      return container;
    }
    STATE.openId = null;
  }

  if(STATE.stage===1){
    container.appendChild(NewIntakeCard());
  }

  container.appendChild(DocketListCard());
  return container;
}

function NewIntakeCard(){
  const d = STATE.intakeDraft;
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Receive Battery — New Intake'));
  card.appendChild(el('div',{class:'sub'},'Log a battery arriving at Stage 1. Once sent, it moves to the Stage 2 repair docket.'));

  if(STATE.serialWarning){
    container_warn(card);
  }
  if(STATE.intakeError){
    card.appendChild(el('div',{class:'banner err'}, '⚠ '+STATE.intakeError));
  }

  const g1 = el('div',{class:'grid'});
  g1.appendChild(field('Date Received', textInput(d.dateReceived, v=>d.dateReceived=v, {type:'date'})));
  g1.appendChild(field('Time Received', textInput(d.timeReceived, v=>d.timeReceived=v, {type:'time'})));

  const bmsInput = textInput(d.bmsId, v=>{
    d.bmsId=v;
    const detected = detectModelFromBMS(v);
    if(detected) d.model = detected;
  }, {mono:true, placeholder:'Scan BMS Barcode', key:'intake-bmsId'});
  bmsInput.addEventListener('blur', ()=>{
    const clean = d.bmsId.trim();
    STATE.serialWarning = null;
    if(clean){
      const openRec = openRecordForBms(STATE.omRecords, clean);
      if(openRec){
        STATE.serialWarning = `This BMS ID is already in the pipeline (Stage ${openRec.stage}). Use that docket instead of creating a new intake.`;
      } else {
        const closed = closedRecordsForBms(STATE.omRecords, clean);
        if(closed.length>0) STATE.serialWarning = `Notice: BMS ID has ${closed.length} prior closed service visit(s).`;
      }
    }
    render();
  });
  g1.appendChild(field('Scan BMS ID Barcode', bmsInput));
  g1.appendChild(field('Battery Platform', textInput(d.model, v=>d.model=v, {placeholder:'Auto-detected'})));

  const imeiRequired = isImeiRequired(d);
  const imeiInput = textInput(d.imei, v=>d.imei=v, {mono:true, placeholder: imeiRequired?'Required':'Optional'});
  if(imeiRequired) imeiInput.style.borderColor='var(--warn)';
  g1.appendChild(field(imeiRequired?'IMEI Number (Mandatory)':'IMEI Number', imeiInput));

  const swapRequired = isSwapStationRequired(d);
  const swapInput = textInput(d.site, v=>d.site=v, {placeholder: swapRequired?'Station Required':'Optional'});
  if(swapRequired) swapInput.style.borderColor='var(--warn)';
  g1.appendChild(field(swapRequired?'Swap Station (Mandatory)':'Swap Station', swapInput));

  g1.appendChild(field('Received By', textInput(d.receivedBy, v=>d.receivedBy=v)));
  card.appendChild(g1);

  card.appendChild(ChecklistCard('Pre-Opening Inspection', d.pre, CHECK_ITEMS, (k,v)=>d.pre[k]=v));
  card.appendChild(IssuesCard(d));

  const actions = el('div',{style:'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;align-items:center;'});
  if(STATE.intakeSaving) actions.appendChild(el('span',{class:'sync-line'},'Saving…'));
  const clearBtn = el('button',{disabled: STATE.intakeSaving},'Reset');
  clearBtn.addEventListener('click', ()=>{ STATE.intakeDraft = emptyIntakeDraft(STATE.techName); STATE.serialWarning=null; STATE.intakeError=null; render(); });
  const sendBtn = el('button',{class:'btn-primary', disabled: STATE.intakeSaving}, loadingLabel(STATE.intakeSaving, 'Sending…'));
  if(!STATE.intakeSaving) sendBtn.textContent='Send to Stage 2 Docket';
  sendBtn.addEventListener('click', async ()=>{
    if(STATE.intakeSaving) return; // guard against double-click / double-submit while a write is in flight
    const clean = d.bmsId.trim();
    STATE.intakeError = null;
    STATE.omRecords = await loadOm();
    if(!clean || !d.dateReceived){ STATE.intakeError='BMS ID and intake date are required.'; render(); return; }
    if(isImeiRequired(d) && !d.imei.trim()){ STATE.intakeError='IMEI is required for the selected issue type.'; render(); return; }
    if(isSwapStationRequired(d) && !d.site.trim()){ STATE.intakeError='Swap Station is required for this defect type.'; render(); return; }
    if(openRecordForBms(STATE.omRecords, clean)){ STATE.intakeError='This BMS ID is already open in the pipeline. Use that docket instead of creating a new intake.'; render(); return; }
    const visitNumber = closedRecordsForBms(STATE.omRecords, clean).length + 1;
    const rec = newOmRecord(d, visitNumber, STATE.techName);
    const updated = [...STATE.omRecords, rec];
    STATE.intakeSaving = true; render();
    const ok = await saveOm(updated);
    STATE.intakeSaving = false;
    if(!ok){
      // This is the fix for "the button isn't working": previously a failed write left the
      // tech staring at a form that silently did nothing. Now we surface it, and — critically —
      // we do NOT clear the draft or the intake error, so their entered data isn't lost and
      // they know to retry.
      STATE.intakeError = 'Could not save to the shared record — check your connection and tap Send again. Your entries have not been lost.';
      render();
      return;
    }
    STATE.omRecords = updated;
    STATE.intakeDraft = emptyIntakeDraft(STATE.techName);
    STATE.serialWarning = null;
    STATE.intakeError = null;
    STATE.omLastRefreshed = nowTime();
    toast(`✓ Intake logged — BMS ${rec.bmsId} sent to Stage 2 docket.`);
  });
  actions.appendChild(clearBtn); actions.appendChild(sendBtn);
  card.appendChild(actions);
  return card;
}
function container_warn(card){
  card.appendChild(el('div',{class:'banner'}, STATE.serialWarning));
}

function DocketListCard(){
  const stage = STATE.stage;
  const queue = stageQueue(STATE.omRecords, stage);
  const card = el('div',{class:'card'});
  const titleRow = el('div',{style:'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;'});
  titleRow.appendChild(el('h3',{}, `Stage ${stage} Docket`));
  const refreshWrap = el('div',{style:'display:flex;align-items:center;gap:8px;'});
  const dot = el('span',{class:'sync-dot'+(STATE.omSyncOk?'':' bad')});
  const syncLine = el('span',{class:'sync-line'},[dot, STATE.omLastRefreshed ? ('Synced '+STATE.omLastRefreshed) : 'Not yet synced']);
  refreshWrap.appendChild(syncLine);
  const refreshBtn = el('button',{class:'btn-sm'},'🔄 Refresh Docket');
  refreshBtn.addEventListener('click', async ()=>{
    const fresh = await loadOm();
    STATE.omRecords = fresh;
    STATE.omLastRefreshed = nowTime();
    STATE.omSyncOk = true;
    toast('Docket refreshed from the shared record.');
  });
  refreshWrap.appendChild(refreshBtn);
  titleRow.appendChild(refreshWrap);
  card.appendChild(titleRow);
  card.appendChild(el('div',{class:'sub'}, (stage===1
    ? 'Batteries returned for corrective re-inspection appear here. '
    : `Batteries waiting on your stage. Total: ${queue.length}. `)
    + 'This list updates automatically every few seconds, or tap Refresh Docket for an immediate check.'));

  if(queue.length===0){
    card.appendChild(el('div',{class:'empty-note'},'Docket is empty.'));
    return card;
  }

  queue.forEach(rec=>{
    const row = el('div',{class:'docket-item'});
    const left = el('div',{},[
      el('div',{style:'font-weight:700;'}, `${rec.bmsId} — ${rec.model||'Unknown'}`),
      el('div',{class:'meta'}, `Visit #${rec.visitNumber} · received ${rec.dateReceived}` + (rec.capaCycles>0 ? ` · Corrective Action Cycle ${rec.capaCycles}` : ''))
    ]);
    const right = el('div',{style:'display:flex;align-items:center;gap:8px;'});
    if(rec.capaCycles>0) right.appendChild(el('span',{class:'status-chip CAPA'},'CAPA'));
    right.appendChild(el('span',{class:'status-chip OPEN'}, 'Stage '+rec.stage));
    const openBtn = el('button',{class:'btn-sm btn-primary'},'Open');
    openBtn.addEventListener('click', ()=>{ STATE.openId=rec.id; STATE.serialWarning=null; STATE.intakeError=null; render(); });
    right.appendChild(openBtn);
    row.appendChild(left); row.appendChild(right);
    card.appendChild(row);
  });
  return card;
}

function Stage1EditCard(rec){
  const s1 = rec.stage1;
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{}, `Re-Inspection — ${rec.bmsId}`));
  card.appendChild(el('div',{class:'sub'},'Corrective action: re-check the pack and update diagnostics before resending to Stage 2.'));

  const g1 = el('div',{class:'grid'});
  g1.appendChild(field('Battery Platform', textInput(rec.model, v=>rec.model=v)));
  g1.appendChild(field('IMEI Number', textInput(rec.imei, v=>rec.imei=v, {mono:true})));
  g1.appendChild(field('Swap Station', textInput(rec.site, v=>rec.site=v)));
  card.appendChild(g1);

  card.appendChild(ChecklistCard('Pre-Opening Inspection', s1.pre, CHECK_ITEMS, (k,v)=>s1.pre[k]=v));
  const issuesProxy = { issues: s1.issues, get otherNote(){ return s1.otherNote; }, set otherNote(v){ s1.otherNote = v; } };
  card.appendChild(IssuesCard(issuesProxy));

  if(STATE.intakeError){
    card.appendChild(el('div',{class:'banner err'}, '⚠ '+STATE.intakeError));
  }

  const actions = el('div',{style:'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;'});
  const sendBtn = el('button',{class:'btn-primary', disabled: STATE.intakeSaving}, STATE.intakeSaving ? loadingLabel(true,'Sending…') : 'Resend to Stage 2 Docket');
  sendBtn.addEventListener('click', async ()=>{
    if(STATE.intakeSaving) return;
    STATE.intakeError = null;
    s1.technician = STATE.techName;
    s1.completedAt = nowIso();
    rec.stage = 2; rec.status = 'STAGE2_OPEN';
    const fresh = await loadOm();
    const idx = fresh.findIndex(r=>r.id===rec.id);
    if(idx===-1){ STATE.intakeError = 'This record no longer exists in the shared docket — it may have been edited elsewhere. Refreshing.'; STATE.omRecords = fresh; render(); return; }
    fresh[idx] = rec;
    STATE.intakeSaving = true; render();
    const ok = await saveOm(fresh);
    STATE.intakeSaving = false;
    if(!ok){
      STATE.intakeError = 'Could not save to the shared record — check your connection and tap Resend again.';
      render();
      return;
    }
    STATE.omRecords = fresh;
    STATE.openId = null;
    STATE.omLastRefreshed = nowTime();
    toast(`✓ BMS ${rec.bmsId} resent to Stage 2 docket.`);
  });
  actions.appendChild(sendBtn);
  card.appendChild(actions);
  return card;
}

function Stage2Card(rec){
  const s2 = rec.stage2;
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{}, `Repair Execution — ${rec.bmsId}`));
  card.appendChild(el('div',{class:'sub'}, `${rec.model||'Unknown'} · visit #${rec.visitNumber} · received ${rec.dateReceived}`));

  if(rec.stage1.issues && Object.values(rec.stage1.issues).some(Boolean)){
    const flagged = ISSUE_ITEMS.filter(([k])=>rec.stage1.issues[k]).map(([,l])=>l).join(', ');
    card.appendChild(el('div',{class:'banner'}, 'Reported at intake: '+flagged));
  }

  const sopBox = el('div',{class:'sop-box'});
  sopBox.appendChild(el('div',{style:'font-weight:700;margin-bottom:4px;'},'Standard Operating Procedure (SOP)'));
  sopBox.appendChild(selectInput(s2.sopRef, STANDARD_SOPS.map(s=>[s,s]), v=>s2.sopRef=v));
  card.appendChild(sopBox);

  const g2 = el('div',{class:'grid'});
  g2.appendChild(field('Parts Replaced', textInput(s2.partsReplaced, v=>s2.partsReplaced=v, {placeholder:'e.g. BMS, Harness'})));
  card.appendChild(g2);
  card.appendChild(field('Repair Summary Notes', textareaInput(s2.repairAction, v=>s2.repairAction=v)));

  card.appendChild(ChecklistCard('Post-Service Inspection', s2.post, POST_ITEMS, (k,v)=>s2.post[k]=v));

  if(STATE.intakeError){
    card.appendChild(el('div',{class:'banner err'}, '⚠ '+STATE.intakeError));
  }

  const actions = el('div',{style:'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;'});
  const sendBtn = el('button',{class:'btn-primary', disabled: STATE.intakeSaving}, STATE.intakeSaving ? loadingLabel(true,'Sending…') : 'Send to Stage 3 Docket');
  sendBtn.addEventListener('click', async ()=>{
    if(STATE.intakeSaving) return;
    STATE.intakeError = null;
    s2.technician = STATE.techName;
    s2.completedAt = nowIso();
    rec.stage = 3; rec.status = 'STAGE3_OPEN';
    const fresh = await loadOm();
    const idx = fresh.findIndex(r=>r.id===rec.id);
    if(idx===-1){ STATE.intakeError = 'This record no longer exists in the shared docket — it may have been edited elsewhere. Refreshing.'; STATE.omRecords = fresh; render(); return; }
    fresh[idx] = rec;
    STATE.intakeSaving = true; render();
    const ok = await saveOm(fresh);
    STATE.intakeSaving = false;
    if(!ok){
      STATE.intakeError = 'Could not save to the shared record — check your connection and tap Send again.';
      render();
      return;
    }
    STATE.omRecords = fresh;
    STATE.openId = null;
    STATE.omLastRefreshed = nowTime();
    toast(`✓ BMS ${rec.bmsId} sent to Stage 3 docket.`);
  });
  actions.appendChild(sendBtn);
  card.appendChild(actions);
  return card;
}

function Stage3Card(rec){
  const s3 = rec.stage3;
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{}, `Final Test & QC — ${rec.bmsId}`));
  card.appendChild(el('div',{class:'sub'}, `${rec.model||'Unknown'} · visit #${rec.visitNumber} · repaired by ${rec.stage2.technician||'—'}`));

  card.appendChild(TestsCard(s3));

  const disp = el('div',{class:'card'});
  disp.style.padding='0'; disp.style.border='none'; disp.style.background='transparent'; disp.style.marginBottom='0';
  const dispositionSel = selectInput(s3.qcPassed, [['','— Select Disposition —'],['PASS','PASS'],['FAIL','FAIL — Return for Corrective Action'],['SCRAP','SCRAP — Remove from Fleet']], v=>{ s3.qcPassed=v; render(); });
  card.appendChild(field('Final QC Disposition', dispositionSel));
  card.appendChild(field('QC Notes', textareaInput(s3.qcNote, v=>s3.qcNote=v)));

  let returnTo = 2;
  if(s3.qcPassed==='FAIL'){
    card.appendChild(field('Return Battery To', selectInput('2', [['2','Stage 2 — Repair Again'],['1','Stage 1 — Re-Inspect First']], v=>returnTo=parseInt(v))));
  }

  if(STATE.intakeError){
    card.appendChild(el('div',{class:'banner err'}, '⚠ '+STATE.intakeError));
  }

  const actions = el('div',{style:'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;'});
  const finalizeBtn = el('button',{class: (s3.qcPassed==='FAIL' ? 'btn-capa' : 'btn-primary'), disabled: STATE.intakeSaving},
    STATE.intakeSaving ? loadingLabel(true,'Saving…') : (s3.qcPassed==='FAIL' ? 'Return for Corrective Action' : 'Finalize'));
  finalizeBtn.addEventListener('click', async ()=>{
    if(STATE.intakeSaving) return;
    if(!s3.qcPassed){ toast('Select a final QC disposition first.'); return; }
    STATE.intakeError = null;
    s3.technician = STATE.techName;
    s3.completedAt = nowIso();
    const priorQcPassed = s3.qcPassed;
    if(s3.qcPassed==='PASS'){
      rec.status='CLOSED_PASS'; rec.finalDisposition='PASS'; rec.closedAt = nowIso();
    } else if(s3.qcPassed==='SCRAP'){
      rec.status='CLOSED_SCRAPPED'; rec.finalDisposition='SCRAPPED'; rec.closedAt = nowIso();
    } else {
      rec.capaCycles += 1;
      rec.isCorrectiveAction = true;
      rec.capaLog.push({ cycle: rec.capaCycles, returnedAt: nowIso(), returnedBy: STATE.techName, reason: s3.qcNote, toStage: returnTo });
      rec.stage = returnTo;
      rec.status = returnTo===1 ? 'STAGE1_OPEN' : 'STAGE2_OPEN';
      s3.qcPassed = '';
    }
    const fresh = await loadOm();
    const idx = fresh.findIndex(r=>r.id===rec.id);
    if(idx===-1){ STATE.intakeError = 'This record no longer exists in the shared docket — it may have been edited elsewhere. Refreshing.'; STATE.omRecords = fresh; render(); return; }
    fresh[idx] = rec;
    STATE.intakeSaving = true; render();
    const ok = await saveOm(fresh);
    STATE.intakeSaving = false;
    if(!ok){
      // Roll back the in-memory disposition change so the form doesn't silently drift from
      // what's actually saved, and let the tech retry.
      s3.qcPassed = priorQcPassed;
      STATE.intakeError = 'Could not save to the shared record — check your connection and try again.';
      render();
      return;
    }
    STATE.omRecords = fresh;
    STATE.openId = null;
    STATE.omLastRefreshed = nowTime();
    if(rec.status==='CLOSED_PASS') toast(`✓ BMS ${rec.bmsId} passed final QC and is closed out.`);
    else if(rec.status==='CLOSED_SCRAPPED') toast(`✓ BMS ${rec.bmsId} scrapped and removed from the fleet.`);
    else toast(`✓ BMS ${rec.bmsId} returned to Stage ${returnTo} for corrective action (not counted as a new repeat failure).`);
  });
  actions.appendChild(finalizeBtn);
  disp.appendChild(actions);
  card.appendChild(disp);
  return card;
}

function OmTechClosedView(){
  const stage = STATE.stage;
  const key = `stage${stage}`;
  const list = STATE.omRecords.filter(r => r[key].technician===STATE.techName).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Work Completed By Me'));
  card.appendChild(el('div',{class:'sub'}, `Records where you completed the Stage ${stage} step. Total: ${list.length}`));
  if(list.length===0){ card.appendChild(el('div',{class:'empty-note'},'No records yet.')); return card; }

  const wrap = el('div',{class:'table-wrap'});
  const tbl = el('table');
  tbl.appendChild(el('thead',{},[el('tr',{},[
    el('th',{},'BMS ID'), el('th',{},'Platform'), el('th',{},'Visit'), el('th',{},'CAPA Cycles'), el('th',{},'Current Status')
  ])]));
  const tbody = el('tbody');
  list.forEach(r=>{
    const tr = el('tr',{},[
      el('td',{class:'mono'}, r.bmsId),
      el('td',{}, r.model||'Unknown'),
      el('td',{class:'mono'}, '#'+r.visitNumber),
      el('td',{}, r.capaCycles>0 ? el('span',{class:'status-chip CAPA'},'Cycle '+r.capaCycles) : '—'),
      el('td',{}, el('span',{class:'status-chip '+r.status}, r.status.replace('_',' ')))
    ]);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  card.appendChild(wrap);
  return card;
}
