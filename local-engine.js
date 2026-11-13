/* Achievers dashboard — answers filters in the browser.
 * After login the page downloads only the rows this person may see (cut on the server by Code.gs's own access
 * rules; no passwords, dates of joining or other people's sessions). This file runs the SAME Code.gs on that data,
 * so getView / getOrders / getTrend return exactly what the server would, without a round trip.
 * Anything the local copy cannot answer goes to the server as before. Built by scripts/build-web.mjs. */
(function () {
  'use strict';
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256(bytes) {
  const len = bytes.length, bitLenHi = Math.floor(len / 0x20000000), bitLenLo = (len << 3) >>> 0;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, bitLenHi); dv.setUint32(padded.length - 4, bitLenLo);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32), odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i]);
  return out;
}

  var props = new Map(), mem = new Map(), TZ = 'Asia/Kolkata', needServer = false;
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64WebSafe(b) { var o = '', i = 0, n; for (; i + 2 < b.length; i += 3) { n = ((b[i] & 255) << 16) | ((b[i + 1] & 255) << 8) | (b[i + 2] & 255); o += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]; }
    if (i < b.length) { n = ((b[i] & 255) << 16) | ((i + 1 < b.length ? b[i + 1] & 255 : 0) << 8); o += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + '='; } return o; }
  var FMT = {};
  function formatDate(d, tz, fmt) {
    var z = tz || TZ, f = FMT[z] || (FMT[z] = new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }));
    var p = {}; f.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    var Y = +p.year, M = +p.month, D = +p.day, H = +p.hour % 24, mi = +p.minute, s = +p.second, wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    return String(fmt).replace(/'([^']*)'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|m|ss|s|SSS|a/g, function (t, lit) {
      if (lit !== undefined) return lit;
      switch (t) { case 'yyyy': return String(Y); case 'yy': return pad(Y % 100); case 'MMMM': return MONTH[M - 1]; case 'MMM': return MON[M - 1]; case 'MM': return pad(M); case 'M': return String(M);
        case 'dd': return pad(D); case 'd': return String(D); case 'EEEE': return DAY[wd]; case 'EEE': return DAY[wd].slice(0, 3); case 'HH': return pad(H); case 'H': return String(H);
        case 'hh': return pad(H % 12 || 12); case 'h': return String(H % 12 || 12); case 'mm': return pad(mi); case 'm': return String(mi); case 'ss': return pad(s); case 's': return String(s);
        case 'SSS': return pad(d.getMilliseconds(), 3); case 'a': return H < 12 ? 'AM' : 'PM'; }
      return t; });
  }
  var enc = new TextEncoder();
  var Utilities = { DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
    computeDigest: function (a, v) { return Array.from(sha256(typeof v === 'string' ? enc.encode(v) : Uint8Array.from(v, function (x) { return x & 255; })), function (x) { return x > 127 ? x - 256 : x; }); },
    base64EncodeWebSafe: function (b) { return b64WebSafe(typeof b === 'string' ? enc.encode(b) : b); },
    getUuid: function () { return crypto.randomUUID(); }, formatDate: formatDate, sleep: function () {} };
  var scriptProps = {
    getProperty: function (k) { return props.has(String(k)) ? props.get(String(k)) : null; },
    setProperty: function (k, v) { props.set(String(k), String(v)); return scriptProps; },
    deleteProperty: function (k) { props.delete(String(k)); return scriptProps; },
    getProperties: function () { var o = {}; props.forEach(function (v, k) { o[k] = v; }); return o; }
  };
  var PropertiesService = { getScriptProperties: function () { return scriptProps; } };
  function cget(k) { var e = mem.get(String(k)); if (!e) return null; if (e.exp && e.exp < Date.now()) { mem.delete(String(k)); return null; } return e.v; }
  var scriptCache = {
    get: cget, getAll: function (ks) { var o = {}; (ks || []).forEach(function (k) { var v = cget(k); if (v != null) o[k] = v; }); return o; },
    put: function (k, v, ttl) { mem.set(String(k), { v: String(v), exp: Date.now() + Math.min(21600, Number(ttl) || 600) * 1000 }); },
    putAll: function (o, ttl) { Object.keys(o || {}).forEach(function (k) { scriptCache.put(k, o[k], ttl); }); },
    remove: function (k) { mem.delete(String(k)); }, removeAll: function (ks) { (ks || []).forEach(function (k) { mem.delete(String(k)); }); }
  };
  var CacheService = { getScriptCache: function () { return scriptCache; } };
  var lock = { tryLock: function () { return true; }, waitLock: function () {}, releaseLock: function () {}, hasLock: function () { return true; } };
  var LockService = { getScriptLock: function () { return lock; } };
  function server() { needServer = true; throw new Error('__NEEDS_SERVER__'); }   // the local copy has no sheets: ask the server
  var SpreadsheetApp = { getActiveSpreadsheet: function () { return { getSheetByName: server, getSheets: server, getSpreadsheetTimeZone: function () { return TZ; } }; }, openById: server, getUi: server, flush: function () {} };
  var ScriptApp = { getProjectTriggers: function () { return []; }, deleteTrigger: function () {}, newTrigger: server };
  var HtmlService = { XFrameOptionsMode: { DEFAULT: 'DEFAULT' }, createTemplateFromFile: server };
  var Session = { getScriptTimeZone: function () { return TZ; } };
  var Logger = { log: function () {} };
  var console = { log: function () {}, info: function () {}, warn: function () {}, error: function () { if (!needServer) window.console.error.apply(window.console, arguments); } };

  /* ======================= apps-script/Code.gs (verbatim) ======================= */
/**
 * Achievers Incentive Dashboard — Google Apps Script backend (Code.gs)
 *
 * Every public function (no trailing underscore) is callable from the browser via
 * google.script.run. Each one validates the session token server-side, derives the
 * user's identity/role from the server session (never from the browser), applies
 * hierarchy authorization, applies the FY/month filter and returns only authorized,
 * whitelisted fields. Passwords never leave the server.
 */

/* ============================================================================
 * 1. CONFIGURATION
 * ==========================================================================*/
var CONFIG = Object.freeze({
  APP_NAME: 'Achievers Incentive Dashboard',
  SPREADSHEET_ID: '',              // Leave blank if this script is bound to the sheet; otherwise paste the ID.
  ADMIN_EMAILS: ['adminincentive@infinitylearn.com', 'atulkumar.singh@infinitylearn.com','arunesh.kumar@infinitylearn.com','viraj.p@infinitylearn.com','nadim.mumtaz@infinitylearn.com','ujjwal@infinitylearn.com'],
  SESSION: { ABSOLUTE_SEC: 8 * 3600, IDLE_SEC: 30 * 60, TOUCH_SEC: 60, PREFIX: 'mve_s_' },
  LOGIN: { MAX_ATTEMPTS: 5, LOCK_SEC: 15 * 60 },
  PASSWORD: { MIN_LENGTH: 8, HASH_ROUNDS: 150 },
  CACHE_SEC: 21600,                // 6 h (CacheService maximum); cleared on every sheet edit and refreshed hourly by warmDashboardCache
  RESULT_CACHE_SEC: 300,           // recently built views, per user + exact filters (5 min)
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
  EXPORT_MAX_ROWS: 5000,
  SHEETS: {
    EMPLOYEES: 'Employees',
    ORDER_BASE: 'Order_Base',
    LOGIN_ACTIVITY: 'Login_Activity_2026',   // existing sheet — reused, never created by this script
    INCENTIVES: { L0: 'L0_Incentives', L1: 'L1_Incentives', L2: 'L2_Incentives', L3: 'L3_Incentives', L4: 'L4_Incentives' }
  },
  NULL_TOKENS: ['', 'na', 'n/a', '-', '--', 'none', 'null', '#n/a', 'not applicable'],
  DIRECT: '__DIRECT__'             // pseudo-node: rows whose manager at a level is "na" (e.g. L3_Email = na → report straight to L4)
});

/** Centralized column mapping — names taken from Achievers_Dashboard workbook. */
var COLS = Object.freeze({
  EMP: { email: 'Email', id: 'Emp_Id', name: 'Emp_Name', role: 'Role', doj: 'DOJ', status: 'Status', lwd: 'LWD', password: 'Password' },
  INC: { month: 'Month', id: 'Emp_ID', name: 'Emp_Name', email: 'Emp_Email', role: 'Role',
         final: 'Final_Incentive', reward: 'Additional_Reward', paid: 'Paid_Amount', paidStatus: 'Paid_Status' },
  UPLINE: { L1: 'L1_Email', L2: 'L2_Email', L3: 'L3_Email', L4: 'L4_Email', L5: 'L5_Email', ADMIN: 'Admin_Email' },
  ORD: { month: 'Month', admin: 'Admin_Email', L5: 'L5_Email', L4: 'L4_Email', L3: 'L3_Email', L2: 'L2_Email', L1: 'L1_Email',
         booker: 'L0_Booker_Email', closer: 'L0_Closer_Email', cycle: 'Cycle', share: 'Share_Tag',
         bookerCredit: 'Booker_Credit', closerCredit: 'Closer_Credit', saleType: 'Sale_Type', invoice: 'Invoice_ID',
         amount: 'Order_Amount', status: 'Order_Status', customerId: 'User_Id', customer: 'Customer_Name', payMode: 'Payment_Mode',
         loanProvider: 'Loan_Provider', loanStatus: 'Loan_Status', saleDate: 'Sale_Date', invoiceDate: 'Invoice_Date',
         payDate: 'Payment_Date', disbDate: 'Loan_Disbursed_Date', eligible: 'Eligible_Amount', remarks: 'Remarks' }
});

var LEVEL_RANK = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5, ADMIN: 9 };
var DRILL_LEVELS = ['L4', 'L3', 'L2', 'L1', 'L0'];   // hierarchy L5 → L4 → L3 → L2 → L1 → L0 (L5/Admin see everything below)

/** Per-level headline metric columns. "target"/"ach" arrays are summed when the monthly column is NA. */
var LEVEL_METRICS = {
  L0: { target: null, targetParts: ['C1_Revenue_Target', 'C2_Revenue_Target'], ach: 'Monthly_Revenue', achParts: ['C1_Revenue_Achieved', 'C2_Revenue_Achieved'], pct: null,
        cycleInc: '{c}_Incentive_Payout', cyclePct: null, cycleStatus: '{c}_Slab_Reached', group: 'Campaign', tier: 'Final_Tier', reason: ['Eligibility_Reason'] },
  L1: { target: 'Monthly_Target', targetAlt: 'Month_Target_1', targetParts: ['C1_Revenue_Target', 'C2_Revenue_Target'], ach: 'Monthly_Ach', achParts: ['C1_Revenue_Achieved', 'C2_Revenue_Achieved'], pct: 'Monthly_Ach%',
        cycleInc: '{c}_Final_Incentive', cyclePct: '{c}_Achievement_%', cycleStatus: '{c}_Eligibility', group: 'Pool', tier: 'Pool', reason: ['Monthly_Eligibility_Reason', 'C2_Eligibility_Reason', 'C1_Eligibility_Reason'] },
  L2: { target: 'Monthly_Target', targetParts: ['C1_Revenue_Target', 'C2_Revenue_Target'], ach: 'Monthly_Ach', achParts: ['C1_Revenue_Achieved', 'C2_Revenue_Achieved'], pct: 'Monthly_Ach%',
        cycleInc: '{c}_Base_Payout', cyclePct: '{c}_Achievement_%', cycleStatus: '{c}_Eligibility', group: 'Pool', tier: 'Pool', reason: ['Monthly_Eligibility_Reason', 'C2_Eligibility_Reason', 'C1_Eligibility_Reason'] },
  L3: { target: 'Monthly_Revenue_Target', targetParts: ['C1_Revenue_Target', 'C2_Revenue_Target'], ach: 'Monthly_Revenue_Achieved', achParts: ['C1_Revenue_Achieved', 'C2_Revenue_Achieved'], pct: 'Monthly_Achievement_%',
        cycleInc: null, cyclePct: '{c}_Achievement_%', cycleStatus: null, group: null, tier: null, reason: ['Eligibility_Reason'] }
};
LEVEL_METRICS.L4 = {                     // same as L3; when the monthly target is NA the Digital + Offline channel targets apply
  target: 'Monthly_Revenue_Target', targetParts: ['Digital_Target', 'Offline_Target'], ach: 'Monthly_Revenue_Achieved', achParts: ['Digital_Achieved', 'Offline_Achieved'], pct: 'Monthly_Achievement_%',
  cycleInc: null, cyclePct: '{c}_Achievement_%', cycleStatus: null, group: null, tier: null, reason: ['Eligibility_Reason'] };

/** Structured scorecards. Types: currency | percent | number | multiplier | text | badge. {c} = C1/C2.
 *  Optional 4th item value = fallback text: the row is always shown, with this text when the cell is blank. */
var PAYOUT_SECTION = { title: 'Payout', items: [['Final incentive', 'Final_Incentive', 'currency'], ['Paid amount', 'Paid_Amount', 'currency'], ['Paid status', 'Paid_Status', 'badge'], ['Additional reward', 'Additional_Reward', 'text', 'No Rewards'], ['Gift basket', 'Gift_Basket', 'text', 'No Gifts']] };   // always shown; 4th value = text when the cell is blank
var SCORECARDS = {
  L0: {
    cycle: [
      ['Original revenue target', 'Original_{c}_Revenue_Target', 'currency'], ['Revenue target', '{c}_Revenue_Target', 'currency'],
      ['Revenue achieved', '{c}_Revenue_Achieved', 'currency'], ['Achievement %', { calc: 'pct', a: '{c}_Revenue_Achieved', b: '{c}_Revenue_Target' }, 'percent'],
      ['Demo target', '{c}_Demo_Target', 'number'], ['Valid demos', '{c}_Valid_Demos', 'number'], ['Demo eligibility', '{c}_Demo_Eligibility', 'badge'],
      ['Grace applied', '{c}_Grace', 'text'], ['Slab reached', '{c}_Slab_Reached', 'badge'], ['Slab hit', '{c}_Slab_Hit?', 'badge'],
      ['Incentive %', '{c}_Incentive_%', 'percent'], ['Cycle payout', '{c}_Incentive_Payout', 'currency'], ['T1 route payout', 'T1_Route_{c}_Payout', 'currency']
    ],
    sections: [
      { title: 'Plan and tier', items: [['Campaign', 'Campaign', 'text'], ['Original tier', 'Original_Tier', 'badge'], ['T1 upgrade', 'T1_Upgrade?', 'text'], ['Final tier', 'Final_Tier', 'badge'], ['Applicable structure', 'Applicable_Structure', 'text'], ['Multiplier', 'Multiplier', 'multiplier'], ['Winning route', 'Winning_Route', 'text']] },
      { title: 'Route evaluation', items: [['Cycle-slab route', 'Cycle-Slab_Route', 'currency'], ['Original route incentive', 'Original_Route_Incentive', 'currency'], ['T1 route incentive', 'T1_Route_Incentive', 'currency'], ['T1 route kicker', 'T1_Route_Kicker', 'currency'], ['Monthly route', 'Monthly_Route', 'text'], ['Monthly route target', 'Monthly_Route_Target', 'currency'], ['Monthly route orders', 'Month_Orders', 'number'], ['Monthly route %', 'Monthly_Route_%', 'percent'], ['Monthly kicker', 'Monthly_Kicker', 'currency'], ['Selected route', 'Selected_Route', 'badge']] },
      PAYOUT_SECTION
    ]
  },
  L1: {
    cycle: [
      ['Actual team size', '{c}_Actual_Team_Size', 'number'], ['PPP team size', '{c}_PPP_Team_Size', 'number'], ['Revenue achieved', '{c}_Revenue_Achieved', 'currency'],
      ['PPP (revenue per person)', '{c}_PPP', 'currency'], ['Minimum eligibility revenue', '{c}_Base_Eligibility', 'currency'], ['Exit count', '{c}_Exit_Count', 'number'],
      ['Retention threshold', '{c}_Retention_Eligibility_Threshold', 'text'], ['Revenue target', '{c}_Revenue_Target', 'currency'], ['Achievement %', '{c}_Achievement_%', 'percent'],
      ['Overall rank', '{c}_Overall_Rank', 'number'], ['Eligible pool rank', '{c}_Eligible_Pool_Rank', 'number'], ['Eligibility', '{c}_Eligibility', 'badge'],
      ['Incentive %', '{c}_Incentive_%', 'percent'], ['Cap', '{c}_Cap', 'currency'], ['Base payout', '{c}_Base_Payout', 'currency'],
      ['Retention bonus', '{c}_Retention_Bonus', 'currency'], ['Retention penalty', '{c}_Retention_Penalty', 'currency'], ['Final cycle incentive', '{c}_Final_Incentive', 'currency'],
      ['Reason', '{c}_Eligibility_Reason', 'text']
    ],
    sections: [
      { title: 'Pool', items: [['Pool', 'Pool', 'badge']] },
      { title: 'Monthly evaluation', items: [['Monthly target 1', 'Month_Target_1', 'currency'], ['Monthly target 2', 'Month_Target_2', 'currency'], ['Monthly target', 'Monthly_Target', 'currency'], ['Monthly achieved', 'Monthly_Ach', 'currency'], ['Monthly achievement %', 'Monthly_Ach%', 'percent'], ['Monthly rate', 'Monthly_Rate', 'percent'], ['Monthly reason', 'Monthly_Eligibility_Reason', 'text']] },
      PAYOUT_SECTION
    ]
  },
  L2: {
    cycle: [
      ['Revenue target', '{c}_Revenue_Target', 'currency'], ['Revenue achieved', '{c}_Revenue_Achieved', 'currency'], ['Achievement %', '{c}_Achievement_%', 'percent'],
      ['Team size', '{c}_Team_Size', 'number'], ['Raw PPP', '{c}_RAW_PPP', 'currency'], ['Team size multiplier', '{c}_Team_Size_Multiplier', 'multiplier'],
      ['PPP (revenue per person)', '{c}_PPP', 'currency'], ['Rank', '{c}_Rank', 'number'], ['Eligibility bar', '{c}_Eligibility_Bar', 'currency'],
      ['Revenue on a qualifying team (×0.8)', '{c}_Revenue_on_a_QUALIFYING_team_(x0.8)', 'currency'], ['Revenue on other teams (×1.0)', '{c}_Revenue_on_other_teams_(x1.0)', 'currency'],
      ['Effective geography factor', '{c}_EFFECTIVE_geography_factor', 'multiplier'],
      ['Eligibility', '{c}_Eligibility', 'badge'], ['Incentive % / rate', '{c}_Incentive_%', 'percent'], ['Base payout', '{c}_Base_Payout', 'currency'], ['Reason', '{c}_Eligibility_Reason', 'text']
    ],
    sections: [
      { title: 'Pool', items: [['Pool', 'Pool', 'badge']] },
      { title: 'Monthly evaluation', items: [['Monthly target', 'Monthly_Target', 'currency'], ['Monthly achieved', 'Monthly_Ach', 'currency'], ['Monthly achievement %', 'Monthly_Ach%', 'percent'], ['Monthly rate', 'Monthly_Rate', 'percent'], ['Monthly reason', 'Monthly_Eligibility_Reason', 'text']] },
      PAYOUT_SECTION
    ]
  },
  L3: {
    cycle: [
      ['Revenue target', '{c}_Revenue_Target', 'currency'], ['Revenue achieved', '{c}_Revenue_Achieved', 'currency'], ['Achievement %', '{c}_Achievement_%', 'percent']
    ],
    sections: [
      { title: 'Monthly evaluation', items: [['Revenue target', 'Monthly_Revenue_Target', 'currency'], ['Revenue achieved', 'Monthly_Revenue_Achieved', 'currency'], ['Achievement %', 'Monthly_Achievement_%', 'percent'], ['Rank', 'Rank', 'number'], ['Eligibility', 'Eligibility', 'badge'], ['Incentive %', 'Incentive_%', 'percent'], ['Base payout', 'Base_Payout', 'currency'], ['Reason', 'Eligibility_Reason', 'text']] },
      PAYOUT_SECTION
    ]
  }
};

SCORECARDS.L4 = {                        // L3 structure + the Digital / Offline channel split in L4_Incentives
  cycle: SCORECARDS.L3.cycle,
  sections: [
    SCORECARDS.L3.sections[0],
    { title: 'Digital channel', items: [['Target', 'Digital_Target', 'currency'], ['Achieved', 'Digital_Achieved', 'currency'], ['Achieved %', 'Digital_Achieved_%', 'percent'], ['Rate', 'Digital_Rate', 'percent'], ['Payout', 'Digital_Payout', 'currency']] },
    { title: 'Offline channel', items: [['Target', 'Offline_Target', 'currency'], ['Achieved', 'Offline_Achieved', 'currency'], ['Achieved %', 'Offline_Achieved_%', 'percent'], ['Rate', 'Offline_Rate', 'percent'], ['Payout', 'Offline_Payout', 'currency']] },
    PAYOUT_SECTION
  ]
};

/** Order columns returned to the browser (whitelist). */
var ORDER_COLUMNS = [
  { key: 'invoice', label: 'Invoice ID', type: 'text' }, { key: 'customerId', label: 'Customer ID', type: 'text' }, { key: 'customer', label: 'Customer name', type: 'text' },
  { key: 'cycle', label: 'Cycle', type: 'text' }, { key: 'booker', label: 'Booker', type: 'text' },
  { key: 'closer', label: 'Closer', type: 'text' }, { key: 'l1', label: 'L1', type: 'text' },
  { key: 'saleType', label: 'Sale type', type: 'text' }, { key: 'share', label: 'Share', type: 'text' },
  { key: 'payMode', label: 'Payment mode', type: 'text' }, { key: 'loanProvider', label: 'Loan provider', type: 'text' },
  { key: 'orderStatus', label: 'Order status', type: 'text' }, { key: 'amount', label: 'Order amount', type: 'currency' },
  { key: 'eligible', label: 'Eligible amount', type: 'currency' }, { key: 'credited', label: 'Credited to selection', type: 'currency' },
  { key: 'saleDate', label: 'Sale date', type: 'date' }, { key: 'payDate', label: 'Payment date', type: 'date' },
  { key: 'remarks', label: 'Remarks', type: 'text' }
];

/* ============================================================================
 * 2. WEB APP ENTRY
 * ==========================================================================*/
function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** Optional sheet menu for admins who edit data. */
function onOpen() {
  try { SpreadsheetApp.getUi().createMenu('Achievers').addItem('Refresh dashboard cache', 'clearDashboardCache').addItem('Install hourly cache refresh', 'installCacheWarmTrigger').addItem('Purge expired sessions', 'purgeExpiredSessions').addToUi(); } catch (e) {}
}
/** Simple trigger: any sheet edit invalidates cached data. */
function onEdit() { bumpDataVersion_(); }
function clearDashboardCache() { warmDashboardCache(); return 'Cache refreshed'; }
/** Re-reads the sheets and rebuilds every cache now, so the next user never waits for a cold load.
 *  Run by the hourly trigger (also picks up data written by imports/scripts, which do not fire onEdit). */
function warmDashboardCache() {
  bumpDataVersion_();
  buildPartitions_();
  employeeIndex_();
  availablePeriods_();
  return 'Cache warmed';
}
/** One-time setup (run from the editor or the Achievers menu): refresh the cache every hour. */
function installCacheWarmTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'warmDashboardCache') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('warmDashboardCache').timeBased().everyHours(1).create();
  warmDashboardCache();
  return 'Hourly cache refresh installed';
}

/* ============================================================================
 * 3. UTILITIES
 * ==========================================================================*/
var MEMO_ = {};
function getSpreadsheet_() {
  if (MEMO_.ss) return MEMO_.ss;
  MEMO_.ss = CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!MEMO_.ss) throw new Error('Spreadsheet not found. Set CONFIG.SPREADSHEET_ID.');
  return MEMO_.ss;
}
function tz_() { if (!MEMO_.tz) { try { MEMO_.tz = getSpreadsheet_().getSpreadsheetTimeZone(); } catch (e) { MEMO_.tz = 'Asia/Kolkata'; } } return MEMO_.tz; }
function str_(v) { return String(v == null ? '' : v).trim(); }
function lc_(v) { return str_(v).toLowerCase(); }
function isNull_(v) { return v == null || CONFIG.NULL_TOKENS.indexOf(lc_(v)) >= 0; }
// Email aliases: "name+anything@domain" is the same mailbox as "name@domain" (e.g. babar.farash+i@ = babar.farash@)
function canonEmail_(v) { var e = lc_(v).trim(); return e.replace(/\+[^@]*@/, '@'); }
function email_(v) { var e = canonEmail_(v); return isNull_(e) || e.indexOf('@') < 0 ? '' : e; }
var HKEY_ = Object.create(null);
function hkey_(v) { var k = String(v == null ? '' : v); if (k in HKEY_) return HKEY_[k]; return (HKEY_[k] = lc_(v).replace(/[^a-z0-9%?]+/g, '')); }
function num_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (isNull_(v)) return null;
  var s = str_(v).replace(/[₹,\s]/g, '');
  if (!/^-?[0-9]*\.?[0-9]+%?$/.test(s)) return null;
  var n = Number(s.replace('%', ''));
  return isFinite(n) ? (s.indexOf('%') > 0 ? n / 100 : n) : null;
}
function n0_(v) { var n = num_(v); return n == null ? 0 : n; }
function round_(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }
function logError_(where, err) { console.error(where + ': ' + (err && err.stack ? err.stack : err)); }
function fail_(code, message) { return { success: false, error: code, message: message }; }
function guard_(where, fn) {
  try { return fn(); } catch (e) {
    var known = { UNAUTHORIZED: 'You are not authorized to view this selection.', INVALID_SELECTION: 'That hierarchy selection is not available for your access.', INVALID_FILTER: 'Invalid financial year or month.' };
    if (e && known[e.message]) return fail_(e.message, known[e.message]);
    logError_(where, e);
    return fail_('SERVER_ERROR', 'Something went wrong on the server. Please try again in a moment.');
  }
}
var ISO_DAY_ = Object.create(null);
function toIsoDay_(v) {                             // each distinct date is formatted once (cold loads convert ~50k cells)
  if (v instanceof Date && !isNaN(v)) { var t = v.getTime(); return ISO_DAY_[t] || (ISO_DAY_[t] = Utilities.formatDate(v, tz_(), 'yyyy-MM-dd')); }
  return v;
}
function prettyDate_(v) {
  var s = str_(v); var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isNull_(s) ? '' : s;
  return m[3] + '-' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1] + '-' + m[1];
}

/* ---------- Month / FY helpers (reused from existing Code.gs, made timezone-safe) ---------- */
var MONTHS_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthKey_(v) {
  if (v instanceof Date) v = toIsoDay_(v);
  if (typeof v === 'number') { var d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return MONTHS_[d.getUTCMonth()] + "'" + String(d.getUTCFullYear()).slice(-2); }
  var s = str_(v).replace(/[’`]/g, "'");
  var iso = s.match(/^(\d{4})-(\d{2})/);
  if (iso) return MONTHS_[Number(iso[2]) - 1] + "'" + iso[1].slice(-2);
  var m = s.match(/^([A-Za-z]{3})[A-Za-z]*[' -]?(\d{2,4})$/);
  if (m) { var mm = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(); if (MONTHS_.indexOf(mm) >= 0) return mm + "'" + m[2].slice(-2); }
  return '';
}
function monthParts_(k) { var m = str_(k).match(/^([A-Za-z]{3})'(\d{2})$/); if (!m) return null; var i = MONTHS_.indexOf(m[1]); return i < 0 ? null : { key: k, month: i + 1, year: 2000 + Number(m[2]) }; }
function fyForMonth_(k) { var p = monthParts_(k); if (!p) return ''; var s = p.month >= 4 ? p.year : p.year - 1; return 'FY ' + s + '-' + String(s + 1).slice(-2); }
function monthOrder_(k) { var p = monthParts_(k); return p ? p.year * 12 + p.month : 0; }

/* ============================================================================
 * 4. DATA ACCESS (bulk read + chunked cache + in-execution memo)
 * ==========================================================================*/
function dataVersion_() {
  if (MEMO_.ver) return MEMO_.ver;
  var p = PropertiesService.getScriptProperties(), v = p.getProperty('DATA_VERSION');
  if (!v) { v = String(Date.now()); p.setProperty('DATA_VERSION', v); }
  return (MEMO_.ver = v);
}
function bumpDataVersion_() {
  var old = null; try { old = PropertiesService.getScriptProperties().getProperty('DATA_VERSION'); } catch (e) {}
  PropertiesService.getScriptProperties().setProperty('DATA_VERSION', String(Date.now()));
  if (old) purgeVersion_(old);
  MEMO_ = {};
}
/** Frees the cache space used by an old data version (month caches, sheet copies, periods), so edits do not pile up copies. */
function purgeVersion_(ver) {
  try {
    var cache = CacheService.getScriptCache(), bases = [], p = function (kind, m) { return 'p_' + ver + '_' + kind + '_' + String(m).replace(/[^A-Za-z0-9]/g, ''); };
    var manKey = p('man', 'all'), man = null;
    try { var n0 = cache.get(manKey + '_n'); if (n0) { var ks = []; for (var i = 0; i < Number(n0); i++) ks.push(manKey + '_' + i); var got = cache.getAll(ks), t = ''; ks.forEach(function (k) { t += got[k] || ''; }); man = JSON.parse(t); } } catch (e) {}
    bases.push(manKey);
    if (man) {
      Object.keys(man.parts || {}).forEach(function (k) { var a = k.split('|'); bases.push(p('inc' + a[0], a[1])); });
      (man.orderMonths || []).forEach(function (m) { bases.push(p('ob', m)); });
    }
    var metas = cache.getAll(bases.map(function (b) { return b + '_n'; })), del = [];
    bases.forEach(function (b) { var n = Number(metas[b + '_n'] || 0); for (var i = 0; i < n; i++) del.push(b + '_' + i); del.push(b + '_n'); });
    del.push('periods_' + ver);
    for (var j = 0; j < del.length; j += 900) cache.removeAll(del.slice(j, j + 900));
  } catch (e) { logError_('purgeVersion_', e); }
}
function empVersion_() {
  if (MEMO_.empVer) return MEMO_.empVer;
  var p = PropertiesService.getScriptProperties(), v = p.getProperty('EMP_VERSION');
  if (!v) { v = String(Date.now()); p.setProperty('EMP_VERSION', v); }
  return (MEMO_.empVer = v);
}
/** Only the Employees data changed (e.g. a password): keep the heavy month caches. */
function bumpEmployeeVersion_() {
  PropertiesService.getScriptProperties().setProperty('EMP_VERSION', String(Date.now()));
  delete MEMO_.empVer; delete MEMO_.emp; if (MEMO_.sheets) delete MEMO_.sheets[CONFIG.SHEETS.EMPLOYEES];
}

/* ---------- chunked JSON cache (byte-safe: non-ASCII is escaped so a chunk can never exceed the 100 KB limit) ---------- */
function cachePutJson_(key, obj, ttl, maxChunks) {
  try {
    var json = JSON.stringify(obj).replace(/[\u007f-\uffff]/g, function (c) { return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4); });
    var size = 95000, n = Math.ceil(json.length / size) || 1, chunks = {};
    if (n > (maxChunks || 80)) return false;
    var cache = CacheService.getScriptCache(), batch = {}, inBatch = 0;
    for (var k = 0; k < n; k++) {
      batch[key + '_' + k] = json.substr(k * size, size);
      if (++inBatch === 8) { cache.putAll(batch, ttl || CONFIG.CACHE_SEC); batch = {}; inBatch = 0; }
    }
    if (inBatch) cache.putAll(batch, ttl || CONFIG.CACHE_SEC);
    cache.put(key + '_n', String(n), ttl || CONFIG.CACHE_SEC);   // written last: readers only see complete entries
    return true;
  } catch (e) { logError_('cache put ' + key, e); return false; }
}
function cacheGetJson_(key) {
  try {
    var cache = CacheService.getScriptCache(), meta = cache.get(key + '_n');
    if (!meta) return null;
    var keys = []; for (var i = 0; i < Number(meta); i++) keys.push(key + '_' + i);
    var parts = cache.getAll(keys), text = '';
    for (var j = 0; j < keys.length; j++) { if (parts[keys[j]] == null) return null; text += parts[keys[j]]; }
    return JSON.parse(text);
  } catch (e) { return null; }
}

/**
 * De-duplicates headers. The L2 sheet repeats "Team_Size" and "C1_PPP" in the C2 block;
 * the first occurrence becomes C1_*, the second becomes C2_* so cycle data is not mixed up.
 */
function dedupeHeaders_(headers) {
  var count = {}, out = headers.map(function (h) { return str_(h); });
  out.forEach(function (h) { if (h) count[h] = (count[h] || 0) + 1; });
  var seen = {};
  return out.map(function (h) {
    if (!h || count[h] < 2) return h;
    seen[h] = (seen[h] || 0) + 1;
    var base = h.replace(/^C[12]_/, '');
    if (seen[h] === 1) return /^C[12]_/.test(h) ? 'C1_' + base : 'C1_' + h;
    if (seen[h] === 2) return 'C2_' + base;
    return h + '_' + seen[h];
  });
}

function readSheet_(name, opts) {
  opts = opts || {};
  MEMO_.sheets = MEMO_.sheets || {};
  if (MEMO_.sheets[name]) return MEMO_.sheets[name];
  var ver = dataVersion_() + (name === CONFIG.SHEETS.EMPLOYEES ? '_e' + empVersion_() : '');
  var key = 'sh_' + ver + '_' + name;
  if (!opts.noCache) {
    var cached = cacheGetJson_(key);
    if (cached) { cached.map = headerMap_(cached.headers); return (MEMO_.sheets[name] = cached); }
  }
  var sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) return null;
  var values = sh.getDataRange().getValues();
  var headers = values.length ? dedupeHeaders_(values[0]) : [];
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r], empty = true;
    for (var c = 0; c < row.length; c++) { if (row[c] instanceof Date) row[c] = toIsoDay_(row[c]); if (row[c] !== '' && row[c] != null) empty = false; }
    if (!empty) rows.push(row);
  }
  var out = { name: name, headers: headers, rows: rows };
  if (!opts.noCache) cachePutJson_(key, out, CONFIG.CACHE_SEC);
  out.map = headerMap_(headers);
  return (MEMO_.sheets[name] = out);
}
function headerMap_(headers) { var m = {}; headers.forEach(function (h, i) { if (h && !Object.prototype.hasOwnProperty.call(m, hkey_(h))) m[hkey_(h)] = i; }); return m; }
function colIdx_(map, name) { var k = hkey_(name); return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : -1; }
function cell_(row, map, name) { var i = colIdx_(map, name); return i < 0 ? null : row[i]; }

/* ============================================================================
 * 5. EMPLOYEES & AUTHENTICATION
 * ==========================================================================*/
function employeeIndex_() {
  if (MEMO_.emp) return MEMO_.emp;
  var d = readSheet_(CONFIG.SHEETS.EMPLOYEES);
  if (!d) throw new Error('Employees sheet missing');
  var byEmail = {};
  d.rows.forEach(function (row, i) {
    var e = {
      email: str_(cell_(row, d.map, COLS.EMP.email)), id: str_(cell_(row, d.map, COLS.EMP.id)), name: str_(cell_(row, d.map, COLS.EMP.name)),
      role: str_(cell_(row, d.map, COLS.EMP.role)), doj: cell_(row, d.map, COLS.EMP.doj), status: str_(cell_(row, d.map, COLS.EMP.status)),
      password: str_(cell_(row, d.map, COLS.EMP.password)), rowIndex: i
    };
    var k = canonEmail_(e.email); if (k && !byEmail[k]) byEmail[k] = e;
  });
  return (MEMO_.emp = { byEmail: byEmail, sheet: d });
}
function findEmployee_(email) { return employeeIndex_().byEmail[canonEmail_(email)] || null; }
function isActive_(e) { return /^(active|yes|enabled)$/i.test(str_(e && e.status)); }
function isAdminEmail_(email) { return CONFIG.ADMIN_EMAILS.map(canonEmail_).indexOf(canonEmail_(email)) >= 0; }
function canonicalRole_(e) {
  if (isAdminEmail_(e.email)) return 'ADMIN';
  var r = str_(e.role).toUpperCase();
  if (r === 'ADMIN' || r === 'ADMINISTRATOR') return 'ADMIN';                // L5 is now a real hierarchy level
  return LEVEL_RANK.hasOwnProperty(r) ? r : '';
}
/** DOJ → DDMMYYYY, done on the yyyy-MM-dd string so no timezone shift is possible. */
function formatDOJ_(v) {
  if (v instanceof Date) v = toIsoDay_(v);
  if (typeof v === 'number') { var d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return ('0' + d.getUTCDate()).slice(-2) + ('0' + (d.getUTCMonth() + 1)).slice(-2) + d.getUTCFullYear(); }
  var s = str_(v), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + m[2] + m[1];
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return ('0' + m[1]).slice(-2) + ('0' + m[2]).slice(-2) + m[3];
  return s.replace(/\D/g, '').length === 8 ? s.replace(/\D/g, '') : '';
}
/** Accepts DDMMYYYY, DD-MM-YYYY, DD/MM/YYYY or YYYY-MM-DD (date picker). */
function normalizeDojInput_(v) {
  var s = str_(v), m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[3] + m[2] + m[1];
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return ('0' + m[1]).slice(-2) + ('0' + m[2]).slice(-2) + m[3];
  return s.replace(/\D/g, '');
}
function defaultPassword_(e) { var d = formatDOJ_(e.doj); return e.id && d ? e.id + d : ''; }

/* ---------- Password hashing: salted + peppered, iterated SHA-256 ---------- */
function pepper_() {
  var p = PropertiesService.getScriptProperties(), v = p.getProperty('PASSWORD_PEPPER');
  if (!v) { v = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('PASSWORD_PEPPER', v); }
  return v;
}
function digest_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)); }
function stretch_(salt, password, rounds) { var h = salt + '|' + pepper_() + '|' + password; for (var i = 0; i < rounds; i++) h = digest_(h + salt); return h; }
function hashPassword_(password) { var salt = Utilities.getUuid().replace(/-/g, ''); return 'pbk$' + CONFIG.PASSWORD.HASH_ROUNDS + '$' + salt + '$' + stretch_(salt, String(password), CONFIG.PASSWORD.HASH_ROUNDS); }
function safeEqual_(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
/** Returns 'default' | 'stored' | false */
function passwordMatches_(e, password) {
  var stored = e.password; password = String(password);
  if (!stored) { var initial = defaultPassword_(e); return initial && safeEqual_(password.toUpperCase(), initial.toUpperCase()) ? 'default' : false; }
  var a = stored.split('$');
  if (a[0] === 'pbk' && a.length === 4) return safeEqual_(stretch_(a[2], password, Number(a[1])), a[3]) ? 'stored' : false;
  if (a[0] === 'sha256' && a.length === 3) return safeEqual_(digest_(a[1] + password), a[2]) ? 'stored' : false;   // hash format of previous Code.gs
  return safeEqual_(password, stored) ? 'stored' : false;                                                         // legacy plaintext, upgraded on login
}
function savePassword_(e, value) {
  var d = employeeIndex_().sheet, col = colIdx_(d.map, COLS.EMP.password);
  if (col < 0) throw new Error('Password column missing in Employees');
  var sh = getSpreadsheet_().getSheetByName(CONFIG.SHEETS.EMPLOYEES);
  // Re-locate the row by email on the live sheet (safe if rows were inserted since caching).
  var emailCol = colIdx_(d.map, COLS.EMP.email) + 1, emails = sh.getRange(2, emailCol, Math.max(1, sh.getLastRow() - 1), 1).getValues();
  for (var i = 0; i < emails.length; i++) {
    if (lc_(emails[i][0]) === lc_(e.email)) { sh.getRange(i + 2, col + 1).setValue(value); bumpEmployeeVersion_(); return; }
  }
  throw new Error('Employee row not found while saving password');
}
function passwordStrong_(p) { return p.length >= CONFIG.PASSWORD.MIN_LENGTH && /[A-Za-z]/.test(p) && /[0-9]/.test(p); }

/* ---------- Brute-force protection ---------- */
function lockKey_(scope, email) { return 'lk_' + scope + '_' + digest_(canonEmail_(email)); }   // aliases share one lockout
function isLocked_(scope, email) { return Number(CacheService.getScriptCache().get(lockKey_(scope, email)) || 0) >= CONFIG.LOGIN.MAX_ATTEMPTS; }
function recordFailure_(scope, email) { var c = CacheService.getScriptCache(), k = lockKey_(scope, email); c.put(k, String(Number(c.get(k) || 0) + 1), CONFIG.LOGIN.LOCK_SEC); }
function clearFailures_(scope, email) { CacheService.getScriptCache().remove(lockKey_(scope, email)); }

var INACTIVE_MSG = 'User no longer in the system.';

function authenticate(email, password) {
  return guard_('authenticate', function () {
    email = str_(email);
    if (!email || !password) return fail_('MISSING', 'Enter your employee email ID and password.');
    if (isLocked_('login', email)) return fail_('LOCKED', 'Too many failed attempts. Try again in 15 minutes.');
    var e = findEmployee_(email);
    if (!e) {
      recordFailure_('login', email);
      if (wasEmployee_(email)) return fail_('INACTIVE', INACTIVE_MSG);        // removed from Employees but present in incentive data: a former employee
      return fail_('INVALID', 'Invalid credentials. Check your employee email ID and password.');
    }
    if (!isActive_(e)) return fail_('INACTIVE', INACTIVE_MSG);                 // requirement: inactive users are told and blocked
    var match = passwordMatches_(e, password);
    if (!match) { recordFailure_('login', email); return fail_('INVALID', 'Invalid credentials. Check your employee email ID and password.'); }
    var role = canonicalRole_(e);
    if (!role) return fail_('NO_ROLE', 'Your role is not configured for the dashboard. Contact the administrator.');
    clearFailures_('login', email);
    if (match === 'stored' && e.password.indexOf('pbk$') !== 0) savePassword_(e, hashPassword_(password));   // upgrade legacy storage
    purgeExpiredSessions();
    var token = Utilities.getUuid() + Utilities.getUuid(), key = CONFIG.SESSION.PREFIX + digest_(token), now = Date.now();
    var session = { email: canonEmail_(e.email), id: e.id, name: e.name, role: role, created: now, lastSeen: now, isDefault: match === 'default' };
    writeSession_(key, session);
    try { trackLogin(e.id, e.name, e.email); } catch (trackErr) { logError_('trackLogin', trackErr); }
    return { success: true, token: token, user: publicUser_(session) };
  });
}

/* ============================================================================
 * 6. SESSIONS
 * ==========================================================================*/
function writeSession_(key, s) { var raw = JSON.stringify(s); PropertiesService.getScriptProperties().setProperty(key, raw); CacheService.getScriptCache().put(key, raw, CONFIG.SESSION.IDLE_SEC); }
function invalidateSessionKey_(key) { CacheService.getScriptCache().remove(key); PropertiesService.getScriptProperties().deleteProperty(key); }
function validateSession_(token) {
  if (!token || typeof token !== 'string' || token.length < 40) return null;
  var key = CONFIG.SESSION.PREFIX + digest_(token), cache = CacheService.getScriptCache();
  var raw = cache.get(key) || PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return null;
  var s; try { s = JSON.parse(raw); } catch (e) { invalidateSessionKey_(key); return null; }
  var now = Date.now();
  if (now - s.created > CONFIG.SESSION.ABSOLUTE_SEC * 1000 || now - s.lastSeen > CONFIG.SESSION.IDLE_SEC * 1000) { invalidateSessionKey_(key); return null; }
  var e = findEmployee_(s.email);                                             // re-check status on every call
  if (!e || !isActive_(e) || canonicalRole_(e) !== s.role) { invalidateSessionKey_(key); return null; }
  if (now - s.lastSeen > CONFIG.SESSION.TOUCH_SEC * 1000) { s.lastSeen = now; writeSession_(key, s); }
  return s;
}
function withSession_(where, token, fn) {
  return jsonSafe_(where, guard_(where, function () {
    var s = validateSession_(token);
    if (!s) return fail_('SESSION_EXPIRED', 'Your session has expired. Please log in again.');
    return fn(s);
  }));
}
/** google.script.run fails the whole request if a reply contains a Date, NaN, Infinity or undefined.
 *  Normalise every reply to plain JSON so the browser always receives it. */
function jsonSafe_(where, x) {
  try {
    return JSON.parse(JSON.stringify(x, function (k, v) {
      if (typeof v === 'number' && !isFinite(v)) return null;
      return v;
    }));
  } catch (e) { logError_(where + ' (reply)', e); return fail_('SERVER_ERROR', 'The server could not prepare the reply. Please try again.'); }
}
function purgeExpiredSessions() {
  var p = PropertiesService.getScriptProperties(), all = p.getProperties(), now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(CONFIG.SESSION.PREFIX) !== 0) return;
    try { var s = JSON.parse(all[k]); if (now - s.created > CONFIG.SESSION.ABSOLUTE_SEC * 1000 || now - s.lastSeen > CONFIG.SESSION.IDLE_SEC * 1000) p.deleteProperty(k); } catch (e) { p.deleteProperty(k); }
  });
}
function publicUser_(s) { return { name: s.name, email: s.email, id: s.id, level: s.role, isAdmin: s.role === 'ADMIN', isDefaultPassword: !!s.isDefault }; }
function logout(token) { try { if (token) invalidateSessionKey_(CONFIG.SESSION.PREFIX + digest_(token)); } catch (e) {} return { success: true }; }
function validateSession(token) { return guard_('validateSession', function () { var s = validateSession_(token); return s ? { success: true, user: publicUser_(s) } : fail_('SESSION_EXPIRED', 'Your session has expired. Please log in again.'); }); }

/* ---------- Password change / reset ---------- */
function changePassword(token, currentPassword, newPassword, confirmPassword) {
  return withSession_('changePassword', token, function (s) {
    if (!currentPassword || !newPassword || !confirmPassword) return fail_('MISSING', 'Complete all three password fields.');
    if (newPassword !== confirmPassword) return fail_('MISMATCH', 'New password and confirmation do not match.');
    if (!passwordStrong_(newPassword)) return fail_('WEAK', 'Use at least ' + CONFIG.PASSWORD.MIN_LENGTH + ' characters with at least one letter and one number.');
    if (newPassword === currentPassword) return fail_('SAME', 'New password must be different from the current password.');
    if (isLocked_('pw', s.email)) return fail_('LOCKED', 'Too many failed attempts. Try again in 15 minutes.');
    var e = findEmployee_(s.email);
    if (!e || !passwordMatches_(e, currentPassword)) { recordFailure_('pw', s.email); return fail_('INVALID', 'Current password is incorrect.'); }
    var def = defaultPassword_(e); if (def && newPassword.toUpperCase() === def.toUpperCase()) return fail_('WEAK', 'Choose a password that is not your default Employee ID + DOJ.');
    savePassword_(e, hashPassword_(newPassword));
    clearFailures_('pw', s.email);
    logout(token);
    return { success: true, forceLogin: true, message: 'Password updated. Log in again with your new password.' };
  });
}
function resetPasswordToDefault(email, employeeId, dojInput) {
  return guard_('resetPassword', function () {
    var generic = 'These details do not match our records. Check them or contact HR.';
    if (!str_(email) || !str_(employeeId) || !str_(dojInput)) return fail_('MISSING', 'Enter your email ID, employee ID and date of joining.');
    if (isLocked_('reset', email)) return fail_('LOCKED', 'Too many attempts. Try again in 15 minutes.');
    var e = findEmployee_(email);
    if (!e || lc_(e.id) !== lc_(employeeId) || formatDOJ_(e.doj) !== normalizeDojInput_(dojInput)) { recordFailure_('reset', email); return fail_('INVALID', generic); }
    if (!isActive_(e)) return fail_('INACTIVE', INACTIVE_MSG);
    savePassword_(e, '');                                                    // blank = default password (Emp_Id + DDMMYYYY)
    clearFailures_('reset', email);
    return { success: true, message: 'Password reset. Log in with your Employee ID followed by DOJ as DDMMYYYY (for example EMP1234 + 05062023 = EMP123405062023), then change it.' };
  });
}

/* ============================================================================
 * 7. HIERARCHY AUTHORIZATION
 * ==========================================================================*/
function nameOf_(email) {
  var e = findEmployee_(email); if (e && e.name) return e.name;
  if (!MEMO_.names) { try { manifest_(); } catch (e) {} }
  var n = MEMO_.names && MEMO_.names[canonEmail_(email)]; if (n) return n;
  // Manager not in Employees or any incentive sheet: derive a readable name from the email ID.
  var local = str_(email).split('@')[0].replace(/[0-9]+/g, '').split(/[._\-]+/).filter(Boolean);
  return local.length ? local.map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ') : email;
}
/** True when the email appears in the incentive data (any month) although it is no longer in the Employees tab. */
function wasEmployee_(email) { try { var n = manifest_().names || {}; return !!n[canonEmail_(email)]; } catch (e) { return false; } }
function statusOf_(email) { var e = findEmployee_(email); return e ? (isActive_(e) ? 'Active' : 'Inactive') : 'Inactive'; }   // Employees tab lists active staff only: anyone not in it has left

/* ---------- month partitions: incentive rows and processed orders are cached per month, so a request only
 *            loads the month it needs instead of re-processing the whole history ---------- */
function partKey_(kind, month) { return 'p_' + dataVersion_() + '_' + kind + '_' + String(month).replace(/[^A-Za-z0-9]/g, ''); }
function buildPartitions_(needKey) {
  if (MEMO_.built) return MEMO_.man;
  var lock = null, got = false;
  try { lock = LockService.getScriptLock(); got = lock.tryLock(30000); } catch (e) {}
  try {
    if (got) {                                          // another request may have rebuilt the cache while we waited
      var ready = cacheGetJson_(partKey_('man', 'all'));
      if (ready && (!needKey || cacheGetJson_(needKey))) { MEMO_.man = ready; MEMO_.names = ready.names || {}; return ready; }
    }
    return buildPartitionsNow_();
  } finally { if (got) { try { lock.releaseLock(); } catch (e) {} } }
}
function buildPartitionsNow_() {
  var months = {}, names = {}, parts = {};
  MEMO_.incP = {}; MEMO_.ob = {};
  DRILL_LEVELS.forEach(function (L) {
    var d = readSheet_(CONFIG.SHEETS.INCENTIVES[L], { noCache: true }), by = {};
    if (d) {
      var im = colIdx_(d.map, COLS.INC.month), ie = colIdx_(d.map, COLS.INC.email), iname = colIdx_(d.map, COLS.INC.name);
      d.rows.forEach(function (row) {
        var e = email_(ie < 0 ? null : row[ie]), n = iname < 0 ? '' : str_(row[iname]);
        if (e && n && !names[e]) names[e] = n;
        var m = monthKey_(im < 0 ? null : row[im]); if (!monthParts_(m)) return;
        (by[m] = by[m] || []).push(row); months[m] = true;
      });
      Object.keys(by).forEach(function (m) { var part = { headers: d.headers, rows: by[m] }; MEMO_.incP[L + '|' + m] = part; parts[L + '|' + m] = true; cachePutJson_(partKey_('inc' + L, m), part); });
    }
    if (MEMO_.sheets) delete MEMO_.sheets[CONFIG.SHEETS.INCENTIVES[L]];
  });
  var od = readSheet_(CONFIG.SHEETS.ORDER_BASE, { noCache: true }), obm = {};
  if (od) buildOrderRecords_(od).forEach(function (o) { (obm[o.month] = obm[o.month] || []).push(o); });
  if (MEMO_.sheets) delete MEMO_.sheets[CONFIG.SHEETS.ORDER_BASE];
  Object.keys(obm).forEach(function (m) { MEMO_.ob[m] = obm[m]; cachePutJson_(partKey_('ob', m), packRecords_(obm[m])); });
  var man = { months: Object.keys(months).sort(function (a, b) { return monthOrder_(a) - monthOrder_(b); }), orderMonths: Object.keys(obm), parts: parts, names: names };
  cachePutJson_(partKey_('man', 'all'), man);
  MEMO_.man = man; MEMO_.names = names; MEMO_.built = true;
  return man;
}
function manifest_() {
  if (MEMO_.man) return MEMO_.man;
  var man = cacheGetJson_(partKey_('man', 'all'));
  if (!man) return buildPartitions_();
  MEMO_.man = man; MEMO_.names = man.names || {};
  return man;
}
function incentivePart_(level, month) {
  var k = level + '|' + month; MEMO_.incP = MEMO_.incP || {};
  if (MEMO_.incP[k]) return MEMO_.incP[k];
  var man = manifest_();
  if (!man.parts[k]) return null;                                   // this level has no rows that month
  var part = cacheGetJson_(partKey_('inc' + level, month));
  if (!part) { var need = partKey_('inc' + level, month); buildPartitions_(need); part = MEMO_.incP[k] || cacheGetJson_(need) || null; }   // evicted: rebuild once
  return (MEMO_.incP[k] = part);
}

/** Incentive records of one level for one month: identity, upline chain (lower-case email or ''), and the raw row. */
function incentiveRecords_(level, month) {
  MEMO_.inc = MEMO_.inc || {}; var mk = level + '|' + month;
  if (MEMO_.inc[mk]) return MEMO_.inc[mk];
  var part = incentivePart_(level, month), out = { recs: [] };
  if (!part) return (MEMO_.inc[mk] = out);
  var map = headerMap_(part.headers), ie = colIdx_(map, COLS.INC.email), iname = colIdx_(map, COLS.INC.name), iid = colIdx_(map, COLS.INC.id), iup = {};
  Object.keys(COLS.UPLINE).forEach(function (L) { iup[L] = LEVEL_RANK[L] > LEVEL_RANK[level] ? colIdx_(map, COLS.UPLINE[L]) : -1; });
  part.rows.forEach(function (row) {
    var email = email_(ie < 0 ? null : row[ie]); if (!email) return;
    var up = {}; Object.keys(iup).forEach(function (L) { up[L] = iup[L] < 0 ? '' : email_(row[iup[L]]); });
    out.recs.push({ level: level, email: email, name: iname < 0 ? '' : str_(row[iname]), id: iid < 0 ? '' : str_(row[iid]), month: month, up: up, row: row, map: map });
  });
  return (MEMO_.inc[mk] = out);
}

/**
 * Core row-level rule. Uses the chain columns stored ON THE ROW, so it is robust to hierarchy
 * changes month to month and never trusts browser input.
 *  - ADMIN: everything
 *  - Same level as the user: own row only (no peer access)
 *  - Higher level than the user: never (reverse-hierarchy block)
 *  - Lower level: only if the user's email appears in the row's upline chain
 */
function canViewRecord_(s, rec) {
  if (s.role === 'ADMIN') return true;
  if (rec.email === s.email) return true;           // a user can always see their OWN incentive rows, whatever level they were recorded at
  var ur = LEVEL_RANK[s.role], rr = LEVEL_RANK[rec.level];
  if (rr > ur) return false;
  if (rr === ur) return rec.email === s.email;
  for (var L in rec.up) if (rec.up[L] && rec.up[L] === s.email) return true;
  return false;
}
function canViewOrder_(s, o) {
  if (s.role === 'ADMIN') return true;
  if (o.booker === s.email || o.closer === s.email) return true;   // own orders: always visible to their booker / closer, whatever the role
  if (s.role === 'L0') return false;
  return o.L1 === s.email || o.L2 === s.email || o.L3 === s.email || o.L4 === s.email || o.L5 === s.email;
}

/** Reusable: every employee record the current user may see for a period, grouped by level. */
function getAuthorizedEmployees_(s, month) {
  var key = 'auth_' + month; if (MEMO_[key]) return MEMO_[key];
  var out = {};
  DRILL_LEVELS.forEach(function (L) { out[L] = incentiveRecords_(L, month).recs.filter(function (r) { return canViewRecord_(s, r); }); });
  return (MEMO_[key] = out);
}
function rootLevel_(s) { return s.role === 'ADMIN' ? 'ORG' : s.role; }

/**
 * Builds the dependent L4 → L3 → L2 → L1 → L0 options from authorized records only and validates the
 * browser's selection against them. Levels above the user's own level are locked and cleared; the
 * user's own level is forced to themselves. Throws INVALID_SELECTION on tampering.
 * A level whose manager column is "na" (e.g. L3_Email) is offered as "Direct to <manager> (no L3)".
 */
function buildHierarchy_(s, month, sel) {
  sel = sel || {};
  var auth = getAuthorizedEmployees_(s, month), root = rootLevel_(s), rootRank = root === 'ORG' ? 99 : LEVEL_RANK[root];
  var clean = {}, options = {}, locked = {}, all = [];
  DRILL_LEVELS.forEach(function (L) { clean[L] = ''; options[L] = []; all = all.concat(auth[L]); });
  var calc = {}; all.forEach(function (r) { calc[r.level + '|' + r.email] = true; });
  function opt(level, email, note) {
    return { value: email, label: nameOf_(email) + (note ? ' (' + note + ')' : ''), hasCalc: !!calc[level + '|' + email], status: statusOf_(email) };
  }
  function addUnique(list, seen, level, email, note) { if (email && !seen[email]) { seen[email] = true; list.push(opt(level, email, note)); } }

  DRILL_LEVELS.forEach(function (L, i) {
    var rank = LEVEL_RANK[L], list = [], seen = {};
    if (rank > rootRank && root !== 'ORG') { locked[L] = 'above'; return; }
    if (L === root) { list.push(opt(L, s.email)); options[L] = list; clean[L] = s.email; locked[L] = 'self'; return; }
    var lower = all.filter(function (r) { return LEVEL_RANK[r.level] < rank; });
    if (i === 0) {                                      // top drill level: only ADMIN (or an L5) reaches here
      auth[L].forEach(function (r) { addUnique(list, seen, L, r.email); });
      all.forEach(function (r) { if (r.up[L]) addUnique(list, seen, L, r.up[L]); });
    } else {
      var parentL = DRILL_LEVELS[i - 1], pv = clean[parentL];
      if (!pv) { options[L] = []; return; }
      var anchorL = parentL, anchor = pv, directLevels = [];
      if (pv === CONFIG.DIRECT) {                       // walk up through consecutive "Direct" selections to the real manager
        for (var j = i - 1; j >= 0 && clean[DRILL_LEVELS[j]] === CONFIG.DIRECT; j--) directLevels.push(DRILL_LEVELS[j]);
        if (j < 0) { options[L] = []; return; }
        anchorL = DRILL_LEVELS[j]; anchor = clean[anchorL];
      }
      var inGroup = function (r) {
        if (r.up[anchorL] !== anchor) return false;
        for (var k = 0; k < directLevels.length; k++) if (r.up[directLevels[k]]) return false;
        return true;
      };
      auth[L].forEach(function (r) { if (inGroup(r)) addUnique(list, seen, L, r.email); });
      var hasDirect = false, nextL = DRILL_LEVELS[i + 1];
      lower.forEach(function (r) {
        if (pv !== CONFIG.DIRECT && r.up[L] === pv) addUnique(list, seen, L, pv, 'manages ' + nextL + ' directly');
        else if (inGroup(r)) { if (r.up[L]) addUnique(list, seen, L, r.up[L]); else hasDirect = true; }
      });
      if (hasDirect) list.push({ value: CONFIG.DIRECT, label: 'Direct to ' + nameOf_(anchor) + ' (no ' + L + ')', hasCalc: false, status: 'Group' });
    }
    list.sort(function (a, b) { return a.value === CONFIG.DIRECT ? 1 : b.value === CONFIG.DIRECT ? -1 : a.label.localeCompare(b.label); });
    options[L] = list;
    var want = lc_(sel[L]) === lc_(CONFIG.DIRECT) ? CONFIG.DIRECT : email_(sel[L]);
    if (want) {
      if (!list.some(function (o) { return o.value === want; })) throw new Error('INVALID_SELECTION');
      clean[L] = want;
    }
  });
  return { root: root, options: options, locked: locked, selection: clean };
}

/* ============================================================================
 * 8. PERIODS
 * ==========================================================================*/
function availablePeriods_() {
  var cache = CacheService.getScriptCache(), ck = 'periods_' + dataVersion_(), c = cache.get(ck);
  if (c) return JSON.parse(c);
  var months = manifest_().months.slice();
  var byFy = {}; months.forEach(function (m) { var f = fyForMonth_(m); (byFy[f] = byFy[f] || []).push(m); });
  var out = { months: months, fys: Object.keys(byFy).sort(), monthsByFy: byFy };
  cache.put(ck, JSON.stringify(out), CONFIG.CACHE_SEC);
  return out;
}
function assertPeriod_(fy, month) {
  var p = availablePeriods_(), mk = monthKey_(month);
  if (p.fys.indexOf(fy) < 0 || p.months.indexOf(mk) < 0 || fyForMonth_(mk) !== fy) throw new Error('INVALID_FILTER');
  return mk;
}

/* ============================================================================
 * 9. METRICS & SCORECARDS
 * ==========================================================================*/
function val_(rec, col) { var v = cell_(rec.row, rec.map, col); return isNull_(v) ? null : v; }
function sumCols_(rec, cols) { var t = 0, any = false; cols.forEach(function (c) { var n = num_(val_(rec, c)); if (n != null) { t += n; any = true; } }); return any ? t : null; }
function unitOf_(name) { var m = String(name || '').match(/\(([^()]*)\)\s*$/); return m ? m[1].trim() : ''; }   // "Klv Akhil (Hyderabad)" -> "Hyderabad"
function baseName_(name) { return String(name || '').replace(/\s*\([^()]*\)\s*$/, ''); }                        // "Klv Akhil (Hyderabad)" -> "Klv Akhil"
function cyc_(tpl, c) { return tpl ? tpl.replace('{c}', c) : null; }
function eligibilityText_(v) { var s = str_(v).toUpperCase().replace('EILIGIBLE', 'ELIGIBLE'); return s; }

/** Normalized headline metrics for any incentive record. */
function metrics_(rec) {
  var M = LEVEL_METRICS[rec.level];
  var target = M.target ? num_(val_(rec, M.target)) : null;
  if (target == null && M.targetAlt) target = num_(val_(rec, M.targetAlt));   // e.g. L1 Month_Target_1 (basis of Monthly_Ach%)
  if (target == null) target = sumCols_(rec, M.targetParts);
  var ach = num_(val_(rec, M.ach)); if (ach == null) ach = sumCols_(rec, M.achParts);
  var pct = M.pct ? num_(val_(rec, M.pct)) : null; if (pct == null && target) pct = ach != null ? ach / target : null;
  var fin = n0_(val_(rec, COLS.INC.final)), paid = n0_(val_(rec, COLS.INC.paid));
  var reason = ''; M.reason.some(function (c) { var v = val_(rec, c); if (v && !/^not applicable$/i.test(str_(v))) { reason = str_(v); return true; } return false; });
  var cycles = {};
  ['C1', 'C2'].forEach(function (c) {
    var t = num_(val_(rec, c + '_Revenue_Target')), a = num_(val_(rec, c + '_Revenue_Achieved'));
    var p = M.cyclePct ? num_(val_(rec, cyc_(M.cyclePct, c))) : null; if (p == null && t) p = a != null ? a / t : null;
    cycles[c] = { target: t, ach: a, pct: p, inc: M.cycleInc ? num_(val_(rec, cyc_(M.cycleInc, c))) : null, status: M.cycleStatus ? eligibilityText_(val_(rec, cyc_(M.cycleStatus, c)) || '') : '' };
  });
  return {
    target: target, ach: ach, pct: pct, incentive: fin, paid: paid, eligible: fin > 0,
    paidStatus: str_(val_(rec, COLS.INC.paidStatus) || ''), reward: str_(val_(rec, COLS.INC.reward) || ''),
    reason: reason, group: M.group ? str_(val_(rec, M.group) || '') : '', tier: M.tier ? str_(val_(rec, M.tier) || '') : '', cycles: cycles
  };
}
function fieldValue_(rec, spec, c) {
  if (typeof spec === 'object') { var a = num_(val_(rec, cyc_(spec.a, c))), b = num_(val_(rec, cyc_(spec.b, c))); return a != null && b ? a / b : null; }
  var v = val_(rec, cyc_(spec, c));
  if (v == null) return null;
  if (typeof v === 'string' && /eilig/i.test(v)) v = v.replace(/EILIGIBLE/i, 'ELIGIBLE');
  return v;
}
/** NOT PAID, NOT PAID - INACTIVE, PARTIAL - PAID, PARTIAL - INACTIVE … → amount still unpaid (incentive earned − paid). */
function isShortfallStatus_(status) { return /^(NOT\s*PAID|PARTIAL)\b/i.test(str_(status)); }
function unpaidDiff_(status, incentive, paid) { return isShortfallStatus_(status) ? Math.max(0, round_(n0_(incentive) - n0_(paid), 2)) : 0; }

function scorecard_(rec) {
  var def = SCORECARDS[rec.level]; if (!def) return null;
  var cycleRows = [];
  def.cycle.forEach(function (d) {
    var c1 = fieldValue_(rec, d[1], 'C1'), c2 = fieldValue_(rec, d[1], 'C2');
    if (c1 == null && c2 == null) return;
    cycleRows.push({ label: d[0], type: d[2], c1: c1, c2: c2 });
  });
  var sections = [];
  def.sections.forEach(function (sec) {
    var items = sec.items.map(function (d) {
      var v = fieldValue_(rec, d[1], '');
      return v == null && d[3] != null ? { label: d[0], type: 'text', value: d[3], empty: true } : { label: d[0], type: d[2], value: v };
    });
    var hideZero = sec.title === 'Route evaluation';
    var shown = items.filter(function (x) { return x.value != null && !(hideZero && (x.type === 'currency' || x.type === 'percent') && Number(x.value) === 0); });
    if (sec === PAYOUT_SECTION) shown.forEach(function (x) {
      if (x.label === 'Paid amount') x.diff = unpaidDiff_(val_(rec, COLS.INC.paidStatus), val_(rec, COLS.INC.final), val_(rec, COLS.INC.paid));
    });
    if (shown.length) sections.push({ title: sec.title, items: shown });
  });
  return { cycleRows: cycleRows, sections: sections };
}

/** Member row for team tables (includes drill chain limited to levels at/below the user's root). */
function memberRow_(s, rec, rootRank) {
  var m = metrics_(rec), chain = {};
  var chainLevels = DRILL_LEVELS.slice(0, -1);                          // L4, L3, L2, L1
  chainLevels.forEach(function (L, idx) {
    if (LEVEL_RANK[L] <= LEVEL_RANK[rec.level] || LEVEL_RANK[L] > rootRank) return;
    var managedAbove = chainLevels.slice(0, idx).some(function (H) { return !!rec.up[H]; });
    chain[L] = rec.up[L] || (managedAbove ? CONFIG.DIRECT : '');         // "na" at this level → Direct group
  });
  var parentL = null;                                                    // nearest recorded manager above the row
  ['L1', 'L2', 'L3', 'L4', 'L5'].some(function (L) { if (LEVEL_RANK[L] > LEVEL_RANK[rec.level] && rec.up[L]) { parentL = L; return true; } return false; });
  return {
    level: rec.level, email: rec.email, name: (findEmployee_(rec.email) || {}).name || rec.name || nameOf_(rec.email), id: (findEmployee_(rec.email) || {}).id || rec.id, status: statusOf_(rec.email),
    manager: parentL && rec.up[parentL] && LEVEL_RANK[parentL] <= rootRank ? nameOf_(rec.up[parentL]) : '',
    group: m.group, tier: m.tier, target: m.target, ach: m.ach, pct: m.pct, c1: m.cycles.C1.inc, c2: m.cycles.C2.inc,
    incentive: m.incentive, paid: m.paid, paidStatus: m.paidStatus, eligible: m.eligible, reason: m.reason, reward: m.reward, chain: chain
  };
}

/* ============================================================================
 * 10. FOCUS / SPAN RESOLUTION
 * ==========================================================================*/
function resolveFocus_(s, h) {
  var sel = h.selection, focus = null;
  for (var i = DRILL_LEVELS.length - 1; i >= 0; i--) { var L = DRILL_LEVELS[i]; if (sel[L]) { focus = { level: L, email: sel[L] }; break; } }
  if (!focus) return { kind: 'org', level: 'ORG', email: '' };
  if (focus.email === CONFIG.DIRECT) {
    var dl = [], j = DRILL_LEVELS.indexOf(focus.level);
    while (j >= 0 && sel[DRILL_LEVELS[j]] === CONFIG.DIRECT) { dl.push(DRILL_LEVELS[j]); j--; }
    var aL = DRILL_LEVELS[j];
    return { kind: 'direct', level: focus.level, email: CONFIG.DIRECT, anchorLevel: aL, anchor: sel[aL], directLevels: dl };
  }
  return { kind: 'employee', level: focus.level, email: focus.email };
}
function inSpan_(focus, rec) {
  if (focus.kind === 'org') return true;
  if (LEVEL_RANK[rec.level] >= LEVEL_RANK[focus.level]) return false;
  if (focus.kind === 'direct') return rec.up[focus.anchorLevel] === focus.anchor && focus.directLevels.every(function (D) { return !rec.up[D]; });
  for (var L in rec.up) if (rec.up[L] === focus.email && LEVEL_RANK[L] <= LEVEL_RANK[focus.level] && LEVEL_RANK[L] > LEVEL_RANK[rec.level]) return true;
  return false;
}

/* ============================================================================
 * 11. ORDERS
 * ==========================================================================*/
function orderClass_(remarks) {
  var s = str_(remarks).toUpperCase().replace(/[–—]/g, '-');
  if (/^NOT[ -]?CONSIDERED\b/.test(s)) return 'NOT_CONSIDERED';
  if (/^CONSIDERED\b/.test(s)) return 'CONSIDERED';
  return 'UNCLASSIFIED';
}
function orderReason_(remarks) {
  var s = str_(remarks).replace(/^(NOT\s*)?CONSIDERED\s*(C[12])?\s*[—–-]\s*/i, '').replace(/\s*\(.*$/, '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unspecified';
}
/** Processes every Order_Base row once (column positions resolved up front, not per cell). */
function buildOrderRecords_(d) {
  var out = [], idx = {};
  Object.keys(COLS.ORD).forEach(function (k) { idx[k] = colIdx_(d.map, COLS.ORD[k]); });
  // Order_Base without an L5_Email column still uses the previous labels: its L4_Email holds the L5 and its
  // L3_Email holds the L4 (verified against Employees roles). Shift those two columns up one level in that case.
  if (idx.L5 < 0) { idx.L5 = idx.L4; idx.L4 = idx.L3; idx.L3 = -1; }
  d.rows.forEach(function (row) {
    function g(k) { var i = idx[k]; return i < 0 || i == null ? null : row[i]; }
    var remarks = str_(g('remarks')), cyc = num_(g('cycle'));
    out.push({
      month: monthKey_(g('month')), L1: email_(g('L1')), L2: email_(g('L2')), L3: email_(g('L3')), L4: email_(g('L4')), L5: email_(g('L5')),
      booker: email_(g('booker')), closer: email_(g('closer')), cycle: cyc ? 'C' + cyc : '', share: str_(g('share')).toUpperCase(),
      bookerCredit: n0_(g('bookerCredit')), closerCredit: n0_(g('closerCredit')), saleType: str_(g('saleType')), invoice: str_(g('invoice')),
      amount: n0_(g('amount')), orderStatus: str_(g('status')), customerId: isNull_(g('customerId')) ? '' : str_(g('customerId')), customer: str_(g('customer')), payMode: str_(g('payMode')).replace(/_/g, ' '),
      loanProvider: isNull_(g('loanProvider')) ? '' : str_(g('loanProvider')), loanStatus: str_(g('loanStatus')),
      saleDate: prettyDate_(g('saleDate')), payDate: prettyDate_(g('payDate')), eligible: n0_(g('eligible')),
      remarks: remarks, cls: orderClass_(remarks), reason: orderReason_(remarks)
    });
  });
  return out;
}
/** Orders are stored in the cache compactly (field list + string table + arrays): about a third of the size. */
function packRecords_(list) {
  var keys = list.length ? Object.keys(list[0]) : [], dict = [], di = Object.create(null);
  var rows = list.map(function (o) { return keys.map(function (k) { var v = o[k]; if (typeof v !== 'string') return v; if (!(v in di)) { di[v] = dict.length; dict.push(v); } return '~' + di[v]; }); });
  return { keys: keys, dict: dict, rows: rows };
}
function unpackRecords_(p) {
  if (!p || !p.keys) return p;
  return p.rows.map(function (r) { var o = {}; for (var i = 0; i < p.keys.length; i++) { var v = r[i]; o[p.keys[i]] = typeof v === 'string' && v.charAt(0) === '~' ? p.dict[Number(v.slice(1))] : v; } return o; });
}
/** Orders of one month (cached per month). */
function orderRecords_(month) {
  MEMO_.ob = MEMO_.ob || {};
  if (MEMO_.ob[month]) return MEMO_.ob[month];
  var man = manifest_();
  if (man.orderMonths.indexOf(month) < 0) return (MEMO_.ob[month] = []);
  var list = unpackRecords_(cacheGetJson_(partKey_('ob', month)));
  if (!list) { var need = partKey_('ob', month); buildPartitions_(need); list = MEMO_.ob[month] || unpackRecords_(cacheGetJson_(need)) || []; }
  return (MEMO_.ob[month] = list);
}
/** Amount credited to the focused employee (verified against C1/C2_Revenue_Achieved in L0_Incentives). */
/** Is the focused person in a manager column of this order (at or below their level)? */
function managesOrder_(o, focus) {
  if (focus.kind !== 'employee' || focus.level === 'L0') return false;
  for (var k = 1; k <= LEVEL_RANK[focus.level]; k++) if (o['L' + k] === focus.email) return true;
  return false;
}
/** The order was booked or closed by the focused person themselves (not reached through a manager column). */
function ownSale_(o, focus) {
  return focus.kind === 'employee' && (o.booker === focus.email || o.closer === focus.email) && !managesOrder_(o, focus);
}
function creditFor_(o, focus) {
  if (o.cls !== 'CONSIDERED') return 0;
  if (focus.kind === 'employee' && (focus.level === 'L0' || ownSale_(o, focus))) {   // personal credit: booker / closer share
    if (o.share === 'SPLIT') return (o.booker === focus.email ? o.bookerCredit : 0) + (o.closer === focus.email ? o.closerCredit : 0);
    return o.booker === focus.email || o.closer === focus.email ? o.eligible : 0;
  }
  return o.eligible;                                                                   // team view: full eligible amount
}
function scopedOrders_(s, month, focus) {
  return orderRecords_(month).filter(function (o) {
    if (o.month !== month || !canViewOrder_(s, o)) return false;
    if (focus.kind === 'org') return true;
    if (focus.kind === 'direct') return o[focus.anchorLevel] === focus.anchor && focus.directLevels.every(function (D) { return !o[D]; });
    if (o.booker === focus.email || o.closer === focus.email) return true;   // the person's own sales (e.g. an L1 still evaluated as L0)
    if (focus.level === 'L0') return false;
    for (var k = 1; k <= LEVEL_RANK[focus.level]; k++) if (o['L' + k] === focus.email) return true;   // same rule as inSpan_
    return false;
  });
}
function orderSummary_(orders, focus) {
  var sum = { total: orders.length, considered: 0, notConsidered: 0, unclassified: 0, consideredAmt: 0, notConsideredValue: 0, creditedAmt: 0, orderValue: 0,
              byCycle: { C1: { count: 0, amt: 0 }, C2: { count: 0, amt: 0 } }, bySaleType: {}, byPayMode: {}, reasons: {}, consideredTypes: {}, split: 0 };
  orders.forEach(function (o) {
    sum.orderValue += o.amount;
    if (o.share === 'SPLIT') sum.split++;
    if (o.cls === 'CONSIDERED') {
      var cr = creditFor_(o, focus);
      sum.considered++; sum.consideredAmt += o.eligible; sum.creditedAmt += cr;
      if (sum.byCycle[o.cycle]) { sum.byCycle[o.cycle].count++; sum.byCycle[o.cycle].amt += cr; }
      bump_(sum.bySaleType, o.saleType || 'Other', cr); bump_(sum.byPayMode, o.payMode || 'Other', cr); bump_(sum.consideredTypes, o.reason, cr);
    } else if (o.cls === 'NOT_CONSIDERED') { sum.notConsidered++; sum.notConsideredValue += o.amount; bump_(sum.reasons, o.reason, o.amount); }
    else sum.unclassified++;
  });
  ['bySaleType', 'byPayMode', 'reasons', 'consideredTypes'].forEach(function (k) {
    sum[k] = Object.keys(sum[k]).map(function (x) { return { label: x, count: sum[k][x].count, amount: round_(sum[k][x].amount, 2) }; }).sort(function (a, b) { return b.amount - a.amount || b.count - a.count; });
  });
  return sum;
}
function bump_(obj, k, amt) { obj[k] = obj[k] || { count: 0, amount: 0 }; obj[k].count++; obj[k].amount += amt; }

/* ============================================================================
 * 12. INSIGHTS
 * ==========================================================================*/
function inr_(n) { n = Math.round(n || 0); var s = String(Math.abs(n)), last3 = s.slice(-3), rest = s.slice(0, -3); if (rest) last3 = ',' + last3; return (n < 0 ? '-' : '') + '₹' + rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + last3; }
function pct_(p) { return (p * 100).toFixed(1) + '%'; }

function personalInsights_(rec, m) {
  var out = [];
  if (m.target && m.ach != null) {
    if (m.ach >= m.target) out.push({ tone: 'good', text: 'Monthly revenue is ' + inr_(m.ach - m.target) + ' above target (' + pct_(m.pct || m.ach / m.target) + ').' });
    else out.push({ tone: 'warn', text: inr_(m.target - m.ach) + ' short of the monthly revenue target (' + pct_(m.ach / m.target) + ' achieved).' });
    if (/90%/.test(m.reason) && m.ach < m.target * 0.9) out.push({ tone: 'bad', text: inr_(m.target * 0.9 - m.ach) + ' more revenue was needed to reach the 90% eligibility threshold.' });
  }
  if (rec.level === 'L0') {
    ['C1', 'C2'].forEach(function (c) {
      var t = num_(val_(rec, c + '_Revenue_Target')), a = num_(val_(rec, c + '_Revenue_Achieved')), pay = n0_(val_(rec, c + '_Incentive_Payout'));
      var dt = num_(val_(rec, c + '_Demo_Target')), dv = num_(val_(rec, c + '_Valid_Demos')), de = eligibilityText_(val_(rec, c + '_Demo_Eligibility') || '');
      if (t && a != null && a >= t && de === 'NOT ELIGIBLE') out.push({ tone: 'bad', text: c + ': revenue target met, but demo eligibility failed (' + (dv || 0) + ' of ' + (dt || 0) + ' valid demos).' });
      else if (t && a != null && a < t && a >= 0.9 * t && !pay) out.push({ tone: 'warn', text: c + ': near miss — ' + inr_(t - a) + ' away from the cycle revenue target.' });
      else if (pay > 0) out.push({ tone: 'good', text: c + ': ' + (str_(val_(rec, c + '_Slab_Reached')) || 'slab') + ' reached, payout ' + inr_(pay) + '.' });
      if (dt && dv != null && dv < dt && de !== 'WAIVED') out.push({ tone: 'warn', text: c + ': ' + (dt - dv) + ' more valid demo(s) needed to meet the demo target.' });
    });
  }
  if (/INACTIVE/i.test(m.paidStatus)) out.push({ tone: 'bad', text: 'Payout status is ' + m.paidStatus + ' because the employee is inactive.' });
  if (m.reward) out.push({ tone: 'good', text: 'Additional reward: ' + m.reward + '.' });
  return out;
}
function teamInsights_(members, os) {
  var out = [], L0 = members.filter(function (x) { return x.level === 'L0'; });
  var base = L0.length ? L0 : members;
  if (base.length) {
    var el = base.filter(function (x) { return x.eligible; }).length, lvl = L0.length ? 'L0' : 'team';
    out.push({ tone: el / base.length >= 0.5 ? 'good' : 'warn', text: el + ' of ' + base.length + ' ' + lvl + ' members earned an incentive (' + pct_(el / base.length) + ').' });
    var top = base.slice().sort(function (a, b) { return b.incentive - a.incentive; })[0];
    if (top && top.incentive > 0) out.push({ tone: 'good', text: 'Top earner: ' + top.name + ' with ' + inr_(top.incentive) + '.' });
  }
  var inactive = members.filter(function (x) { return /INACTIVE/i.test(x.paidStatus); });
  if (inactive.length) {
    var held = inactive.reduce(function (t, x) { return t + Math.max(0, x.incentive - x.paid); }, 0);
    out.push({ tone: 'bad', text: inactive.length + ' inactive member(s) have payouts marked not paid or partial' + (held > 0 ? ' — ' + inr_(held) + ' withheld.' : '.') });
  }
  var zero = L0.filter(function (x) { return !x.eligible && x.pct != null && x.pct >= 0.9 && x.pct < 1; });
  if (zero.length) out.push({ tone: 'warn', text: zero.length + ' L0 member(s) finished between 90% and 100% of target without an incentive — the best coaching opportunity.' });
  if (os && os.notConsidered) out.push({ tone: 'warn', text: os.notConsidered + ' order(s) worth ' + inr_(os.notConsideredValue) + ' were not considered' + (os.reasons[0] ? '. Main reason: ' + os.reasons[0].label + '.' : '.') });
  var rewards = members.filter(function (x) { return x.reward; }).length;
  if (rewards) out.push({ tone: 'good', text: rewards + ' member(s) also earned an additional reward.' });
  return out;
}

/* ============================================================================
 * 13. PUBLIC DASHBOARD API
 * ==========================================================================*/
var DEFAULT_EXTRAS_ = { orders: { status: 'CONSIDERED', page: 1, size: 25, q: '', key: '', dir: 'asc', filters: {} }, trend: { team: { filter: 'all', q: '' }, ord: { q: '', filters: {} } } };
function bootstrap(token, extras) {
  return withSession_('bootstrap', token, function (s) {
    var p = availablePeriods_();
    if (!p.fys.length) return { success: true, user: publicUser_(s), periods: p, empty: true };
    var fy = p.fys[p.fys.length - 1], months = p.monthsByFy[fy], month = months[months.length - 1];
    return cachedView_(s, fy, month, {}, extras || DEFAULT_EXTRAS_);
  });
}

/** One call per interaction: validates filters + selection and returns options, the dashboard and — when
 *  extras are sent — the first page of orders and the trend, so the page needs one round trip instead of three. */
function getView(token, fy, month, sel, extras) {
  return withSession_('getView', token, function (s) { return cachedView_(s, fy, month, sel || {}, extras || null); });
}
/** Recently built views are kept for a few minutes per user and exact filters (the session is always checked first). */
function cachedView_(s, fy, month, sel, extras) {
  var key = 'rv_' + dataVersion_() + '_' + digest_(s.email + '|' + s.role + '|' + JSON.stringify([fy, month, sel, extras]));
  var hit = cacheGetJson_(key);
  if (hit && hit.success) { hit.user = publicUser_(s); return hit; }
  var v = buildView_(s, fy, month, sel);
  v.periods = availablePeriods_();
  if (extras) {                                        // optional: if either part fails the page loads it separately
    var o = extras.orders || {}, t = extras.trend || {};
    try { v.ordersPage = ordersPage_(s, fy, v.selection.month, v.selection.sel, o.status, o.page, o.size, o.q, o.key, o.dir, o.filters); } catch (e1) { logError_('view extras: orders', e1); }
    try { v.trend = trend_(s, fy, v.selection.month, v.selection.sel, t.team || {}, t.ord || {}, t.mode); } catch (e2) { logError_('view extras: trend', e2); }
  }
  v.span.packed = packMembers_(v.span.members); delete v.span.members;   // compact team list for the browser
  cachePutJson_(key, v, CONFIG.RESULT_CACHE_SEC, 4);
  return v;
}
/** Team rows as a string table + arrays: repeated names/emails are sent once (unpacked in the browser). */
var MEMBER_KEYS_ = ['level', 'email', 'name', 'id', 'status', 'manager', 'group', 'target', 'ach', 'pct', 'c1', 'c2', 'incentive', 'paid', 'paidStatus', 'eligible', 'reward', 'L4', 'L3', 'L2', 'L1'];
function packMembers_(list) {
  var dict = [], di = Object.create(null);
  function S(v) { if (v == null || v === '') return -1; v = String(v); if (!(v in di)) { di[v] = dict.length; dict.push(v); } return di[v]; }
  function N(v, d) { return v == null ? null : round_(v, d); }
  var rows = (list || []).map(function (m) {
    var c = m.chain || {};
    return [S(m.level), S(m.email), S(m.name), S(m.id), S(m.status), S(m.manager), S(m.group), N(m.target, 2), N(m.ach, 2), N(m.pct, 5), N(m.c1, 2), N(m.c2, 2),
            N(m.incentive, 2), N(m.paid, 2), S(m.paidStatus), m.eligible ? 1 : 0, S(m.reward),
            c.hasOwnProperty('L4') ? S(c.L4) : -2, c.hasOwnProperty('L3') ? S(c.L3) : -2, c.hasOwnProperty('L2') ? S(c.L2) : -2, c.hasOwnProperty('L1') ? S(c.L1) : -2];
  });
  return { keys: MEMBER_KEYS_, dict: dict, rows: rows };
}

function buildView_(s, fy, month, sel) {
  var mk = assertPeriod_(fy, month);
  var h = buildHierarchy_(s, mk, sel);
  var focus = resolveFocus_(s, h), auth = getAuthorizedEmployees_(s, mk), rootRank = h.root === 'ORG' ? 99 : LEVEL_RANK[h.root];
  var focusRec = null, ownRecs = [];
  if (focus.kind === 'employee') {
    focusRec = (auth[focus.level] || []).filter(function (r) { return r.email === focus.email; })[0] || null;
    if (!focusRec) {                                  // role changed during the year: use the row recorded at another level (e.g. L3 now, L2 in April)
      DRILL_LEVELS.some(function (L) { focusRec = (auth[L] || []).filter(function (r) { return r.email === focus.email; })[0] || null; return !!focusRec; });
    }
    // A manager without a calculation row is still valid: the email came from buildHierarchy_'s authorized options.
    // Rows at more than one level in the same month (e.g. promoted to L1 but still evaluated as L0): all count.
    DRILL_LEVELS.forEach(function (L) { (auth[L] || []).forEach(function (r) { if (r.email === focus.email) ownRecs.push(r); }); });
    if (ownRecs.length > 1) {                          // primary row = the one that earned most (tie: keep the row chosen above)
      ownRecs.forEach(function (r) { if (n0_(val_(r, COLS.INC.final)) > n0_(val_(focusRec, COLS.INC.final))) focusRec = r; });
      ownRecs.sort(function (a, b) { return LEVEL_RANK[a.level] - LEVEL_RANK[b.level]; });
    }
  }
  // Span members (authorized rows below the focus)
  var members = [];
  DRILL_LEVELS.forEach(function (L) { auth[L].forEach(function (r) { if (inSpan_(focus, r)) { var mr = memberRow_(s, r, rootRank); mr._unit = unitOf_(r.name); members.push(mr); } }); });
  var dupK = {}; members.forEach(function (x) { var k = x.level + '|' + x.email; dupK[k] = (dupK[k] || 0) + 1; });
  members.forEach(function (x) { if (dupK[x.level + '|' + x.email] > 1 && x._unit) x.name = baseName_(x.name) + ' (' + x._unit + ')'; delete x._unit; });   // e.g. "Klv Akhil (Hyderabad-Middle East)"
  var orders = scopedOrders_(s, mk, focus), os = orderSummary_(orders, focus);

  // Span level summaries
  var spanLevels = DRILL_LEVELS.map(function (L) {
    var list = members.filter(function (x) { return x.level === L; });
    if (!list.length) return null;
    var t = { level: L, count: list.length, active: 0, inactive: 0, eligible: 0, incentive: 0, paid: 0, ach: 0, target: 0, targetAch: 0, targetCount: 0 };
    list.forEach(function (x) {
      if (x.status === 'Inactive') t.inactive++; else t.active++; if (x.eligible) t.eligible++;
      t.incentive += x.incentive; t.paid += x.paid; t.ach += x.ach || 0;
      if (x.target) { t.target += x.target; t.targetAch += x.ach || 0; t.targetCount++; }   // % only over members that have a fixed target
    });
    t.eligibleRate = t.eligible / t.count; t.pct = t.target ? t.targetAch / t.target : null;
    return t;
  }).filter(Boolean);

  // Tier / group distribution for L0 in span
  var groups = {};
  members.filter(function (x) { return x.level === 'L0'; }).forEach(function (x) { var k = x.tier || 'Unassigned'; groups[k] = groups[k] || { label: k, count: 0, eligible: 0, incentive: 0, ach: 0 }; groups[k].count++; if (x.eligible) groups[k].eligible++; groups[k].incentive += x.incentive; groups[k].ach += x.ach || 0; });
  var campaigns = {};
  members.filter(function (x) { return x.level === 'L0'; }).forEach(function (x) { var k = x.group || 'Unassigned'; campaigns[k] = campaigns[k] || { label: k, count: 0, eligible: 0, incentive: 0, ach: 0 }; campaigns[k].count++; if (x.eligible) campaigns[k].eligible++; campaigns[k].incentive += x.incentive; campaigns[k].ach += x.ach || 0; });

  var teamIncentive = members.reduce(function (t, x) { return t + x.incentive; }, 0);
  var teamPaid = members.reduce(function (t, x) { return t + x.paid; }, 0);

  // Focus card + KPIs
  var focusOut = { kind: focus.kind, level: focus.level, email: focus.kind === 'employee' ? focus.email : '', hasCalc: !!focusRec };
  var kpis = [], cycles = null, scorecard = null, scorecards = null, eligibility = null, insights = [];
  if (focus.kind === 'org') {
    var l3 = spanLevels.filter(function (x) { return x.targetCount > 0; })[0], topL = l3 ? l3.level : DRILL_LEVELS[0];   // topmost level with targets
    focusOut.name = s.role === 'ADMIN' ? 'Entire organisation' : 'All teams under you'; focusOut.sub = 'All authorized hierarchy levels';
    kpis.push({ label: 'Revenue target', value: l3 ? l3.target : null, type: 'currency', sub: 'Sum of ' + topL + ' monthly targets' });
    kpis.push({ label: 'Revenue achieved', value: l3 ? l3.ach : null, type: 'currency', sub: 'Sum of ' + topL + ' monthly achievement' });
    kpis.push({ label: 'Achievement %', value: l3 && l3.target ? l3.ach / l3.target : null, type: 'percent', tone: l3 && l3.target && l3.ach >= l3.target ? 'good' : 'warn' });
    kpis.push({ label: 'Total incentive', value: teamIncentive, type: 'currency', sub: members.length + ' calculated employees' });
    kpis.push({ label: 'Total paid', value: teamPaid, type: 'currency', sub: 'Includes cash rewards where paid' });
  } else if (focus.kind === 'direct') {
    focusOut.name = 'Direct reports of ' + nameOf_(focus.anchor); focusOut.sub = 'Team members with no ' + focus.directLevels.slice().reverse().join('/') + ' manager';
    kpis.push({ label: 'Team incentive', value: teamIncentive, type: 'currency', sub: members.length + ' employees' });
    kpis.push({ label: 'Team paid', value: teamPaid, type: 'currency' });
  } else {
    focusOut.name = nameOf_(focus.email);                                  // Employees sheet name for the selected email
    var empRec = findEmployee_(focus.email), normN = function (x) { return lc_(x).replace(/\s+/g, ' '); };
    if (focusRec && empRec && focusRec.name && normN(baseName_(focusRec.name)) !== normN(baseName_(empRec.name))) {   // "(Unit)" suffix = same person   // row labelled with another person's name
      focusOut.dataCheck = 'Data check: the ' + mk.replace("'", ' 20') + ' ' + focusRec.level + '_Incentives row for ' + focus.email + ' is labelled "' + focusRec.name + (focusRec.id ? ' / ' + focusRec.id : '') + '" in the sheet. The figures shown are the ones on that row — please verify the row.';
    }
    focusOut.id = (findEmployee_(focus.email) || {}).id || (focusRec ? focusRec.id : '') || '';   // Employees sheet is the master record
    focusOut.status = statusOf_(focus.email);
    focusOut.sub = focus.level + (focusOut.id ? ' · ' + focusOut.id : '');
    focusOut.calcLevel = focusRec ? focusRec.level : '';            // differs from level when the month recorded them elsewhere
    if (focusRec) {
      var m = metrics_(focusRec), parts = null, diffSum = null;
      if (ownRecs.length > 1) {                          // total for the month = sum of every calculation the person has
        parts = ownRecs.map(function (r) { return { rec: r, m: r === focusRec ? m : metrics_(r) }; });
        var lvCount = {}; parts.forEach(function (p) { lvCount[p.rec.level] = (lvCount[p.rec.level] || 0) + 1; });
        parts.forEach(function (p, i) { p.label = p.rec.level + (lvCount[p.rec.level] > 1 ? ' · ' + (unitOf_(p.rec.name) || 'Row ' + (i + 1)) : ''); });   // e.g. "L4 · Hyderabad-Middle East"
        var sameLevel = Object.keys(lvCount).length === 1;   // several rows at ONE level (e.g. two units): achievement adds up too
        var statuses = [], rewards = [];
        parts.forEach(function (p) { var st = str_(p.m.paidStatus); if (st && st !== '-' && statuses.indexOf(st) < 0) statuses.push(st); if (p.m.reward && rewards.indexOf(p.m.reward) < 0) rewards.push(p.m.reward); });
        diffSum = parts.reduce(function (t, p) { return t + unpaidDiff_(p.m.paidStatus, p.m.incentive, p.m.paid); }, 0);
        m = Object.assign({}, m, {
          incentive: parts.reduce(function (t, p) { return t + p.m.incentive; }, 0),
          paid: parts.reduce(function (t, p) { return t + p.m.paid; }, 0),
          eligible: parts.some(function (p) { return p.m.eligible; }),
          paidStatus: statuses.join(' / '), reward: rewards.join('; ')
        });
        if (sameLevel) {
          var addN = function (vals) { var t = 0, any = false; vals.forEach(function (x) { if (x != null) { t += x; any = true; } }); return any ? t : null; };
          var reasons = []; parts.forEach(function (p) { if (p.m.reason && reasons.indexOf(p.m.reason) < 0) reasons.push(p.m.reason); });
          var cyc = {};
          ['C1', 'C2'].forEach(function (c) {
            var t = addN(parts.map(function (p) { return p.m.cycles[c].target; })), a = addN(parts.map(function (p) { return p.m.cycles[c].ach; }));
            var st = []; parts.forEach(function (p) { var x = p.m.cycles[c].status; if (x && st.indexOf(x) < 0) st.push(x); });
            cyc[c] = { target: t, ach: a, pct: t ? (a || 0) / t : null, inc: addN(parts.map(function (p) { return p.m.cycles[c].inc; })), status: st.join(' / ') };
          });
          var tS = addN(parts.map(function (p) { return p.m.target; })), aS = addN(parts.map(function (p) { return p.m.ach; }));
          m = Object.assign({}, m, { target: tS, ach: aS, pct: tS ? (aS || 0) / tS : null, cycles: cyc, reason: reasons.join(' / ') });
        }
        focusOut.calcLevels = parts.map(function (p) { return p.label; });
      }
      var partsTxt = parts ? parts.map(function (p) { return p.label + ' ' + inr_(p.m.incentive); }).join(' + ') : '';
      var splitTxt = function (k) { return parts && sameLevel ? ' · ' + parts.map(function (p) { return (unitOf_(p.rec.name) || p.label) + ' ' + inr_(p.m[k]); }).join(' + ') : ''; };
      focusOut.group = m.group; focusOut.tier = m.tier;
      var cohortRec = (ownRecs.length ? ownRecs : [focusRec]).filter(function (r) { return r.level === 'L0'; })[0];   // Cohort exists on L0_Incentives only
      focusOut.cohort = cohortRec ? str_(val_(cohortRec, 'Cohort') || '') : '';
      kpis.push({ label: 'Revenue target', value: m.target, type: 'currency', sub: m.target == null ? 'Rank/pool based plan — no fixed target' : (focus.level === 'L0' ? 'C1 + C2 targets' : 'Monthly target') + splitTxt('target') });
      kpis.push({ label: 'Revenue achieved', value: m.ach, type: 'currency', sub: (focus.level === 'L0' ? 'Considered, credited revenue' : 'Team revenue') + splitTxt('ach') });
      kpis.push({ label: 'Achievement %', value: m.pct, type: 'percent', tone: m.pct == null ? '' : m.pct >= 1 ? 'good' : m.pct >= 0.9 ? 'warn' : 'bad' });
      kpis.push({ label: 'Final incentive', value: m.incentive, type: 'currency', tone: m.eligible ? 'good' : 'bad', sub: (m.eligible ? 'Eligible' : 'Not eligible') + (parts ? ' · ' + partsTxt : '') });
      kpis.push({ label: 'Paid amount', value: m.paid, type: 'currency', sub: m.paidStatus && m.paidStatus !== '-' ? m.paidStatus : 'No payout', diff: parts ? round_(diffSum, 2) : unpaidDiff_(m.paidStatus, m.incentive, m.paid) });
      if (m.reward) kpis.push({ label: 'Additional reward', value: m.reward, type: 'text', tone: 'good' });
      var tot = { target: m.target, ach: m.ach, pct: m.pct, inc: m.incentive, status: m.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE' };
      cycles = { C1: m.cycles.C1, C2: m.cycles.C2, total: tot };
      scorecard = scorecard_(focusRec);
      eligibility = { eligible: m.eligible, reason: m.reason, paidStatus: m.paidStatus, incentive: m.incentive };   // incentive = Final_Incentive for the month (sum of all rows)
      insights = personalInsights_(focusRec, parts && !sameLevel ? parts.filter(function (p) { return p.rec === focusRec; })[0].m : m);   // same-level rows: combined figures
      if (parts) {
        eligibility.parts = parts.map(function (p) { return { level: p.rec.level, label: p.label, incentive: p.m.incentive, eligible: p.m.eligible, reason: p.m.reason, paidStatus: p.m.paidStatus }; });
        scorecards = parts.map(function (p) { return { level: p.rec.level, label: p.label, target: p.m.target, ach: p.m.ach, pct: p.m.pct, incentive: p.m.incentive, eligible: p.m.eligible, reason: p.m.reason, paidStatus: p.m.paidStatus, card: scorecard_(p.rec) }; });
        insights.unshift({ tone: m.eligible ? 'good' : 'warn', text: (sameLevel ? parts.length + ' separate ' + parts[0].rec.level + ' calculations this month (' : 'Calculated at ' + parts.length + ' levels this month (') + partsTxt + '). Total incentive for the month = ' + inr_(m.incentive) + '.' });
        parts.forEach(function (p) { if (p.rec !== focusRec || sameLevel) insights.push({ tone: p.m.eligible ? 'good' : 'warn', text: p.label + ' calculation: ' + (sameLevel && p.m.target ? inr_(p.m.ach) + ' of ' + inr_(p.m.target) + ' achieved (' + Math.round((p.m.ach || 0) / p.m.target * 1000) / 10 + '%), incentive ' : '') + inr_(p.m.incentive) + ' — ' + (p.m.eligible ? 'Eligible' : 'Not eligible') + (p.m.reason ? ' (' + p.m.reason + ')' : '') + '.' }); });
      }
    } else {
      focusOut.note = focus.email === s.email && s.role === 'ADMIN' ? 'Administrators have no personal incentive calculation.' : 'No personal incentive calculation exists for ' + focusOut.name + ' this month. Team figures below are built from authorized team rows.';
    }
    if (members.length) {
      kpis.push({ label: 'Team incentive', value: teamIncentive, type: 'currency', sub: members.length + ' team members in span' });
    }
  }
  kpis.push({ label: 'Orders', value: os.total, type: 'number', sub: 'Order value ' + inr_(os.orderValue) });
  kpis.push({ label: 'Considered orders', value: os.considered, type: 'number', tone: 'good', sub: inr_(os.creditedAmt) + (focus.kind === 'employee' && (focus.level === 'L0' || focusOut.calcLevel === 'L0') ? ' credited' : ' eligible') });
  kpis.push({ label: 'Not considered', value: os.notConsidered, type: 'number', tone: os.notConsidered ? 'bad' : '', sub: inr_(os.notConsideredValue) + ' order value' });

  if (members.length) insights = insights.concat(teamInsights_(members, os));
  else if (os.notConsidered) insights.push({ tone: 'warn', text: os.notConsidered + ' order(s) worth ' + inr_(os.notConsideredValue) + ' were not considered' + (os.reasons[0] ? '. Main reason: ' + os.reasons[0].label + '.' : '.') });
  if (os.unclassified) insights.push({ tone: 'warn', text: os.unclassified + ' order(s) have a Remarks value that is neither CONSIDERED nor NOT CONSIDERED.' });

  return {
    success: true, user: publicUser_(s), selection: { fy: fy, month: mk, sel: h.selection }, root: h.root, options: h.options, locked: h.locked,
    focus: focusOut, kpis: kpis, cycles: cycles, scorecard: scorecard, scorecards: scorecards, eligibility: eligibility, insights: insights,
    span: { levels: spanLevels, members: members, tiers: objVals_(groups), campaigns: objVals_(campaigns), incentive: teamIncentive },
    orders: os
  };
}
function objVals_(o) { return Object.keys(o).map(function (k) { return o[k]; }).sort(function (a, b) { return b.count - a.count; }); }

/** Server-side filtered, sorted, paginated orders for the current (validated) selection. */
function getOrders(token, fy, month, sel, status, page, pageSize, search, sortKey, sortDir, filters) {
  return withSession_('getOrders', token, function (s) { return ordersPage_(s, fy, month, sel, status, page, pageSize, search, sortKey, sortDir, filters); });
}
function ordersPage_(s, fy, month, sel, status, page, pageSize, search, sortKey, sortDir, filters) {
  var r = queryOrders_(s, fy, month, sel, status, search, sortKey, sortDir, filters);
  page = Math.max(1, Number(page) || 1);
  pageSize = Math.min(CONFIG.MAX_PAGE_SIZE, Math.max(5, Number(pageSize) || CONFIG.DEFAULT_PAGE_SIZE));
  var total = r.rows.length, pages = Math.max(1, Math.ceil(total / pageSize)); if (page > pages) page = pages;
  var slice = r.rows.slice((page - 1) * pageSize, page * pageSize).map(function (o) { var x = {}; r.columns.forEach(function (c) { x[c.key] = o[c.key]; }); return x; });
  return { success: true, columns: r.columns, rows: slice, total: total, page: page, pages: pages, pageSize: pageSize, facets: r.facets, counts: r.counts };
}
function exportOrders(token, fy, month, sel, status, search, sortKey, sortDir, filters) {
  return withSession_('exportOrders', token, function (s) {
    var r = queryOrders_(s, fy, month, sel, status, search, sortKey, sortDir, filters), rows = r.rows.slice(0, CONFIG.EXPORT_MAX_ROWS);
    function q(v) { var t = typeof v; v = v == null ? '' : String(v); if (t === 'string' && /^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }   // CSV-injection safe
    var lines = [r.columns.map(function (c) { return q(c.label); }).join(',')];
    rows.forEach(function (o) { lines.push(r.columns.map(function (c) { return q(o[c.key]); }).join(',')); });
    return { success: true, csv: lines.join('\r\n'), filename: 'Achievers_' + (status === 'NOT_CONSIDERED' ? 'Not_Considered' : 'Considered') + '_' + monthKey_(month).replace("'", '') + '.csv', truncated: r.rows.length > rows.length };
  });
}
/** Browser-safe order row (names instead of raw emails). Shared by the order table, export and trend. */
function orderRow_(o, focus) {
  return { invoice: o.invoice, customerId: o.customerId, customer: o.customer, cycle: o.cycle, booker: o.booker ? nameOf_(o.booker) : '', closer: o.closer ? nameOf_(o.closer) : '',
           l1: o.L1 ? nameOf_(o.L1) : '', saleType: o.saleType, share: o.share, payMode: o.payMode, loanProvider: o.loanProvider,
           orderStatus: o.orderStatus, amount: o.amount, eligible: o.eligible, credited: creditFor_(o, focus), saleDate: o.saleDate, payDate: o.payDate, remarks: o.remarks };
}
/** Order-level filters (cycle, sale type, payment mode, search) — the same rules everywhere. */
function orderMatch_(row, filters, q) {
  filters = filters || {};
  if (filters.cycle && (row.cycle || '—') !== filters.cycle) return false;
  if (filters.saleType && (row.saleType || '—') !== filters.saleType) return false;
  if (filters.payMode && (row.payMode || '—') !== filters.payMode) return false;
  if (q) { var hay = [row.invoice, row.customer, row.booker, row.closer, row.l1, row.remarks, row.loanProvider].join(' ').toLowerCase(); if (hay.indexOf(q) < 0) return false; }
  return true;
}
function queryOrders_(s, fy, month, sel, status, search, sortKey, sortDir, filters) {
  var mk = assertPeriod_(fy, month), h = buildHierarchy_(s, mk, sel || {}), focus = resolveFocus_(s, h);
  status = status === 'NOT_CONSIDERED' ? 'NOT_CONSIDERED' : 'CONSIDERED';
  filters = filters || {};
  var q = lc_(search), scoped = scopedOrders_(s, mk, focus);
  var isL0 = focus.kind === 'employee' && (focus.level === 'L0' || scoped.some(function (o) { return ownSale_(o, focus); }));   // personal credit applies
  var cols = ORDER_COLUMNS.filter(function (c) { return !(c.key === 'credited' && (!isL0 || status !== 'CONSIDERED')) && !(c.key === 'cycle' && status === 'NOT_CONSIDERED'); });
  var facets = { cycle: {}, saleType: {}, payMode: {} };
  var counts = { CONSIDERED: 0, NOT_CONSIDERED: 0 };          // filtered counts shown inside the tab buttons
  var rows = [];
  scoped.forEach(function (o) {
    if (o.cls !== 'CONSIDERED' && o.cls !== 'NOT_CONSIDERED') return;
    var row = orderRow_(o, focus);
    if (o.cls === status) { facets.cycle[row.cycle || '—'] = 1; facets.saleType[row.saleType || '—'] = 1; facets.payMode[row.payMode || '—'] = 1; }
    if (!orderMatch_(row, filters, q)) return;
    counts[o.cls]++;
    if (o.cls === status) rows.push(row);
  });
  var col = cols.filter(function (c) { return c.key === sortKey; })[0] || cols[0], dir = sortDir === 'desc' ? -1 : 1;
  rows.sort(function (a, b) {
    var x = a[col.key], y = b[col.key];
    if (col.type === 'date') { x = Date.parse(x) || 0; y = Date.parse(y) || 0; }
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir;
  });
  Object.keys(facets).forEach(function (k) { facets[k] = Object.keys(facets[k]).sort(); });
  return { columns: cols, rows: rows, facets: facets, counts: counts };
}

/* ============================================================================
 * 14. INCENTIVE % TREND (month-wise for the selected FY)
 * ==========================================================================*/
/** Team filters (status dropdown + search) — mirrors the Team performance table. */
function teamMatch_(m, filter, q) {
  if (filter === 'eligible' && !m.eligible) return false;
  if (filter === 'not' && m.eligible) return false;
  if (filter === 'inactive' && m.status !== 'Inactive') return false;
  if (filter === 'reward' && !m.reward) return false;
  if (q && (m.name + ' ' + m.id + ' ' + m.manager + ' ' + m.group).toLowerCase().indexOf(q) < 0) return false;
  return true;
}
/**
 * For every month of the FY: overall incentive earned (Final_Incentive, not paid) of the selected
 * employee + everyone in their authorized span, vs overall revenue considered from Order_Base
 * (CONSIDERED rows only). Incentive % = incentive earned / revenue considered.
 * The month filter is not applied; FY, hierarchy selection, team filters and order filters are.
 * Authorization is re-applied separately for each month.
 */
function getTrend(token, fy, month, sel, teamFilter, orderFilter, mode) {
  return withSession_('getTrend', token, function (s) { return trend_(s, fy, month, sel, teamFilter, orderFilter, mode); });
}
/** mode 'team' (default): the selected person + everyone in their span. mode 'individual': the selected person only
 *  (own incentive; revenue credited to them — own sales share, or the team revenue a manager is measured on). */
function trend_(s, fy, month, sel, teamFilter, orderFilter, mode) {
  {
    var mk = assertPeriod_(fy, month), h = buildHierarchy_(s, mk, sel || {}), focus = resolveFocus_(s, h);
    var indiv = mode === 'individual' && focus.kind === 'employee';          // groups / organisation are always team
    var rootRank = h.root === 'ORG' ? 99 : LEVEL_RANK[h.root];
    teamFilter = teamFilter || {}; orderFilter = orderFilter || {};
    var tf = ['eligible', 'not', 'inactive', 'reward'].indexOf(teamFilter.filter) >= 0 ? teamFilter.filter : 'all', tq = lc_(teamFilter.q);
    var of = orderFilter.filters || {}, oq = lc_(orderFilter.q);
    var avail = availablePeriods_().monthsByFy[fy] || [], y = Number(fy.slice(3, 7));
    var fyMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map(function (m, i) { return m + "'" + String(i < 9 ? y : y + 1).slice(-2); });
    var tot = { incentive: 0, revenue: 0 };
    var points = fyMonths.map(function (m) {
      if (avail.indexOf(m) < 0) return { month: m, hasData: false, incentive: null, revenue: null, pct: null, members: 0, orders: 0 };
      var auth = getAuthorizedEmployees_(s, m), inc = 0, members = 0;
      DRILL_LEVELS.forEach(function (L) {
        auth[L].forEach(function (r) {
          var own = focus.kind === 'employee' && r.email === focus.email;
          if (indiv) { if (own) { inc += memberRow_(s, r, rootRank).incentive; members++; } return; }   // individual: own rows only, team filters n/a
          if (!own && !inSpan_(focus, r)) return;
          var mr = memberRow_(s, r, rootRank);
          if (!teamMatch_(mr, tf, tq)) return;
          inc += mr.incentive; members++;
        });
      });
      var rev = 0, orders = 0;
      scopedOrders_(s, m, focus).forEach(function (o) {
        if (o.cls !== 'CONSIDERED') return;
        var row = orderRow_(o, focus);
        if (!orderMatch_(row, of, oq)) return;
        rev += row.credited; orders++;
      });
      tot.incentive += inc; tot.revenue += rev;
      return { month: m, hasData: true, incentive: round_(inc, 2), revenue: round_(rev, 2), pct: rev ? inc / rev : null, members: members, orders: orders };
    });
    var name = focus.kind === 'org' ? (s.role === 'ADMIN' ? 'Entire organisation' : 'All teams under you') : focus.kind === 'direct' ? 'Direct reports of ' + nameOf_(focus.anchor) : nameOf_(focus.email);
    return {
      success: true, fy: fy, focusName: name, points: points, mode: indiv ? 'individual' : 'team', focusLevel: focus.kind === 'employee' ? focus.level : '',
      totals: { incentive: round_(tot.incentive, 2), revenue: round_(tot.revenue, 2), pct: tot.revenue ? tot.incentive / tot.revenue : null },
      filters: { team: !indiv && (tf !== 'all' || !!tq), orders: !!(of.cycle || of.saleType || of.payMode || oq) }
    };
  }
}

/** Spec-compatible wrapper: authorized employee list for the current user and period. */
function getAuthorizedEmployees(token, fy, month) {
  return withSession_('getAuthorizedEmployees', token, function (s) {
    var mk = assertPeriod_(fy, month), auth = getAuthorizedEmployees_(s, mk), out = [];
    DRILL_LEVELS.forEach(function (L) { auth[L].forEach(function (r) { out.push({ level: L, name: r.name, email: r.email, id: r.id, status: statusOf_(r.email) }); }); });
    return { success: true, employees: out };
  });
}

/* ============================================================================
 * 15. MONTHLY LOGIN TRACKING (existing "Login_Activity_2026" sheet)
 * ==========================================================================*/
var LOGIN_ACTIVITY_HEADERS = ['User ID', 'User Name', 'Email', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total Logins', 'Last Login Date'];

/**
 * Records one successful login for the user in the existing Login_Activity_2026 sheet (CONFIG.SHEETS.LOGIN_ACTIVITY).
 * - Finds columns by header name; appends only missing headers (existing columns are never moved or cleared).
 * - Finds the user's row by User ID (preferred), else Email; updates only that row.
 * - Adds a new row only when the user is not present. Historical month counts are preserved.
 * Returns { success, created, row, month, monthCount, total } or { success:false, message }.
 */
function trackLogin(userId, userName, email) {
  var sh = getSpreadsheet_().getSheetByName(CONFIG.SHEETS.LOGIN_ACTIVITY);
  if (!sh) { console.error('trackLogin: sheet "' + CONFIG.SHEETS.LOGIN_ACTIVITY + '" not found; login not tracked.'); return { success: false, message: CONFIG.SHEETS.LOGIN_ACTIVITY + ' sheet not found' }; }
  userId = str_(userId); userName = str_(userName); email = str_(email);
  if (!userId && !email) return { success: false, message: 'User ID or Email is required' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { console.error('trackLogin: lock timeout for ' + email); return { success: false, message: 'Busy, login not tracked' }; }
  try {
    // --- Header row: map existing columns, append any missing required headers at the end ---
    var lastCol = sh.getLastColumn();
    var headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var col = {};
    headers.forEach(function (h, i) { var k = hkey_(h); if (k && !col.hasOwnProperty(k)) col[k] = i + 1; });
    var missing = LOGIN_ACTIVITY_HEADERS.filter(function (h) { return !col.hasOwnProperty(hkey_(h)); });
    if (missing.length) {
      var start = lastCol + 1, need = lastCol + missing.length;
      if (need > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
      sh.getRange(1, start, 1, missing.length).setValues([missing]);
      missing.forEach(function (h, i) { col[hkey_(h)] = start + i; });
      lastCol = need;
    }
    var c = function (h) { return col[hkey_(h)]; };

    var tz = tz_(), now = new Date(), month = Utilities.formatDate(now, tz, 'MMM');   // Jan..Dec
    var months = LOGIN_ACTIVITY_HEADERS.slice(3, 15);

    // --- Locate the user's row: User ID first, then Email ---
    var lastRow = sh.getLastRow(), row = -1;
    if (lastRow >= 2) {
      var ids = sh.getRange(2, c('User ID'), lastRow - 1, 1).getValues();
      var mails = sh.getRange(2, c('Email'), lastRow - 1, 1).getValues();
      if (userId) for (var i = 0; i < ids.length; i++) { if (lc_(ids[i][0]) === lc_(userId)) { row = i + 2; break; } }
      if (row < 0 && email) for (var j = 0; j < mails.length; j++) { if (lc_(mails[j][0]) === lc_(email)) { row = j + 2; break; } }
    }

    if (row < 0) {
      // --- New user: one new row; other (non-tracking) columns stay blank ---
      var arr = []; for (var k = 0; k < lastCol; k++) arr.push('');
      arr[c('User ID') - 1] = userId; arr[c('User Name') - 1] = userName; arr[c('Email') - 1] = email;
      months.forEach(function (m) { arr[c(m) - 1] = m === month ? 1 : 0; });
      arr[c('Total Logins') - 1] = 1;
      arr[c('Last Login Date') - 1] = now;
      sh.appendRow(arr);
      row = sh.getLastRow();
      sh.getRange(row, c('Last Login Date')).setNumberFormat('dd-MMM-yyyy HH:mm:ss');
      return { success: true, created: true, row: row, month: month, monthCount: 1, total: 1 };
    }

    // --- Existing user: update only this row's tracking cells ---
    var vals = sh.getRange(row, 1, 1, lastCol).getValues()[0], cur = {};               // one bulk read of the row
    months.forEach(function (m) { cur[m] = n0_(vals[c(m) - 1]); });
    cur[month] += 1;
    var total = months.reduce(function (t, m) { return t + cur[m]; }, 0);
    sh.getRange(row, c(month)).setValue(cur[month]);
    sh.getRange(row, c('Total Logins')).setValue(total);
    sh.getRange(row, c('Last Login Date')).setValue(now).setNumberFormat('dd-MMM-yyyy HH:mm:ss');
    [['User ID', userId], ['User Name', userName], ['Email', email]].forEach(function (p) {          // fill blank identity cells of this row only
      if (p[1] && !str_(vals[c(p[0]) - 1])) sh.getRange(row, c(p[0])).setValue(p[1]);
    });
    return { success: true, created: false, row: row, month: month, monthCount: cur[month], total: total };
  } finally {
    lock.releaseLock();
  }
}

  /* ============================================================================== */

  var LOCAL = { getView: getView, getOrders: getOrders, getTrend: getTrend };
  var loadedToken = null;
  window.AchieversLocal = {
    /** snap = reply of the server's __snapshot(token) */
    load: function (snap, token) {
      props = new Map([['DATA_VERSION', snap.ver], ['EMP_VERSION', snap.empVer], [snap.sessionKey, snap.session]]);
      mem = new Map(); Object.keys(snap.cache).forEach(function (k) { mem.set(k, { v: snap.cache[k], exp: 0 }); });
      TZ = snap.tz || TZ; MEMO_ = {}; loadedToken = token;
      var bytes = 0; Object.keys(snap.cache).forEach(function (k) { bytes += snap.cache[k].length; });
      return bytes;
    },
    has: function (name, args) { return !!loadedToken && LOCAL.hasOwnProperty(name) && args && args[0] === loadedToken; },
    /** returns { ok: true, value } or { ok: false } when the server must answer instead */
    run: function (name, args) {
      if (!this.has(name, args)) return { ok: false };
      needServer = false;
      var v; try { v = LOCAL[name].apply(null, args); } catch (e) { return { ok: false }; }
      if (needServer || !v || v.success === false) { if (needServer) MEMO_ = {}; return { ok: false }; }
      return { ok: true, value: v };
    },
    clear: function () { loadedToken = null; props = new Map(); mem = new Map(); MEMO_ = {}; }
  };
})();
