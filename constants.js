/* ---------- Credentials / labels ---------- */
const STAGE_LABEL = { 1: 'Stage 1 — Intake & Pre-Check', 2: 'Stage 2 — Repair & Reassembly', 3: 'Stage 3 — Final Test & QC Sign-off' };
const SECTOR_LABEL = { omadmin: 'O&M Manager', plant: 'Plant & Inventory', inventory: 'Plant & Inventory', quality: 'Quality Engineer' };

/* ---------- Domain constants ---------- */
const STANDARD_SOPS = [
  "SOP-BAT-01: Housing Opening Protocol",
  "SOP-BAT-02: Cell Balancing & Diagnostics",
  "SOP-BAT-03: BMS Replacement & Firmware Sync",
  "SOP-BAT-04: Insulation Safety Testing",
  "SOP-BAT-05: IoT Rewiring & Flashing",
  "SOP-BAT-06: Charge Port Thermal Servicing"
];

const BMS_MODEL_PREFIXES = [
  { prefix: 'C7245AC2AA', model: 'CBAK' },
  { prefix: 'U7245AU1G1', model: 'UNIQUE' },
  { prefix: 'A7246AX1A1', model: 'AMPACE' },
  { prefix: 'D72451LWK', model: 'GREENWAY' }
];
function detectModelFromBMS(bmsId) {
  if (!bmsId) return '';
  const cleanId = bmsId.trim().toUpperCase();
  const match = BMS_MODEL_PREFIXES.find(p => cleanId.startsWith(p.prefix));
  return match ? match.model : '';
}

const CHECK_ITEMS = [
  ['foreignObjects','No Foreign Objects / Cables'],
  ['looseComponents','No Loose Components'],
  ['wiring','Internal Wiring Intact'],
  ['cells','Cells Intact'],
  ['corrosion','No Moisture / Corrosion'],
  ['bmsMount','BMS Board Secure'],
  ['internalDamage','No Internal Damage'],
];
const POST_ITEMS = [
  ['foreignObjects','No Foreign Objects Left Inside'],
  ['looseComponents','No Loose Components'],
  ['wiring','Wiring Reconnected Properly'],
  ['cells','Cells Secure'],
  ['bmsMount','BMS Board Secure'],
  ['seal','Casing Seal Intact'],
  ['fasteners','Fasteners Reinstalled'],
];
const ISSUE_ITEMS = [
  ['noPower','No Power / Offline'],
  ['lowCapacity','Low Capacity / Range'],
  ['cellImbalance','Cell Imbalance'],
  ['bmsFault','BMS Fault / Mismatch'],
  ['canFail','CAN Fail'],
  ['chargeFail','Charge Failure'],
  ['dischargeFail','Discharge Failure'],
  ['swelling','Swelling / Damage'],
  ['irFail','Insulation Failure'],
  ['iotFault','IoT / IMEI Mismatch'],
  ['tampered','Vandalism / Water Ingress'],
  ['connectorDamage','Connector Damage'],
  ['other','Other Issue'],
];
const TEST_BOOLS = [
  ['canEstablished','CAN Established'],
  ['bmsFaultCleared','BMS Fault Cleared'],
  ['chargeVerified','Charge Verified'],
  ['dischargeVerified','Discharge Verified'],
  ['noAbnormal','No Abnormal Behavior'],
];
const PLATFORMS = ['CBAK','UNIQUE','AMPACE','GREENWAY'];
const PLATFORM_META = {
  CBAK: { emoji: '🟡', label: 'CBAK' },
  UNIQUE: { emoji: '🟠', label: 'UNIQUE' },
  AMPACE: { emoji: '🟤', label: 'AMPACE' },
  GREENWAY: { emoji: '🟢', label: 'GREENWAY' },
};
const MOVEMENT_TYPES = [
  ['ISSUED_TO_PLANT','Issued to Plant'],
  ['ISSUED_TO_SWAP_STATION','Issued to Swap Station'],
  ['DAMAGED_ON_ARRIVAL','Damaged on Arrival'],
  ['RETURNED_TO_SUPPLIER','Returned to Supplier'],
  ['CORRECTION_ADD','Stock Correction (Add)'],
  ['CORRECTION_SUB','Stock Correction (Subtract)'],
];
function movementDirection(type){ return (type==='RECEIVED' || type==='CORRECTION_ADD') ? 1 : -1; }
function movementLabel(type){
  if(type==='RECEIVED') return 'Received (New Stock)';
  const f = MOVEMENT_TYPES.find(([k])=>k===type);
  return f ? f[1] : type;
}
