/* ---------- Utilities ---------- */
function todayStr(){ return new Date().toISOString().slice(0,10); }
function nowTime(){ return new Date().toTimeString().slice(0,5); }
function nowIso(){ return new Date().toISOString(); }
function uid(){ return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function parseIdList(text){
  if(!text) return [];
  const parts = text.split(/[\n,]+/).map(s=>s.trim().toUpperCase()).filter(Boolean);
  return Array.from(new Set(parts));
}

function checklistResult(map, items){
  const vals = items.map(([k])=>map[k]);
  if(vals.some(v=>v==='FAIL')) return 'FAIL';
  if(vals.some(v=>!v)) return 'INCOMPLETE';
  return 'PASS';
}
function testsResult(d){
  const boolsOk = TEST_BOOLS.every(([k])=>d.testBools[k]===true);
  const ir = parseFloat(d.tests.irMeasured), thr = parseFloat(d.tests.irThreshold);
  const irOk = !isNaN(ir) && !isNaN(thr) ? ir>=thr : null;
  if(!boolsOk || irOk===false) return 'FAIL';
  if(irOk===null) return 'INCOMPLETE';
  return 'PASS';
}
function isImeiRequired(d){ return !!(d.issues.noPower || d.issues.bmsFault || d.issues.iotFault); }
function isSwapStationRequired(d){ return !!(d.issues.tampered || d.issues.swelling || d.pre.foreignObjects==='FAIL' || d.pre.corrosion==='FAIL'); }
