function DataIntegrityView(){
  const container = el('div');
  container.appendChild(el('div',{class:'sector-tag'},'Data Integrity — find and remove duplicate battery numbers across the pipeline'));

  if(STATE.omRecords && STATE.omRecords.length>0){
    const omDupGroups = findDuplicateOpenOmGroups(STATE.omRecords);
    const card = el('div',{class:'card'});
    card.appendChild(el('h3',{},'Duplicate Open O&M Chain Records'));
    card.appendChild(el('div',{class:'sub'},'Same BMS ID open in the pipeline more than once. Keeping the most recent and removing older duplicate(s) is usually correct.'));
    if(omDupGroups.length===0){ card.appendChild(el('div',{class:'empty-note'},'No duplicates found.')); }
    omDupGroups.forEach(group=>{
      const keep = group[group.length-1];
      const box = el('div',{class:'sop-box'});
      box.appendChild(el('div',{style:'font-weight:700;margin-bottom:6px;'}, group[0].bmsId+' — '+group.length+' open records'));
      group.forEach(r=>{
        const row = el('div',{class:'docket-item'});
        row.appendChild(el('div',{},[
          el('div',{}, `Stage ${r.stage} · ${r.status} · visit #${r.visitNumber}`),
          el('div',{class:'meta'}, `Created ${r.createdAt.slice(0,16).replace('T',' ')}` + (r.id===keep.id ? ' — kept (most recent)' : ''))
        ]));
        if(r.id!==keep.id){
          const rmBtn = el('button',{class:'btn-danger btn-sm', disabled:STATE.integrityBusy}, 'Remove this duplicate');
          rmBtn.addEventListener('click', async ()=>{
            STATE.integrityBusy = true; render();
            const fresh = await loadOm();
            const updated = fresh.filter(x=>x.id!==r.id);
            const ok = await saveOm(updated);
            STATE.integrityBusy = false;
            if(!ok){ toast('⚠ Could not remove — try again.'); render(); return; }
            STATE.omRecords = updated;
            toast(`Removed duplicate record for ${r.bmsId}.`);
          });
          row.appendChild(rmBtn);
        }
        box.appendChild(row);
      });
      card.appendChild(box);
    });
    container.appendChild(card);
  }

  if(STATE.plantStockRecords){
    const oemDups = findDuplicateOemIdOccurrences(STATE.plantStockRecords);
    const card = el('div',{class:'card'});
    card.appendChild(el('h3',{},'Duplicate OEM Battery IDs in the Stock Ledger'));
    card.appendChild(el('div',{class:'sub'},'The same OEM ID logged as received or dispatched on more than one date for the same platform. Keeping the earliest date and removing later duplicate(s) keeps totals accurate.'));
    if(oemDups.length===0){ card.appendChild(el('div',{class:'empty-note'},'No duplicate OEM IDs found.')); }
    oemDups.forEach(dup=>{
      const meta = PLATFORM_META[dup.platform];
      const box = el('div',{class:'sop-box'});
      box.appendChild(el('div',{style:'font-weight:700;margin-bottom:6px;'}, `${meta.emoji} ${meta.label} · ${dup.direction==='received'?'Received':'Dispatched'} · ${dup.id}`));
      dup.occurrences.forEach((occ,idx)=>{
        const row = el('div',{class:'docket-item'});
        row.appendChild(el('div',{}, occ.date + (idx===0 ? ' — kept (earliest)' : '')));
        if(idx>0){
          const rmBtn = el('button',{class:'btn-danger btn-sm', disabled:STATE.integrityBusy}, 'Remove this duplicate');
          rmBtn.addEventListener('click', async ()=>{
            STATE.integrityBusy = true; render();
            const fresh = await loadPlantStock();
            const updated = fresh.map(r=>{
              if(r.id!==occ.recordId) return r;
              const key = dup.direction==='received' ? 'receivedIds' : 'dispatchedIds';
              return { ...r, [key]: (r[key]||[]).filter(x=>x!==dup.id) };
            });
            const ok = await savePlantStock(updated);
            STATE.integrityBusy = false;
            if(!ok){ toast('⚠ Could not remove — try again.'); render(); return; }
            STATE.plantStockRecords = updated;
            toast(`Removed duplicate ${dup.id} from ${occ.date}.`);
          });
          row.appendChild(rmBtn);
        }
        box.appendChild(row);
      });
      card.appendChild(box);
    });
    container.appendChild(card);
  }

  if(STATE.warrantyRecords){
    const wDups = findDuplicateActiveWarrantyGroups(STATE.warrantyRecords);
    const card = el('div',{class:'card'});
    card.appendChild(el('h3',{},'Duplicate Active Warranty Escalations'));
    card.appendChild(el('div',{class:'sub'},'Same BMS ID escalated to warranty more than once while still active. Keeping the earliest escalation and removing later duplicate(s) is usually correct.'));
    if(wDups.length===0){ card.appendChild(el('div',{class:'empty-note'},'No duplicates found.')); }
    wDups.forEach(group=>{
      const keep = group[0];
      const box = el('div',{class:'sop-box'});
      box.appendChild(el('div',{style:'font-weight:700;margin-bottom:6px;'}, group[0].bmsId+' — '+group.length+' active escalations'));
      group.forEach(w=>{
        const row = el('div',{class:'docket-item'});
        row.appendChild(el('div',{},[
          el('div',{}, `${w.failureCategory} · ${w.status}`),
          el('div',{class:'meta'}, `Escalated ${w.dateEscalated}` + (w.id===keep.id ? ' — kept (earliest)' : ''))
        ]));
        if(w.id!==keep.id){
          const rmBtn = el('button',{class:'btn-danger btn-sm', disabled:STATE.integrityBusy}, 'Remove this duplicate');
          rmBtn.addEventListener('click', async ()=>{
            STATE.integrityBusy = true; render();
            const fresh = await loadWarranty();
            const updated = fresh.filter(x=>x.id!==w.id);
            const ok = await saveWarranty(updated);
            STATE.integrityBusy = false;
            if(!ok){ toast('⚠ Could not remove — try again.'); render(); return; }
            STATE.warrantyRecords = updated;
            toast(`Removed duplicate escalation for ${w.bmsId}.`);
          });
          row.appendChild(rmBtn);
        }
        box.appendChild(row);
      });
      card.appendChild(box);
    });
    container.appendChild(card);
  }

  return container;
}
