/* ---------- App state ---------- */
let STATE = {
  role: null,
  stage: null,
  techName: '',
  view: 'main',
  toast: null,

  omRecords: [],
  plantRecords: [],
  plantStockRecords: [],
  newBatteryRecords: [],
  adjustments: [],
  warrantyRecords: [],

  intakeDraft: emptyIntakeDraft(''),
  openId: null,
  serialWarning: null,
  intakeError: null,
  omLastRefreshed: null,
  omSyncOk: true,        // false when the last background/manual sync attempt failed
  intakeSaving: false,   // true while a Send-to-Stage-2 write is in flight (disables the button, prevents double-submit)

  plantDraft: null,
  plantSaving: false,
  bulkStockDraft: emptyBulkStockDraft(),
  bulkStockSaving: false,
  bulkStockError: null,
  newBatteryDraft: null,
  newBatterySaving: false,
  adjustmentDraft: null,
  adjustmentSaving: false,
  warrantyDraft: null,
  warrantySaving: false,
  integrityBusy: false,
  exportingExcel: false,
};

function toast(msg){ STATE.toast = msg; render(); setTimeout(()=>{ STATE.toast=null; render(); }, 2800); }
