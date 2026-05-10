
// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let lang = 'ar';
let rawData = [];
let cleanData = [];
let headers = [];
let rawHeaders = [];   // headers BEFORE cleaning (for before/after comparison)
let filename = '';
let problems = {};
let undoStack = [];
let opsLog = [];
let chatHistory = [];
let dataContext = '';
let processingStart = 0;

const EMPTY_VALS = new Set([
  '', 'null', 'undefined', 'n/a', 'na', 'none', 'nil', 'missing', '?', '؟',
  'لا يوجد', 'لا توجد', 'غير متاح', 'غير متوفر', 'غير محدد', 'غير معروف',
  'مجهول', '-', '--', '---', '#n/a', '#null!', '#value!', 'nan'
]);

// ═══════════════════════════════════════════════════════
// HIJRI CONVERSION
// ═══════════════════════════════════════════════════════
function gregorianToHijri(y, m, d) {
  const jd = Math.floor((1461 * (y + 4800 + Math.floor((m-14)/12))) / 4)
    + Math.floor((367 * (m - 2 - 12 * Math.floor((m-14)/12))) / 12)
    - Math.floor((3 * Math.floor((y + 4900 + Math.floor((m-14)/12)) / 100)) / 4)
    + d - 32075;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l-1)/10631);
  l = l - 10631*n + 354;
  const j = Math.floor((10985-l)/5316)*Math.floor((50*l)/17719) + Math.floor(l/5670)*Math.floor((43*l)/15238);
  l = l - Math.floor((30-j)/15)*Math.floor((17719*j)/50) - Math.floor(j/16)*Math.floor((15238*j)/43) + 29;
  const hm = Math.floor((24*l)/709);
  const hd = l - Math.floor((709*hm)/24);
  const hy = 30*n + j - 30;
  const HM = ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
  return `${hd} ${HM[hm-1]} ${hy}`;
}

function formatDateBoth(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const greg = d.toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
  const hijri = gregorianToHijri(d.getFullYear(), d.getMonth()+1, d.getDate());
  return `${greg} | ${hijri}`;
}

// ═══════════════════════════════════════════════════════
// LANGUAGE
// ═══════════════════════════════════════════════════════
function toggleLang() {
  lang = lang === 'ar' ? 'en' : 'ar';
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-ar]').forEach(el => {
    el.textContent = lang === 'ar' ? el.dataset.ar : el.dataset.en;
  });
  document.querySelectorAll('.btn-lang').forEach(el => el.textContent = lang === 'ar' ? 'EN' : 'AR');
  const chatPlaceholder = document.getElementById('chat-input');
  if (chatPlaceholder) chatPlaceholder.placeholder = lang === 'ar' ? 'اكتب سؤالك...' : 'Type your question...';
}

// ═══════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
  const showChat = ['diagnosis', 'insights', 'export'].includes(id);
  document.getElementById('chat-btn').classList.toggle('show', showChat);
}

// ═══════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════
function generateSampleData() {
  const products = ['لابتوب HP','هاتف Samsung','طابعة Canon','شاشة LG','لوحة مفاتيح Logitech','ماوس Microsoft','سماعات Sony','كاميرا Nikon'];
  const regions = ['الرياض','جدة','الدمام','مكة','المدينة','أبها','تبوك','حائل'];
  const statuses = ['مكتمل','معلق','ملغي','قيد المعالجة'];
  const dateFormats = [
    (d) => `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`,
    (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    (d) => `${d.getMonth()+1}-${d.getDate()}-${d.getFullYear()}`,
  ];
  const rows = [];
  for (let i = 1; i <= 52; i++) {
    const d = new Date(2024, Math.floor(Math.random()*12), Math.floor(Math.random()*28)+1);
    const price = (Math.random() * 2000 + 100).toFixed(2);
    const qty = Math.floor(Math.random() * 50) + 1;
    rows.push({
      'رقم_العميل': `C${String(i).padStart(4,'0')}`,
      'الاسم': `عميل ${i}`,
      'المنتج': products[i % products.length],
      'السعر': price,
      'الكمية': qty,
      'تاريخ_الشراء': dateFormats[i % 3](d),
      'المنطقة': regions[i % regions.length],
      'الحالة': statuses[i % statuses.length]
    });
  }
  // Inject problems
  rows[5]['السعر'] = 99999.99; // outlier
  rows[15]['السعر'] = 85000.00; // outlier
  rows[30]['السعر'] = 110000.00; // outlier
  rows[3]['الاسم'] = ''; // empty
  rows[8]['المنطقة'] = 'N/A';
  rows[12]['المنتج'] = 'لا يوجد';
  rows[18]['الحالة'] = '';
  rows[22]['الاسم'] = null;
  rows[25]['الكمية'] = 'غير متاح';
  rows[28]['المنطقة'] = null;
  rows[35]['المنتج'] = '';
  rows[40]['الحالة'] = 'N/A';
  // Add duplicates
  for (let i = 0; i < 8; i++) rows.push({...rows[i]});
  // Add empty columns (will be faked via the diagnosis)
  rows.forEach(r => { r['ملاحظات'] = ''; r['رمز_إضافي'] = ''; });
  return rows;
}

// ═══════════════════════════════════════════════════════
// FILE HANDLING
// ═══════════════════════════════════════════════════════
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}
function handleFile(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}
function processFile(file) {
  const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
  const ALLOWED_EXTS = ['csv', 'xlsx', 'xls'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    showToast((lang === 'ar' ? 'نوع الملف غير مسموح. المقبول: CSV, XLSX, XLS ❌' : 'File type not allowed. Accepted: CSV, XLSX, XLS ❌'), 'error');
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    showToast((lang === 'ar' ? `حجم الملف (${(file.size/1048576).toFixed(1)} MB) يتجاوز الحد الأقصى 20 MB ❌` : `File size (${(file.size/1048576).toFixed(1)} MB) exceeds 20 MB limit ❌`), 'error');
    return;
  }
  filename = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      rawData = json;
      headers = json.length ? Object.keys(json[0]) : [];
      startProcessing();
    } catch(err) { showToast((lang === 'ar' ? 'خطأ في قراءة الملف ❌' : 'File read error ❌'), 'error'); }
  };
  reader.readAsArrayBuffer(file);
}
function loadSampleData() {
  filename = 'بيانات_تجريبية.csv';
  rawData = generateSampleData();
  headers = Object.keys(rawData[0]);
  startProcessing();
}

// ═══════════════════════════════════════════════════════
// PROCESSING
// ═══════════════════════════════════════════════════════
const statusMessages = {
  ar: ['جاري قراءة الملف...','كشف الأعمدة...','تحليل جودة البيانات...','اكتشاف المشاكل...','تجهيز التقرير...'],
  en: ['Reading file...','Detecting columns...','Analyzing data quality...','Finding issues...','Preparing report...']
};
function startProcessing() {
  processingStart = Date.now();
  showScreen('processing');
  startParticles('particles-canvas');
  const bar = document.getElementById('progress-bar');
  const msg = document.getElementById('status-msg');
  let pct = 0, msgIdx = 0;
  const interval = setInterval(() => {
    pct += (100 - pct) * 0.05 + 0.5;
    if (pct > 99) pct = 99;
    bar.style.width = pct + '%';
    const newIdx = Math.min(Math.floor(pct / 20), statusMessages[lang].length - 1);
    if (newIdx !== msgIdx) { msgIdx = newIdx; msg.textContent = statusMessages[lang][msgIdx]; }
  }, 60);
  setTimeout(() => {
    clearInterval(interval);
    bar.style.width = '100%';
    analyzeData();
    setTimeout(() => { stopParticles(); showDiagnosis(); }, 400);
  }, 2500);
}

// ═══════════════════════════════════════════════════════
// ANALYSIS
// ═══════════════════════════════════════════════════════
function isEmpty(v) {
  if (v === null || v === undefined) return true;
  return EMPTY_VALS.has(String(v).trim().toLowerCase());
}
function isNumeric(v) { return !isEmpty(v) && !isNaN(parseFloat(String(v).replace(/,/g,''))) && isFinite(String(v).replace(/,/g,'')); }
function isDate(v) {
  if (isEmpty(v)) return false;
  const s = String(v);
  return /\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}/.test(s) || !isNaN(Date.parse(s));
}

// ─── Duplicate Detection ────────────────────────────────
// Returns { count, problemCells }
// count = number of EXTRA copies (originals not counted)
// problemCells = { rowIndex: { col: 'duplicate' } }
// Robust cell normalization: handles invisible Unicode, BOM, NBSP, Arabic variants,
// and canonicalises numbers so "1234.50" === "1234.5" === "1234.500"
function normalizeCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v)
    .normalize('NFKC')                          // decompose + recompose (handles Arabic variants)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')     // control characters → space
    .replace(/[\u200B-\u200F\uFEFF\u00AD]/g, '') // zero-width / soft-hyphen → remove
    .replace(/\u00A0/g, ' ')                    // non-breaking space → regular space
    .replace(/\s+/g, ' ')                       // collapse multiple spaces
    .trim()
    .toLowerCase();

  // Canonicalise plain numbers: strip thousands-commas, then parse
  // "1,234.50" → 1234.5 → "1234.5"  |  "007" stays "007" (leading zeros → keep as text)
  const noCommas = s.replace(/,/g, '');
  if (noCommas !== '' && !isNaN(Number(noCommas)) && isFinite(Number(noCommas)) && !/^0\d/.test(noCommas)) {
    return String(Number(noCommas));
  }
  return s;
}

// Return how many unique normalised values col has across all rows
function colUniqueCount(data, col) {
  return new Set(data.map(r => normalizeCell(r[col]))).size;
}

// Heuristic: a column is a "unique-ID" column if every row has a distinct value
// AND (name looks like an ID  OR  values look like sequential numbers / GUIDs)
function isUniqueIdCol(data, col) {
  if (data.length < 2) return false;
  if (colUniqueCount(data, col) < data.length) return false; // not all-unique
  // name heuristic
  const n = col.toLowerCase();
  if (/id|رقم|serial|seq|ref|uuid|guid|timestamp|وقت|تاريخ.*_?id|order.*num|invoice|فاتورة|رمز/.test(n)) return true;
  // value heuristic: looks sequential (C001, TXN-1, 1 2 3 …)
  const sample = data.slice(0, Math.min(5, data.length)).map(r => normalizeCell(r[col]));
  const allNumeric = sample.every(v => /^\d+$/.test(v));
  const allPrefixed = sample.every(v => /^[a-z]{1,5}\d+$/i.test(v));
  return allNumeric || allPrefixed;
}

function runDupPass(data, cols) {
  const makeKey = row => cols.map(h => normalizeCell(row[h])).join('\x1F');
  const rowCounts = new Map();
  data.forEach(row => { const k = makeKey(row); rowCounts.set(k, (rowCounts.get(k) || 0) + 1); });
  let count = 0;
  const cells = {};
  const partner = {};   // ri → first-seen row index of the same key
  const rowSeen = new Map();
  data.forEach((row, ri) => {
    const k = makeKey(row);
    if (rowCounts.get(k) > 1) {
      if (!cells[ri]) cells[ri] = {};
      cols.forEach(col => { cells[ri][col] = 'duplicate'; });
      if (!rowSeen.has(k)) {
        rowSeen.set(k, ri);
        partner[ri] = null;          // first occurrence — partner unknown yet; will patch below
      } else {
        const firstRi = rowSeen.get(k);
        partner[ri]      = firstRi;  // this row is a copy of firstRi
        if (partner[firstRi] === null) partner[firstRi] = ri; // patch first occ
        count++;
      }
    }
  });
  return { count, cells, partner };
}

function detectDuplicates(data, cols) {
  if (!data.length || !cols.length) return { count: 0, cells: {}, excludedCols: [] };

  // Pass A: compare ALL columns
  const resultA = runDupPass(data, cols);
  if (resultA.count > 0) return { ...resultA, excludedCols: [] };

  // Pass B: exclude columns that are all-unique (likely ID / serial columns)
  const idCols = cols.filter(c => isUniqueIdCol(data, c));
  if (idCols.length === 0) return { count: 0, cells: {}, excludedCols: [] };
  const dataCols = cols.filter(c => !idCols.includes(c));
  if (dataCols.length === 0) return { count: 0, cells: {}, excludedCols: [] };
  const resultB = runDupPass(data, dataCols);
  return { ...resultB, excludedCols: idCols };
}

function analyzeData() {
  problems = { duplicates: 0, emptyCells: 0, formatIssues: 0, outliers: 0, emptyColumns: 0 };
  const problemCells = {};

  // Duplicates
  const dupResult = detectDuplicates(rawData, headers);
  problems.duplicates = dupResult.count;
  problems._uniqueRows = rawData.length - dupResult.count;
  problems._excludedCols = dupResult.excludedCols || [];
  problems._dupPartner   = dupResult.partner || {};   // ri → partner row index
  Object.entries(dupResult.cells).forEach(([ri, cols]) => {
    if (!problemCells[ri]) problemCells[ri] = {};
    Object.assign(problemCells[ri], cols);
  });

  // Empty cells + format issues
  headers.forEach(col => {
    rawData.forEach((row, ri) => {
      const v = row[col];
      if (isEmpty(v)) {
        problems.emptyCells++;
        if (!problemCells[ri]) problemCells[ri] = {};
        problemCells[ri][col] = 'empty';
      }
    });
  });

  // Empty columns
  headers.forEach(col => {
    const allEmpty = rawData.every(r => isEmpty(r[col]));
    if (allEmpty) problems.emptyColumns++;
  });

  // Outliers — use IQR method (robust against outliers skewing the mean/std)
  headers.forEach(col => {
    const nums = rawData
      .map(r => parseFloat(String(r[col]).replace(/,/g,'')))
      .filter(n => !isNaN(n));
    if (nums.length < 5) return;
    const sorted = [...nums].sort((a, b) => a - b);
    const q1  = sorted[Math.floor(sorted.length * 0.25)];
    const q3  = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    if (iqr === 0) return;                         // no spread → skip
    const lo  = q1 - 1.5 * iqr;
    const hi  = q3 + 1.5 * iqr;
    rawData.forEach((row, ri) => {
      const n = parseFloat(String(row[col]).replace(/,/g,''));
      if (!isNaN(n) && (n < lo || n > hi)) {
        problems.outliers++;
        if (!problemCells[ri]) problemCells[ri] = {};
        problemCells[ri][col] = 'outlier';         // outlier wins over duplicate
      }
    });
  });

  // Format issues (mixed date formats — strict regex only, no Date.parse, minority cells only)
  const DATE_PATTERNS = [
    { name: 'iso',      re: /^\d{4}-\d{2}-\d{2}($|[T ])/ },   // 2024-01-15
    { name: 'isoslash', re: /^\d{4}\/\d{2}\/\d{2}$/ },         // 2024/01/15
    { name: 'dmy',      re: /^\d{1,2}\/\d{1,2}\/\d{4}$/ },     // 15/1/2024
    { name: 'dmy-dash', re: /^\d{1,2}-\d{1,2}-\d{4}$/ },       // 15-1-2024 (day first)
    { name: 'mdy-dash', re: /^\d{1,2}-\d{1,2}-\d{4}$/ },       // overlap handled by order
  ];
  const getStrictFormat = s => {
    if (/^\d{4}-\d{2}-\d{2}($|[T ])/.test(s)) return 'iso';
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(s))      return 'isoslash';
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s))  return 'dmy';
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s))    return 'dmy-dash';
    return null; // not a recognized date format
  };
  headers.forEach(col => {
    // Only consider cells that match a STRICT date pattern
    const dateRows = rawData.map((r, ri) => ({ v: String(r[col] ?? '').trim(), ri }))
      .filter(({ v }) => getStrictFormat(v) !== null);
    // Column must have enough date values to be considered a date column
    if (dateRows.length < 3 || dateRows.length < rawData.length * 0.25) return;
    // Count each format
    const fmtCounts = new Map();
    dateRows.forEach(({ v }) => {
      const f = getStrictFormat(v);
      fmtCounts.set(f, (fmtCounts.get(f) || 0) + 1);
    });
    if (fmtCounts.size <= 1) return; // all same format — no problem
    // Find the majority format
    let majorFmt = null, majorCount = 0;
    fmtCounts.forEach((cnt, fmt) => { if (cnt > majorCount) { majorCount = cnt; majorFmt = fmt; } });
    // Count and mark only minority-format cells
    dateRows.forEach(({ v, ri }) => {
      if (getStrictFormat(v) !== majorFmt) {
        problems.formatIssues++;
        if (!problemCells[ri]) problemCells[ri] = {};
        if (!problemCells[ri][col]) problemCells[ri][col] = 'format';
      }
    });
  });

  problems._cells = problemCells;

  // Build data context for AI
  const numericCols = headers.filter(h => rawData.filter(r => isNumeric(r[h])).length > rawData.length * 0.5);
  const stats = numericCols.slice(0,3).map(col => {
    const nums = rawData.map(r => parseFloat(String(r[col]).replace(/,/g,''))).filter(n => !isNaN(n));
    const mean = nums.reduce((a,b)=>a+b,0)/nums.length;
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    return `${col}: min=${min.toFixed(2)}, max=${max.toFixed(2)}, avg=${mean.toFixed(2)}`;
  }).join('; ');

  dataContext = `الملف: ${filename}
الأعمدة: ${headers.join(', ')}
عدد الصفوف: ${rawData.length}
عينة من البيانات: ${JSON.stringify(rawData.slice(0,5))}
إحصائيات: ${stats}
المشاكل: ${problems.duplicates} صفوف مكررة, ${problems.emptyCells} خلية فارغة, ${problems.outliers} قيمة شاذة`;
}

// ═══════════════════════════════════════════════════════
// DIAGNOSIS DASHBOARD
// ═══════════════════════════════════════════════════════
function showDiagnosis() {
  showScreen('diagnosis');
  renderFileSummary();
  renderProblems();
  renderSuggestions();
  renderPreviewTable();
  animateGauge();
}

function computeQualityScore() {
  const total = rawData.length * headers.length;
  if (!total) return 100;
  const issueCount = problems.duplicates * headers.length + problems.emptyCells + problems.outliers;
  return Math.max(0, Math.round(100 - (issueCount / total * 100)));
}

function animateGauge() {
  const score = computeQualityScore();
  const ring = document.getElementById('gauge-ring');
  const scoreEl = document.getElementById('gauge-score');
  const circumference = 326;
  const color = score < 50 ? '#ef4444' : score < 75 ? '#f59e0b' : '#10b981';
  ring.style.stroke = color;
  let current = 0;
  const anim = setInterval(() => {
    current = Math.min(current + 2, score);
    const offset = circumference - (circumference * current / 100);
    ring.style.strokeDashoffset = offset;
    scoreEl.textContent = current + '%';
    if (current >= score) clearInterval(anim);
  }, 20);
}

function renderFileSummary() {
  const el = document.getElementById('file-summary-content');
  const uniqueRows   = problems._uniqueRows ?? rawData.length;
  const dupCount     = problems.duplicates  ?? 0;
  const excluded     = problems._excludedCols || [];
  const dupLine = dupCount > 0
    ? `<span style="color:#ef4444;font-weight:700">${dupCount} ${lang==='ar'?'مكررة':'dupes'}</span>`
    : `<span style="color:#10b981">${lang==='ar'?'لا تكرار':'No dupes'}</span>`;
  const excludeNote = (excluded.length > 0 && dupCount > 0)
    ? `<div style="margin-top:.3rem;font-size:.78rem;color:var(--muted);font-style:italic">
        ${lang==='ar'
          ? `* تم استبعاد أعمدة الـ ID تلقائياً: <strong>${excluded.join('، ')}</strong>`
          : `* ID columns auto-excluded: <strong>${excluded.join(', ')}</strong>`}
       </div>`
    : '';
  el.innerHTML = `
    <div style="display:grid;gap:.5rem;font-size:.9rem;margin-bottom:.5rem">
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">${lang==='ar'?'اسم الملف':'File Name'}</span><span style="font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${filename}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">${lang==='ar'?'إجمالي الصفوف':'Total Rows'}</span><span style="font-weight:600">${rawData.length.toLocaleString()}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">${lang==='ar'?'صفوف فريدة':'Unique Rows'}</span><span style="font-weight:600">${uniqueRows.toLocaleString()} ${dupLine}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">${lang==='ar'?'عدد الأعمدة':'Columns'}</span><span style="font-weight:600">${headers.length}</span></div>
    </div>${excludeNote}`;
}

function renderProblems() {
  const el = document.getElementById('problems-list');
  const items = [
    /* Colors match the preview table highlights exactly:
       red=empty, purple=duplicate, yellow=outlier, cyan=format, orange=emptyCol */
    { count: problems.emptyCells,   cls: 'badge-red',    icon: '🔴', okIcon: '✅', ar: `خلايا فارغة`,            en: `Empty cells` },
    { count: problems.duplicates,   cls: 'badge-purple', icon: '🟣', okIcon: '✅', ar: `صفوف مكررة`,             en: `Duplicate rows` },
    { count: problems.outliers,     cls: 'badge-yellow', icon: '🟡', okIcon: '✅', ar: `قيم شاذة`,               en: `Outliers` },
    { count: problems.formatIssues, cls: 'badge-cyan',   icon: '🔵', okIcon: '✅', ar: `تنسيقات تاريخ مختلطة`,  en: `Mixed date formats` },
    { count: problems.emptyColumns, cls: 'badge-orange', icon: '🟠', okIcon: '✅', ar: `أعمدة فارغة كلياً`,     en: `Empty columns` },
  ];
  el.innerHTML = items.map((it, i) => {
    const found = it.count > 0;
    const label = found
      ? (lang==='ar' ? `${it.ar} (${it.count.toLocaleString()})` : `${it.en} (${it.count.toLocaleString()})`)
      : (lang==='ar' ? `لا توجد ${it.ar}` : `No ${it.en.toLowerCase()}`);
    return `
    <div class="problem-badge ${found ? it.cls : 'badge-ok'}" style="animation-delay:${i*0.1}s">
      ${found ? it.icon : it.okIcon} <span>${label}</span>
    </div>`;
  }).join('');
  setTimeout(() => el.querySelectorAll('.problem-badge').forEach(b => b.classList.add('show')), 100);
}

function renderSuggestions() {
  const el = document.getElementById('suggestions-list');
  const suggestions = [];
  if (problems.duplicates > 0) suggestions.push({
    ar: `لاحظنا ${problems.duplicates} صفاً مكرراً — نحذفها؟`,
    en: `Found ${problems.duplicates} duplicate rows — remove them?`,
    action: 'removeDuplicates'
  });
  if (problems.emptyCells > 0) suggestions.push({
    ar: `هناك ${problems.emptyCells} خلية فارغة — نملأها بقيمة افتراضية؟`,
    en: `${problems.emptyCells} empty cells found — fill with default values?`,
    action: 'fillEmpty'
  });
  if (problems.emptyColumns > 0) suggestions.push({
    ar: `${problems.emptyColumns} أعمدة فارغة بالكامل — نحذفها؟`,
    en: `${problems.emptyColumns} completely empty columns — remove them?`,
    action: 'removeEmptyCols'
  });
  if (problems.formatIssues > 0) suggestions.push({
    ar: `عمود التاريخ يحتوي تنسيقات مختلطة — نوحّدها؟`,
    en: `Date column has mixed formats — standardize them?`,
    action: 'standardizeDates'
  });
  el.innerHTML = suggestions.map((s,i) => `
    <div class="suggestion-card" style="animation-delay:${i*0.1}s">
      <span class="suggestion-text">${lang==='ar'?s.ar:s.en}</span>
      <div class="suggestion-actions">
        <button class="btn-yes" onclick="applySuggestion('${s.action}', this)" data-ar="✓ نعم" data-en="✓ Yes">✓ نعم</button>
        <button class="btn-ignore" onclick="this.closest('.suggestion-card').remove()" data-ar="تجاهل" data-en="Ignore">تجاهل</button>
      </div>
    </div>`).join('');
}

function applySuggestion(action, btn) {
  btn.closest('.suggestion-card').style.opacity = '.5';
  btn.closest('.suggestion-card').querySelectorAll('button').forEach(b => b.disabled = true);
  // Mark as pending — will be applied during cleaning
  if (!window._pendingActions) window._pendingActions = [];
  window._pendingActions.push(action);
  btn.textContent = '✓';
  btn.style.background = 'rgba(16,185,129,0.4)';
}

function renderPreviewTable() {
  const wrap = document.querySelector('.card .data-table-wrap');
  const tbl  = document.getElementById('preview-table');
  const preview = rawData.slice(0, 15);
  const cells   = problems._cells || {};

  // ── Legend ──
  const legendEl = wrap?.previousElementSibling?.nextElementSibling || null;
  const legendHTML = `
    <div class="preview-legend">
      <div class="legend-item"><div class="legend-dot" style="background:rgba(239,68,68,0.6);border:2px solid #ef4444"></div><span style="color:#fca5a5">${lang==='ar'?'خلية فارغة':'Empty cell'}</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:rgba(139,92,246,0.6);border:2px solid #8b5cf6"></div><span style="color:#c4b5fd">${lang==='ar'?'صف مكرر':'Duplicate row'}</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:rgba(245,158,11,0.6);border:2px solid #f59e0b"></div><span style="color:#fde68a">${lang==='ar'?'قيمة شاذة':'Outlier'}</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:rgba(6,182,212,0.6);border:2px solid #06b6d4"></div><span style="color:#67e8f9">${lang==='ar'?'تنسيق تاريخ مختلط':'Mixed date format'}</span></div>
    </div>`;
  // Inject legend before the table wrapper (once)
  if (wrap && !wrap.previousElementSibling?.classList.contains('preview-legend')) {
    wrap.insertAdjacentHTML('beforebegin', legendHTML);
  } else if (wrap && wrap.previousElementSibling?.classList.contains('preview-legend')) {
    wrap.previousElementSibling.outerHTML = legendHTML;
  }

  const dupPartner = problems._dupPartner || {};

  const tipMap = {
    empty:     lang==='ar'?'خلية فارغة'       :'Empty cell',
    duplicate: lang==='ar'?'صف مكرر'          :'Duplicate row',
    outlier:   lang==='ar'?'قيمة شاذة'         :'Outlier value',
    format:    lang==='ar'?'تنسيق تاريخ مختلط' :'Mixed date format',
  };
  const rowIcon = { empty: '⬜', duplicate: '🔁', outlier: '📐', format: '📅' };

  // ── Table ──
  const ths = `<th class="row-type-cell" title="${lang==='ar'?'نوع المشكلة':'Issue type'}">⚠️</th>` +
              headers.map(h => `<th>${h}</th>`).join('');

  const rows = preview.map((row, ri) => {
    const rowCells = cells[ri] || {};
    const flags    = Object.values(rowCells);

    // Priority: outlier > duplicate > format > empty
    // (duplicate wins over empty because having a duplicate row is the primary issue)
    const dominant = flags.includes('outlier')   ? 'outlier'
                   : flags.includes('duplicate') ? 'duplicate'
                   : flags.includes('format')    ? 'format'
                   : flags.includes('empty')     ? 'empty'
                   : null;

    // Build the row-badge tooltip — for duplicates, show partner row number
    let rowTip = dominant ? tipMap[dominant] : '';
    if (dominant === 'duplicate' && dupPartner[ri] != null) {
      const partnerRow = dupPartner[ri] + 1; // 1-based for display
      rowTip = lang === 'ar'
        ? `🔁 صف مكرر — نسخة منه في الصف ${partnerRow}`
        : `🔁 Duplicate row — copy found at row ${partnerRow}`;
    }

    const typeCell = `<td class="row-type-cell" title="${rowTip}">${dominant ? rowIcon[dominant] : ''}</td>`;

    const dataCells = headers.map(col => {
      const v    = String(row[col] ?? '').slice(0, 40);
      const flag = rowCells[col];
      const cls  = flag === 'empty'     ? 'cell-error'
                 : flag === 'outlier'   ? 'cell-warning'
                 : flag === 'duplicate' ? 'cell-duplicate'
                 : flag === 'format'    ? 'cell-format'
                 : '';
      // For duplicate cells also show partner row
      let cellTip = flag ? tipMap[flag] : '';
      if (flag === 'duplicate' && dupPartner[ri] != null) {
        const partnerRow = dupPartner[ri] + 1;
        cellTip = lang === 'ar'
          ? `🔁 مكرر في الصف ${partnerRow}`
          : `🔁 Duplicated at row ${partnerRow}`;
      }
      const tip = cellTip ? `title="${cellTip}"` : '';
      return `<td class="${cls}" ${tip}>${v}</td>`;
    }).join('');

    return `<tr>${typeCell}${dataCells}</tr>`;
  }).join('');

  tbl.innerHTML = `<thead><tr>${ths}</tr></thead><tbody>${rows}</tbody>`;
}

// ═══════════════════════════════════════════════════════
// CLEANING
// ═══════════════════════════════════════════════════════
function startCleaning() {
  showScreen('cleaning');
  startParticles('particles-canvas2');
  cleanData = JSON.parse(JSON.stringify(rawData));
  rawHeaders = [...headers];   // snapshot BEFORE cleaning mutates headers
  undoStack.push(JSON.parse(JSON.stringify(cleanData)));
  opsLog = [];

  const counter = document.getElementById('cleaning-counter');
  const zone = document.getElementById('row-anim-zone');
  zone.innerHTML = '';

  let removed = 0, fixed = 0, step = 0;
  const totalSteps = rawData.length;

  const animInterval = setInterval(() => {
    if (step < Math.min(8, totalSteps)) {
      const div = document.createElement('div');
      div.className = 'anim-row ' + (step % 3 === 0 ? 'bad' : 'good');
      div.textContent = step % 3 === 0
        ? (lang==='ar' ? '✕ صف مشكلة — يتم حذفه' : '✕ Problem row — removing')
        : (lang==='ar' ? '✓ صف نظيف' : '✓ Clean row');
      zone.appendChild(div);
      if (zone.children.length > 5) zone.removeChild(zone.firstChild);
    }
    step++;
    if (step < totalSteps * 0.5) {
      removed = Math.floor(step / totalSteps * problems.duplicates);
      fixed = Math.floor(step / totalSteps * problems.emptyCells);
      counter.textContent = removed + fixed;
    }
  }, 50);

  setTimeout(() => {
    clearInterval(animInterval);
    stopParticles();
    performCleaning();
    showConfetti();
    showToast(lang==='ar' ? '✨ تم التنظيف بنجاح!' : '✨ Cleaning complete!', 'success');
    setTimeout(() => showInsights(), 1500);
  }, 2500);
}

function performCleaning() {
  undoStack.push(JSON.parse(JSON.stringify(cleanData)));
  if (undoStack.length > 20) undoStack.shift();

  // ── 1. Trim ALL strings first (prerequisite for correct empty detection) ──
  cleanData.forEach(r => headers.forEach(h => { if (typeof r[h] === 'string') r[h] = r[h].trim(); }));
  addOp(`✂️ ${lang==='ar'?'إزالة المسافات الزائدة من كل الخلايا':'Trimmed extra spaces from all cells'}`);

  // ── 2. Remove duplicate rows using normalizeCell (consistent with detection) ──
  const seen = new Set();
  const beforeDup = cleanData.length;
  // Use same ID-exclusion logic as detection
  const idCols = headers.filter(c => isUniqueIdCol(cleanData, c));
  const keyCols = idCols.length < headers.length ? headers.filter(c => !idCols.includes(c)) : headers;
  cleanData = cleanData.filter(row => {
    const key = keyCols.map(h => normalizeCell(row[h])).join('\x1F');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const dupRemoved = beforeDup - cleanData.length;
  if (dupRemoved > 0) addOp(`🗑️ ${lang==='ar'?'حُذف '+dupRemoved+' صف مكرر':'Removed '+dupRemoved+' duplicate rows'}`);

  // ── 3. Remove fully empty columns ──
  const emptyHeaders = headers.filter(h => cleanData.every(r => isEmpty(r[h])));
  emptyHeaders.forEach(h => {
    cleanData.forEach(r => delete r[h]);
    addOp(`🗑️ ${lang==='ar'?'حُذف عمود فارغ كلياً: '+h:'Removed fully empty column: '+h}`);
  });
  headers = headers.filter(h => !emptyHeaders.includes(h));

  // ── 4. Fill empty cells intelligently (median for numeric, mode for text) ──
  let filled = 0;
  headers.forEach(col => {
    const nonEmpty = cleanData.filter(r => !isEmpty(r[col]));
    const numericVals = nonEmpty.filter(r => isNumeric(r[col])).map(r => parseFloat(String(r[col]).replace(/,/g,'')));
    const isNumericCol = numericVals.length >= nonEmpty.length * 0.5;

    let fillVal;
    if (isNumericCol && numericVals.length > 0) {
      // median for numeric columns
      const sorted = [...numericVals].sort((a, b) => a - b);
      fillVal = String(sorted[Math.floor(sorted.length / 2)].toFixed(2));
    } else if (nonEmpty.length > 0) {
      // mode (most frequent value) for text columns
      const freq = new Map();
      nonEmpty.forEach(r => { const v = String(r[col]); freq.set(v, (freq.get(v) || 0) + 1); });
      fillVal = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
    } else {
      fillVal = lang === 'ar' ? 'غير محدد' : 'N/A';
    }

    cleanData.forEach(r => {
      if (isEmpty(r[col])) { r[col] = fillVal; filled++; }
    });
  });
  if (filled > 0) addOp(`✏️ ${lang==='ar'?'تم ملء '+filled+' خلية فارغة (وسيط/الأكثر تكراراً)':'Filled '+filled+' empty cells (median/mode)'}`);

  // ── 5. Cap outliers (>3σ from mean) to the fence value ──
  let capped = 0;
  headers.forEach(col => {
    const nums = cleanData.map(r => parseFloat(String(r[col]).replace(/,/g,''))).filter(n => !isNaN(n));
    if (nums.length < 5) return;
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const std  = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length);
    if (std === 0) return;
    const lo = mean - 3 * std, hi = mean + 3 * std;
    cleanData.forEach(r => {
      const n = parseFloat(String(r[col]).replace(/,/g,''));
      if (!isNaN(n) && (n < lo || n > hi)) {
        r[col] = String((n < lo ? lo : hi).toFixed(2));
        capped++;
      }
    });
  });
  if (capped > 0) addOp(`📐 ${lang==='ar'?'تم تقليص '+capped+' قيمة شاذة إلى الحد الطبيعي':'Capped '+capped+' outlier values to normal range'}`);

  // ── 6. Standardize mixed date formats → ISO YYYY-MM-DD ──
  headers.forEach(col => {
    const dateCells = cleanData.filter(r => {
      const s = String(r[col] ?? '').trim();
      return /\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}/.test(s);
    });
    if (dateCells.length < cleanData.length * 0.3) return;
    let converted = 0;
    cleanData.forEach(r => {
      const s = String(r[col] ?? '').trim();
      if (!/\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}/.test(s)) return;
      // Already ISO? skip
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return;
      // Try parsing: handle dd/mm/yyyy vs mm/dd/yyyy by checking magnitude
      const parts = s.split(/[\/-]/);
      if (parts.length !== 3) return;
      let [a, b, c] = parts.map(Number);
      let year, month, day;
      if (parts[0].length === 4) { year = a; month = b; day = c; }       // yyyy-mm-dd
      else if (c > 31) { year = c; month = b; day = a; }                 // dd/mm/yyyy or mm/dd/yyyy → dd first if day≤12 ambiguous
      else { year = c; month = b; day = a; }
      if (month > 12 && day <= 12) { [month, day] = [day, month]; }      // swap if month > 12
      if (year < 100) year += 2000;
      if (isNaN(year + month + day) || month < 1 || month > 12 || day < 1 || day > 31) return;
      r[col] = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      converted++;
    });
    if (converted > 0) addOp(`📅 ${lang==='ar'?'توحيد '+converted+' تاريخ في عمود '+col:'Standardized '+converted+' dates in '+col}`);
  });
}

function addOp(text) {
  opsLog.push(text);
  const entries = document.getElementById('ops-entries');
  if (entries) {
    const div = document.createElement('div');
    div.className = 'ops-entry';
    div.innerHTML = `<span>${text}</span><button class="btn-undo-op" onclick="undoOp(this, ${opsLog.length-1})" data-ar="تراجع" data-en="Undo">تراجع</button>`;
    entries.appendChild(div);
  }
}

function undoOp(btn, idx) { btn.disabled = true; btn.textContent = '✓'; globalUndo(); }
function globalUndo() {
  if (undoStack.length < 2) { showToast(lang==='ar'?'لا يوجد شيء للتراجع عنه':'Nothing to undo', 'error'); return; }
  undoStack.pop();
  cleanData = JSON.parse(JSON.stringify(undoStack[undoStack.length-1]));
  headers = cleanData.length ? Object.keys(cleanData[0]) : headers;
  showInsights();
  showToast(lang==='ar'?'↩️ تم التراجع':'↩️ Undone', 'success');
}
function toggleOpsLog() {
  const body = document.getElementById('ops-log-body');
  const toggle = document.getElementById('ops-log-toggle');
  body.classList.toggle('open');
  toggle.textContent = body.classList.contains('open') ? '▲' : '▼';
}

// ═══════════════════════════════════════════════════════
// INSIGHTS
// ═══════════════════════════════════════════════════════
function showInsights() {
  showScreen('insights');
  renderComparisonTables();
  renderStatCards();
  renderCharts();
  renderAIInsights();
  setTimeout(wowInit, 500);
}

function renderComparisonTables() {
  const beforeCols = (rawHeaders.length ? rawHeaders : headers).slice(0, 7);
  const afterCols  = headers.slice(0, 7);

  const buildTable = (data, cols) => {
    const rows = data.slice(0, 12);
    const thead = `<thead><tr>${cols.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map(row =>
      `<tr>${cols.map(col => {
        const val = String(row[col] ?? '').slice(0, 25);
        return `<td>${val}</td>`;
      }).join('')}</tr>`
    ).join('')}</tbody>`;
    return thead + tbody;
  };

  const tBefore = document.getElementById('clean-table-before');
  const tAfter  = document.getElementById('clean-table-after');
  if (tBefore) tBefore.innerHTML = buildTable(rawData,   beforeCols);
  if (tAfter)  tAfter.innerHTML  = buildTable(cleanData, afterCols);

  // Row count badges
  const bc = document.getElementById('before-row-count');
  const ac = document.getElementById('after-row-count');
  const saved = rawData.length - cleanData.length;
  if (bc) bc.textContent = lang === 'ar' ? `${rawData.length} صف` : `${rawData.length} rows`;
  if (ac) ac.textContent = lang === 'ar'
    ? `${cleanData.length} صف${saved > 0 ? ' (حُذف '+saved+')' : ''}`
    : `${cleanData.length} rows${saved > 0 ? ' (removed '+saved+')' : ''}`;
}

function initSlider() {
  const divider = document.getElementById('comp-divider');
  const before = document.getElementById('comp-before');
  const wrap = document.getElementById('comparison-wrap');
  if (!divider || !before || !wrap) return;
  let dragging = false;
  divider.addEventListener('mousedown', () => dragging = true);
  document.addEventListener('mouseup', () => dragging = false);
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = wrap.getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    divider.style.left = pct + '%';
    before.style.clipPath = `inset(0 ${100-pct}% 0 0)`;
  });
}

function renderStatCards() {
  const elapsed = ((Date.now() - processingStart) / 1000).toFixed(1);
  const improved = rawData.length - cleanData.length;
  const pct = rawData.length ? Math.round(improved / rawData.length * 100) : 0;
  const totalFixed = problems.duplicates + problems.emptyCells;
  const stats = [
    { num: cleanData.length, label: lang==='ar'?'الصفوف النظيفة':'Clean Rows' },
    { num: pct + '%', label: lang==='ar'?'نسبة التحسين':'Improvement %' },
    { num: totalFixed, label: lang==='ar'?'المشاكل المحلولة':'Issues Resolved' },
    { num: elapsed + 's', label: lang==='ar'?'وقت المعالجة':'Processing Time' },
  ];
  const el = document.getElementById('stat-cards');
  el.innerHTML = stats.map((s,i) => `
    <div class="stat-card" style="animation-delay:${i*0.1}s">
      <div class="stat-number" id="stat-num-${i}" data-target="${s.num}">${typeof s.num === 'number' ? 0 : s.num}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
  // Count up animation
  stats.forEach((s,i) => {
    if (typeof s.num !== 'number') return;
    const el2 = document.getElementById('stat-num-'+i);
    let cur = 0;
    const target = s.num;
    const inc = Math.max(1, Math.floor(target / 40));
    const anim = setInterval(() => {
      cur = Math.min(cur + inc, target);
      el2.textContent = cur.toLocaleString();
      if (cur >= target) clearInterval(anim);
    }, 40);
  });
}

function renderCharts() {
  const el = document.getElementById('charts-grid');
  const numericCols = headers.filter(h => cleanData.filter(r => isNumeric(r[h])).length > cleanData.length * 0.4);
  const dateCols = headers.filter(h => cleanData.filter(r => isDate(r[h]) && !isEmpty(r[h])).length > cleanData.length * 0.3);

  let charts = '';

  // Bar Chart
  if (numericCols.length > 0) {
    const col = numericCols[0];
    const nums = cleanData.map(r => parseFloat(String(r[col]).replace(/,/g,''))).filter(n => !isNaN(n));
    const buckets = 8;
    const min = Math.min(...nums), max = Math.max(...nums);
    const step2 = (max - min) / buckets;
    const counts = Array(buckets).fill(0);
    nums.forEach(n => { const bi = Math.min(Math.floor((n-min)/step2), buckets-1); counts[bi]++; });
    const maxC = Math.max(...counts) || 1;
    const bars = counts.map((c,i) => {
      const h = Math.round((c/maxC)*80);
      const x = i * (100/buckets) + 1;
      return `<rect x="${x}%" y="${90-h}%" width="${100/buckets - 2}%" height="${h}%" fill="url(#grad)" rx="3"/>`;
    }).join('');
    charts += `<div class="chart-card"><div class="chart-title">${lang==='ar'?'توزيع قيم عمود: '+col:'Distribution: '+col}</div>
      <svg class="chart-svg" viewBox="0 0 200 100" height="120">
        <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#06b6d4" stop-opacity=".6"/></linearGradient></defs>
        ${bars}
        <line x1="0" y1="90%" x2="100%" y2="90%" stroke="rgba(255,255,255,.1)" stroke-width="1"/>
      </svg></div>`;
  }

  // Pie Chart
  const cleanPct = rawData.length ? cleanData.length / rawData.length : 1;
  const dirtyPct = 1 - cleanPct;
  const cx=60, cy=50, r=40;
  const cleanAngle = cleanPct * 2 * Math.PI;
  const x1=cx+r*Math.sin(0), y1=cy-r*Math.cos(0);
  const x2=cx+r*Math.sin(cleanAngle), y2=cy-r*Math.cos(cleanAngle);
  const large = cleanAngle > Math.PI ? 1 : 0;
  charts += `<div class="chart-card"><div class="chart-title">${lang==='ar'?'نظيف مقابل إشكالي':'Clean vs Problematic'}</div>
    <svg class="chart-svg" viewBox="0 0 120 100" height="120">
      <path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z" fill="#10b981" opacity=".85"/>
      <path d="M${cx},${cy} L${x2},${y2} A${r},${r} 0 ${1-large},1 ${x1},${y1} Z" fill="#ef4444" opacity=".7"/>
      <text x="100" y="30" fill="#10b981" font-size="8">${Math.round(cleanPct*100)}% ${lang==='ar'?'نظيف':'Clean'}</text>
      <text x="100" y="50" fill="#ef4444" font-size="8">${Math.round(dirtyPct*100)}% ${lang==='ar'?'إشكالي':'Issues'}</text>
    </svg></div>`;

  // Line Chart (dates or index)
  if (dateCols.length > 0 && numericCols.length > 0) {
    const col = numericCols[0];
    const vals = cleanData.slice(0,20).map(r => parseFloat(String(r[col]).replace(/,/g,''))).filter(n=>!isNaN(n));
    if (vals.length > 2) {
      const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx-mn || 1;
      const pts = vals.map((v,i) => `${(i/(vals.length-1)*180).toFixed(1)},${(80 - (v-mn)/rng*70).toFixed(1)}`).join(' ');
      charts += `<div class="chart-card"><div class="chart-title">${lang==='ar'?'اتجاه: '+col:'Trend: '+col}</div>
        <svg class="chart-svg" viewBox="0 0 190 90" height="120">
          <polyline fill="none" stroke="url(#grad2)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/>
          <defs><linearGradient id="grad2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs>
          ${vals.map((v,i)=>`<circle cx="${(i/(vals.length-1)*180).toFixed(1)}" cy="${(80-(v-mn)/rng*70).toFixed(1)}" r="3" fill="#6366f1"/>`).join('')}
        </svg></div>`;
    }
  }

  el.innerHTML = charts;
}

function renderAIInsights() {
  const el = document.getElementById('ai-insights');
  const numericCols = headers.filter(h => cleanData.filter(r => isNumeric(r[h])).length > cleanData.length * 0.4);
  const insights = [];

  if (numericCols.length > 0) {
    const col = numericCols[0];
    const nums = cleanData.map(r => parseFloat(String(r[col]).replace(/,/g,''))).filter(n=>!isNaN(n));
    const max = Math.max(...nums);
    insights.push({ icon: '📈', text: lang==='ar' ? `أعلى قيمة في عمود ${col} هي ${max.toLocaleString()}` : `Max value in ${col} is ${max.toLocaleString()}` });
  }
  if (numericCols.length > 1) {
    const col2 = numericCols[1];
    const emptyRatio = rawData.filter(r => isEmpty(r[col2])).length / rawData.length * 100;
    insights.push({ icon: '⚠️', text: lang==='ar' ? `عمود ${col2} يحتوي ${emptyRatio.toFixed(0)}% قيم فارغة` : `Column ${col2} has ${emptyRatio.toFixed(0)}% empty values` });
  }
  insights.push({ icon: '✅', text: lang==='ar' ? `البيانات جاهزة للتحليل بعد إزالة ${problems.duplicates} تكرار` : `Data ready after removing ${problems.duplicates} duplicates` });

  el.innerHTML = insights.map((ins,i) => `
    <div class="ai-insight-card" style="animation-delay:${i*0.15}s">
      <div class="ai-insight-icon">${ins.icon}</div>
      <div>${ins.text}</div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════
// SECTOR TEMPLATES
// ═══════════════════════════════════════════════════════
function applySectorTemplate(sector) {
  const templates = {
    restaurant: { cols: ['اسم الصنف', 'السعر', 'الكمية', 'التاريخ'], msg: lang==='ar'?'تم تطبيق قالب المطاعم ✓':'Restaurant template applied ✓' },
    retail:     { cols: ['المنتج', 'المبيعات', 'المخزون', 'المنطقة'], msg: lang==='ar'?'تم تطبيق قالب المتاجر ✓':'Retail template applied ✓' },
    clinic:     { cols: ['اسم المريض', 'التاريخ', 'التشخيص', 'الرسوم'], msg: lang==='ar'?'تم تطبيق قالب العيادات ✓':'Clinic template applied ✓' },
    construction:{ cols: ['المشروع', 'التكلفة', 'الموعد', 'الحالة'], msg: lang==='ar'?'تم تطبيق قالب المقاولات ✓':'Construction template applied ✓' },
  };
  showToast(templates[sector]?.msg || '✓', 'success');
  addOp(`📋 ${lang==='ar'?'قالب القطاع: '+sector:'Sector template: '+sector}`);
}

// ═══════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════
function goToExport() {
  showScreen('export');
  const improved = rawData.length - cleanData.length;
  const pct = rawData.length ? Math.round(improved / rawData.length * 100) : 0;
  document.getElementById('share-stats').innerHTML = `
    <div style="display:flex;justify-content:center;flex-wrap:wrap">
      <div class="share-stat"><div class="share-num">${cleanData.length.toLocaleString()}</div><div class="share-lbl">${lang==='ar'?'صف نظيف':'Clean Rows'}</div></div>
      <div class="share-stat"><div class="share-num">${pct}%</div><div class="share-lbl">${lang==='ar'?'نسبة التحسين':'Improvement'}</div></div>
      <div class="share-stat"><div class="share-num">${problems.duplicates + problems.emptyCells}</div><div class="share-lbl">${lang==='ar'?'مشكلة محلولة':'Issues Fixed'}</div></div>
    </div>`;
}

function exportCSV() {
  const BOM = '\uFEFF';
  const lines = [headers.join(',')];
  cleanData.forEach(row => {
    lines.push(headers.map(h => {
      const v = String(row[h] ?? '').replace(/"/g,'""');
      return v.includes(',') || v.includes('"') ? `"${v}"` : v;
    }).join(','));
  });
  const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'datacell_clean_' + filename.replace(/\.[^.]+$/, '') + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(lang==='ar'?'✅ تم التحميل':'✅ Downloaded', 'success');
}
function exportXLSX() {
  if (!cleanData.length) { showToast(lang==="ar"?"لا توجد بيانات":"No data to export","error"); return; }
  const ws = XLSX.utils.json_to_sheet(cleanData, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DataCell");
  const colWidths = headers.map(h => ({
    wch: Math.max(h.length, ...cleanData.slice(0,50).map(r => String(r[h]||"").length), 10)
  }));
  ws["!cols"] = colWidths;
  const fname = "datacell_clean_" + (filename||"data").replace(/\.[^.]+$/, "") + ".xlsx";
  XLSX.writeFile(wb, fname);
  showToast(lang==="ar"?"تم تحميل Excel ✅":"Excel Downloaded ✅","success");
}


function exportPDF() {
  const now = new Date();
  const hijri = gregorianToHijri(now.getFullYear(), now.getMonth()+1, now.getDate());
  const greg = now.toLocaleDateString(lang==='ar'?'ar-SA':'en-US');
  const printWin = window.open('', '_blank');
  const tableRows = cleanData.slice(0,20).map(row =>
    `<tr>${headers.map(h => `<td style="border:1px solid #ccc;padding:6px 8px;font-size:12px">${String(row[h]??'').slice(0,30)}</td>`).join('')}</tr>`
  ).join('');
  const tableHeader = `<tr>${headers.map(h=>`<th style="background:#6366f1;color:white;padding:8px;border:1px solid #5558e0">${h}</th>`).join('')}</tr>`;
  printWin.document.write(`<!DOCTYPE html><html dir="${lang==='ar'?'rtl':'ltr'}" lang="${lang}">
  <head><meta charset="UTF-8"><title>DataCell Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body{font-family:${lang==='ar'?"'Tajawal'":"'Inter'"};direction:${lang==='ar'?'rtl':'ltr'};padding:40px;color:#1a1a1a;background:white}
    h1{background:linear-gradient(135deg,#6366f1,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:28px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0}
    .summary-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
    .big-num{font-size:24px;font-weight:800;color:#6366f1}
    @media print{body{padding:20px}}
  </style></head><body>
  <h1>DataCell</h1>
  <p style="color:#64748b">${lang==='ar'?'تقرير تنظيف البيانات':'Data Cleaning Report'} • ${greg} | ${hijri}</p>
  <div class="summary-grid">
    <div class="summary-item"><div class="big-num">${rawData.length}</div><div>${lang==='ar'?'الصفوف الأصلية':'Original Rows'}</div></div>
    <div class="summary-item"><div class="big-num">${cleanData.length}</div><div>${lang==='ar'?'الصفوف النظيفة':'Clean Rows'}</div></div>
    <div class="summary-item"><div class="big-num">${computeQualityScore()}%</div><div>${lang==='ar'?'جودة البيانات':'Data Quality'}</div></div>
  </div>
  <h2>${lang==='ar'?'المشاكل المكتشفة':'Issues Found'}</h2>
  <ul>
    <li>${lang==='ar'?'صفوف مكررة':'Duplicate rows'}: ${problems.duplicates}</li>
    <li>${lang==='ar'?'خلايا فارغة':'Empty cells'}: ${problems.emptyCells}</li>
    <li>${lang==='ar'?'قيم شاذة':'Outliers'}: ${problems.outliers}</li>
    <li>${lang==='ar'?'أعمدة فارغة':'Empty columns'}: ${problems.emptyColumns}</li>
  </ul>
  <h2>${lang==='ar'?'العمليات المنفذة':'Operations Performed'}</h2>
  <ul>${opsLog.map(op=>`<li>${op}</li>`).join('')}</ul>
  <h2>${lang==='ar'?'معاينة البيانات النظيفة':'Clean Data Preview'}</h2>
  <table><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table>
  <p style="margin-top:40px;color:#94a3b8;font-size:12px">Generated by DataCell • datacell.app</p>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`);
  printWin.document.close();
}

function resetAll() {
  rawData = []; cleanData = []; headers = []; rawHeaders = []; filename = '';
  problems = {}; undoStack = []; opsLog = [];
  chatHistory = []; dataContext = '';
  window._pendingActions = [];
  document.getElementById('chat-messages').innerHTML = '<div class="msg-bubble msg-ai">مرحباً! اسألني أي سؤال عن بياناتك 📊</div>';
  document.getElementById('file-input').value = '';
  document.getElementById('chat-btn').classList.remove('show');
  showScreen('landing');
}

// ═══════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════

/** Escape HTML special chars to prevent XSS in innerHTML rendering. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let chatOpen = false;
function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chat-panel').classList.toggle('open', chatOpen);
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const rawText = input.value.trim();
  if (!rawText) return;
  if (rawText.length > 2000) { showToast(lang==='ar'?'الرسالة طويلة جداً (2000 حرف كحد أقصى)':'Message too long (max 2000 chars)', 'error'); return; }
  const text = rawText;
  input.value = '';

  const msgEl = document.getElementById('chat-messages');
  msgEl.innerHTML += `<div class="msg-bubble msg-user">${escapeHtml(text)}</div>`;
  const typing = document.createElement('div');
  typing.className = 'msg-bubble msg-ai typing-indicator';
  typing.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  msgEl.appendChild(typing);
  msgEl.scrollTop = msgEl.scrollHeight;

  chatHistory.push({ role: 'user', content: text });
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

  const systemPrompt = `أنت مساعد تحليل البيانات. المستخدم رفع ملف بيانات. إليك ملخص البيانات: ${dataContext}. أجب على أسئلة المستخدم عن هذه البيانات باللغة العربية. كن موجزاً واستخدم الأرقام.`;

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory.slice(-10), systemPrompt })
    });
    const data = await res.json();
    typing.remove();
    const reply = data.content || (lang==='ar'?'عذراً، حدث خطأ.':'Sorry, an error occurred.');
    msgEl.innerHTML += `<div class="msg-bubble msg-ai">${reply}</div>`;
    chatHistory.push({ role: 'assistant', content: reply });
  } catch(e) {
    typing.remove();
    msgEl.innerHTML += `<div class="msg-bubble msg-ai" style="color:var(--error)">${lang==='ar'?'خطأ في الاتصال':'Connection error'}</div>`;
  }
  msgEl.scrollTop = msgEl.scrollHeight;
}

// ═══════════════════════════════════════════════════════
// PRESENTATION MODE
// ═══════════════════════════════════════════════════════
function openPresentation() {
  const pres = document.getElementById('presentation-mode');
  pres.classList.add('active');
  const score = computeQualityScore();
  const color = score < 50 ? '#ef4444' : score < 75 ? '#f59e0b' : '#10b981';
  const circumference = 326;
  const offset = circumference - (circumference * score / 100);
  document.getElementById('pres-gauge-wrap').innerHTML = `
    <svg width="180" height="180" viewBox="0 0 140 140">
      <circle fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10" cx="70" cy="70" r="52"/>
      <circle fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" cx="70" cy="70" r="52"
        transform="rotate(-90 70 70)" stroke-dasharray="326" stroke-dashoffset="${offset}"/>
      <text fill="${color}" font-size="20" font-weight="800" text-anchor="middle" dominant-baseline="middle" x="70" y="67">${score}%</text>
      <text fill="rgba(255,255,255,.5)" font-size="9" text-anchor="middle" x="70" y="83">${lang==='ar'?'جودة البيانات':'Data Quality'}</text>
    </svg>`;
  const improved = rawData.length - cleanData.length;
  const pct = rawData.length ? Math.round(improved / rawData.length * 100) : 0;
  document.getElementById('pres-grid').innerHTML = `
    <div class="pres-stat"><div class="stat-number">${cleanData.length.toLocaleString()}</div><div class="stat-label">${lang==='ar'?'صف نظيف':'Clean Rows'}</div></div>
    <div class="pres-stat"><div class="stat-number">${pct}%</div><div class="stat-label">${lang==='ar'?'نسبة التحسين':'Improvement'}</div></div>
    <div class="pres-stat"><div class="stat-number">${problems.duplicates}</div><div class="stat-label">${lang==='ar'?'تكرارات محذوفة':'Duplicates Removed'}</div></div>
    <div class="pres-stat"><div class="stat-number">${problems.emptyCells}</div><div class="stat-label">${lang==='ar'?'خلايا مصلحة':'Cells Fixed'}</div></div>`;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('presentation-mode').classList.remove('active'); });

// ═══════════════════════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════════════════════
let particleAnim = null;
let particleCanvas = null;
function startParticles(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  particleCanvas = canvas;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({length: 80}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8,
    r: Math.random() * 2 + 0.5,
    a: Math.random()
  }));
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      p.a = 0.4 + 0.3 * Math.sin(Date.now() * 0.001 + p.x);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(99,102,241,${p.a})`;
      ctx.fill();
    });
    particleAnim = requestAnimationFrame(draw);
  }
  draw();
}
function stopParticles() {
  if (particleAnim) { cancelAnimationFrame(particleAnim); particleAnim = null; }
  if (particleCanvas) { const ctx = particleCanvas.getContext('2d'); ctx.clearRect(0,0,particleCanvas.width,particleCanvas.height); }
}

// ═══════════════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════════════
function showConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const particles = Array.from({length: 180}, () => ({
    x: canvas.width / 2, y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 18,
    vy: Math.random() * -16 - 4,
    color: `hsl(${Math.random()*360},80%,60%)`,
    r: Math.random() * 6 + 3,
    gravity: 0.4 + Math.random() * 0.3,
    alpha: 1
  }));
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.alpha <= 0) return;
      alive = true;
      p.x += p.vx; p.vy += p.gravity; p.y += p.vy; p.alpha -= 0.014;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = p.color; ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (alive) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════
function showToast(msg, type='success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .5s'; setTimeout(() => t.remove(), 500); }, 3000);
}

// ═══════════════════════════════════════════════════════
// ANALYTICS MODULE
// ═══════════════════════════════════════════════════════
let analyticsHeaders = [];
let analyticsData = [];
let detectedType = 'generic';
let activeFilters = {};

function getAnalyticsData() { return analyticsData.length ? analyticsData : (cleanData.length ? cleanData : rawData); }
function getFilteredData() {
  const src = getAnalyticsData();
  if (!Object.keys(activeFilters).length) return src;
  return src.filter(row => Object.entries(activeFilters).every(([col,val]) => String(row[col]||'').trim() === val));
}

function detectDataType(h) {
  const s = h.join(' ');
  if (/مبيعات|سعر|كمية|منتج/.test(s)) return 'sales';
  if (/عميل|اسم|هاتف|منطقة/.test(s)) return 'customer';
  if (/مخزون|كمية|منتج|مورد/.test(s)) return 'inventory';
  return 'generic';
}

function loadSampleForAnalytics() {
  filename = 'بيانات_تجريبية.csv';
  rawData = generateSampleData();
  headers = Object.keys(rawData[0]);
  cleanData = [];
  showAnalytics();
}

function showAnalytics() {
  const src = cleanData.length ? cleanData : rawData;
  if (!src.length) { showToast(lang==='ar'?'لا توجد بيانات للتحليل':'No data to analyze','error'); return; }
  analyticsData = src.map(r => ({...r}));
  analyticsHeaders = cleanData.length ? [...headers] : (rawData.length ? Object.keys(rawData[0]) : []);
  detectedType = detectDataType(analyticsHeaders);
  activeFilters = {};
  showScreen('analytics');
  document.getElementById('chat-btn').classList.add('show');
  // Update data context for AI chat
  const nc = analyticsHeaders.filter(h => analyticsData.filter(r=>isNumeric(r[h])).length > analyticsData.length*0.4);
  const stats = nc.slice(0,3).map(col => {
    const nums = analyticsData.map(r=>parseFloat(String(r[col]).replace(/,/g,''))).filter(n=>!isNaN(n));
    return `${col}: min=${Math.min(...nums).toFixed(2)}, max=${Math.max(...nums).toFixed(2)}, avg=${(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2)}`;
  }).join('; ');
  dataContext = `الملف: ${filename}\nالأعمدة: ${analyticsHeaders.join(', ')}\nعدد الصفوف: ${analyticsData.length}\nعينة: ${JSON.stringify(analyticsData.slice(0,5))}\nإحصائيات: ${stats}`;
  renderAnalyticsDashboard();
}

function renderAnalyticsDashboard() {
  const data = getFilteredData();
  renderDetectedTypeBadge();
  renderExecSummary(data);
  renderDataSlicer();
  renderAnalyticsCharts(data);
  renderTop10(data);
  renderAIAnalyticsInsights(data);
  renderColumnProfiler(data);
  renderColumnComparison();
}

function renderDetectedTypeBadge() {
  const labels = {
    sales:    { ar:'🛒 بيانات مبيعات',    en:'🛒 Sales Data',      color:'#f59e0b' },
    customer: { ar:'👥 بيانات عملاء',     en:'👥 Customer Data',   color:'#06b6d4' },
    inventory:{ ar:'📦 بيانات مخزون',     en:'📦 Inventory Data',  color:'#10b981' },
    generic:  { ar:'📊 بيانات عامة',      en:'📊 Generic Data',    color:'#6366f1' },
  };
  const info = labels[detectedType];
  const ac = Object.keys(activeFilters).length;
  document.getElementById('detected-type-badge').innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:.25rem">
      <div class="type-badge" style="background:${info.color}22;border:1px solid ${info.color}44;color:${info.color}">
        ${lang==='ar'?info.ar:info.en}
      </div>
      ${ac?`<div class="type-badge" style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:var(--primary);font-size:.78rem">${lang==='ar'?'فلتر نشط':'Active filter'}: ${Object.values(activeFilters).join(', ')}</div>`:''}
    </div>`;
}

// ── Section 1: Executive Summary ─────────────────────
function renderExecSummary(data) {
  const nc = analyticsHeaders.filter(h => data.filter(r=>isNumeric(r[h])).length > data.length*0.4);
  const tc = analyticsHeaders.filter(h => {
    const u = new Set(data.map(r=>String(r[h]||'').trim())).size;
    return u<=20 && u>1 && data.filter(r=>!isEmpty(r[h])).length > data.length*0.4;
  });
  const cards = [];
  if (nc.length) {
    const nums = data.map(r=>parseFloat(String(r[nc[0]]).replace(/,/g,''))).filter(n=>!isNaN(n));
    cards.push({ icon:'📈', num: Math.max(...nums), label: lang==='ar'?`أعلى قيمة في ${nc[0]}`:`Max in ${nc[0]}` });
    cards.push({ icon:'💰', num: nums.reduce((a,b)=>a+b,0), label: lang==='ar'?`إجمالي ${nc[0]}`:`Total ${nc[0]}` });
  }
  if (tc.length) {
    const freq = {}; data.forEach(r=>{ const v=String(r[tc[0]]||'').trim(); if(v) freq[v]=(freq[v]||0)+1; });
    const top = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0];
    if (top) cards.push({ icon:'🔁', num: top[0], label: lang==='ar'?`أكثر تكراراً في ${tc[0]}`:`Top in ${tc[0]}` });
  }
  cards.push({ icon:'📋', num: data.length, label: lang==='ar'?'إجمالي الصفوف':'Total Rows' });
  if (nc.length > 1) {
    const nums2 = data.map(r=>parseFloat(String(r[nc[1]]).replace(/,/g,''))).filter(n=>!isNaN(n));
    if (nums2.length) cards.push({ icon:'⚡', num: parseFloat((nums2.reduce((a,b)=>a+b,0)/nums2.length).toFixed(1)), label: lang==='ar'?`متوسط ${nc[1]}`:`Avg ${nc[1]}` });
  }
  document.getElementById('exec-summary').innerHTML = cards.slice(0,4).map((c,i) => `
    <div class="exec-card" style="animation-delay:${i*0.09}s">
      <div class="exec-icon">${c.icon}</div>
      <div class="exec-num" data-raw="${typeof c.num==='number'?c.num:''}">${typeof c.num==='number'?0:c.num}</div>
      <div class="exec-label">${c.label}</div>
    </div>`).join('');
  document.querySelectorAll('.exec-num').forEach(el => {
    const raw = parseFloat(el.dataset.raw);
    if (isNaN(raw)) return;
    let cur = 0; const inc = Math.max(1, raw/45);
    const t = setInterval(() => { cur=Math.min(cur+inc,raw); el.textContent=Math.round(cur).toLocaleString(); if(cur>=raw) clearInterval(t); }, 25);
  });
}

// ── Section 6: Data Slicer ────────────────────────────
function renderDataSlicer() {
  const catCols = analyticsHeaders.filter(h => {
    const u = new Set(analyticsData.map(r=>String(r[h]||'').trim())).size;
    return u<=12 && u>1 && analyticsData.filter(r=>!isEmpty(r[h])).length > analyticsData.length*0.5;
  }).slice(0,4);
  const sl = document.getElementById('data-slicer');
  if (!catCols.length) { sl.style.display='none'; document.getElementById('slicer-title').style.display='none'; return; }
  const ac = Object.keys(activeFilters).length;
  let html = `<div class="slicer-active-bar">`;
  if (ac) {
    html += Object.entries(activeFilters).map(([col,val])=>`<span class="active-filter-tag">${col}: ${val} <button onclick="removeFilter('${col}')">✕</button></span>`).join('');
    html += `<button class="btn-clear-filters" onclick="clearFilters()">${lang==='ar'?'إزالة كل الفلاتر':'Clear All'}</button>`;
  }
  html += `</div>`;
  catCols.forEach(col => {
    const vals = [...new Set(analyticsData.map(r=>String(r[col]||'').trim()).filter(v=>v))].sort();
    html += `<div class="slicer-col-label">${col}</div><div class="slicer-chips">`;
    html += vals.map(v=>`<button class="slicer-chip ${activeFilters[col]===v?'active':''}" onclick="toggleFilter('${col}','${v.replace(/'/g,"\\'")}')">${v}</button>`).join('');
    html += `</div>`;
  });
  sl.innerHTML = html;
}
function toggleFilter(col,val) { if(activeFilters[col]===val) delete activeFilters[col]; else activeFilters[col]=val; renderAnalyticsDashboard(); }
function removeFilter(col) { delete activeFilters[col]; renderAnalyticsDashboard(); }
function clearFilters() { activeFilters={}; renderAnalyticsDashboard(); }

// ── Section 2: Charts ─────────────────────────────────
function renderAnalyticsCharts(data) {
  const nc = analyticsHeaders.filter(h=>data.filter(r=>isNumeric(r[h])).length>data.length*0.4);
  const tc = analyticsHeaders.filter(h=>{ const u=new Set(data.map(r=>String(r[h]||'').trim())).size; return u<=14&&u>1&&data.filter(r=>!isEmpty(r[h])).length>data.length*0.4; });
  const dc = analyticsHeaders.filter(h=>data.filter(r=>isDate(r[h])&&!isEmpty(r[h])).length>data.length*0.3);
  let charts = '';

  // BAR CHART
  if (tc.length && nc.length) {
    const xCol=tc[0], yCol=nc[0];
    const groups={};
    data.forEach(r=>{ const k=String(r[xCol]||'').trim(); const v=parseFloat(String(r[yCol]).replace(/,/g,'')); if(k&&!isNaN(v)) groups[k]=(groups[k]||0)+v; });
    const sorted=Object.entries(groups).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const maxV=Math.max(...sorted.map(s=>s[1]))||1;
    const bw=180/sorted.length;
    const bars=sorted.map(([k,v],i)=>{
      const h=Math.round((v/maxV)*78); const x=i*bw+1;
      return `<g><rect x="${x}%" y="${90-h}%" width="${bw-2}%" height="${h}%" fill="url(#bg${i%2})" rx="3"><title>${k}: ${v.toLocaleString(undefined,{maximumFractionDigits:0})}</title><animate attributeName="height" from="0" to="${h}%" dur="${0.4+i*0.08}s" fill="freeze"/><animate attributeName="y" from="90%" to="${90-h}%" dur="${0.4+i*0.08}s" fill="freeze"/></rect></g>`;
    }).join('');
    const lbls=sorted.map(([k],i)=>`<text x="${(i*bw+bw/2).toFixed(1)}%" y="98%" text-anchor="middle" font-size="5.5" fill="var(--muted)">${k.slice(0,7)}</text>`).join('');
    charts+=`<div class="achart-card" style="animation-delay:.05s">
      <div class="chart-title">${lang==='ar'?`توزيع ${xCol} حسب ${yCol}`:`${yCol} by ${xCol}`}</div>
      <svg viewBox="0 0 200 105" height="155" style="width:100%">
        <defs>
          <linearGradient id="bg0" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#6366f1" stop-opacity=".35"/></linearGradient>
          <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#06b6d4" stop-opacity=".35"/></linearGradient>
        </defs>
        ${bars}${lbls}
        <line x1="0" y1="90%" x2="100%" y2="90%" stroke="rgba(255,255,255,.07)" stroke-width="1"/>
      </svg></div>`;
  }

  // DONUT CHART
  if (tc.length) {
    const col=tc[0];
    const freq={}; data.forEach(r=>{ const k=String(r[col]||'').trim(); if(k) freq[k]=(freq[k]||0)+1; });
    const entries=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,7);
    const total=entries.reduce((s,[,v])=>s+v,0)||1;
    const colors=['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
    const cx=50,cy=50,r=38,ri=24; let sa=-Math.PI/2;
    const slices=entries.map(([k,v],i)=>{
      const a=(v/total)*2*Math.PI;
      const x1=cx+r*Math.cos(sa),y1=cy+r*Math.sin(sa);
      const x2=cx+r*Math.cos(sa+a),y2=cy+r*Math.sin(sa+a);
      const xi1=cx+ri*Math.cos(sa),yi1=cy+ri*Math.sin(sa);
      const xi2=cx+ri*Math.cos(sa+a),yi2=cy+ri*Math.sin(sa+a);
      const lg=a>Math.PI?1:0;
      const p=`M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${lg},1 ${x2.toFixed(2)},${y2.toFixed(2)} L${xi2.toFixed(2)},${yi2.toFixed(2)} A${ri},${ri} 0 ${lg},0 ${xi1.toFixed(2)},${yi1.toFixed(2)} Z`;
      sa+=a;
      return `<path d="${p}" fill="${colors[i]}" opacity=".88"><title>${k}: ${(v/total*100).toFixed(1)}%</title></path>`;
    });
    const legend=entries.map(([k,v],i)=>`<div style="display:flex;align-items:center;gap:.35rem;font-size:.72rem;margin-bottom:.25rem"><div style="width:9px;height:9px;border-radius:50%;background:${colors[i]};flex-shrink:0"></div><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90px">${k}</span><span style="color:var(--muted);margin-right:auto">${(v/total*100).toFixed(0)}%</span></div>`).join('');
    charts+=`<div class="achart-card" style="animation-delay:.1s">
      <div class="chart-title">${lang==='ar'?`توزيع ${col}`:`Distribution: ${col}`}</div>
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <svg viewBox="0 0 100 100" width="115" height="115" style="flex-shrink:0">
          ${slices.join('')}
          <text x="50" y="48" text-anchor="middle" font-size="8" font-weight="800" fill="var(--text)">${total}</text>
          <text x="50" y="57" text-anchor="middle" font-size="6" fill="var(--muted)">${lang==='ar'?'إجمالي':'Total'}</text>
        </svg>
        <div style="flex:1;min-width:110px">${legend}</div>
      </div></div>`;
  }

  // LINE CHART with area fill
  if (nc.length) {
    const yCol=nc[0];
    let pts=[], xlbls=[];
    if (dc.length) {
      const pairs=data.filter(r=>!isEmpty(r[dc[0]])&&isNumeric(r[yCol])).map(r=>({d:new Date(r[dc[0]]),v:parseFloat(String(r[yCol]).replace(/,/g,''))})).filter(p=>!isNaN(p.d)).sort((a,b)=>a.d-b.d).slice(0,25);
      pts=pairs.map(p=>p.v); xlbls=pairs.map(p=>`${p.d.getMonth()+1}/${p.d.getFullYear().toString().slice(2)}`);
    } else {
      const sample=data.slice(0,20).filter(r=>isNumeric(r[yCol]));
      pts=sample.map(r=>parseFloat(String(r[yCol]).replace(/,/g,''))); xlbls=pts.map((_,i)=>String(i+1));
    }
    if (pts.length>2) {
      const mn=Math.min(...pts),mx=Math.max(...pts),rng=mx-mn||1;
      const W=182,H=75;
      const pArr=pts.map((v,i)=>`${(i/(pts.length-1)*W).toFixed(1)},${(H-(v-mn)/rng*(H-8)-4).toFixed(1)}`);
      const pStr=pArr.join(' ');
      const area=`M${pArr[0]} ${pArr.join(' L')} L${W},${H} L0,${H} Z`;
      charts+=`<div class="achart-card" style="animation-delay:.15s">
        <div class="chart-title">${lang==='ar'?`الاتجاه الزمني لـ ${yCol}`:`Trend: ${yCol}`}</div>
        <svg viewBox="-4 -4 ${W+8} ${H+18}" height="155" style="width:100%">
          <defs>
            <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" stop-opacity=".28"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0"/></linearGradient>
            <linearGradient id="lineG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient>
          </defs>
          <path d="${area}" fill="url(#areaG)"/>
          <polyline fill="none" stroke="url(#lineG)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${pStr}"/>
          ${pts.map((v,i)=>`<circle cx="${(i/(pts.length-1)*W).toFixed(1)}" cy="${(H-(v-mn)/rng*(H-8)-4).toFixed(1)}" r="3" fill="#6366f1"><title>${xlbls[i]}: ${v.toLocaleString()}</title></circle>`).join('')}
          <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="rgba(255,255,255,.07)" stroke-width="1"/>
        </svg></div>`;
    }
  }

  document.getElementById('analytics-charts-grid').innerHTML = charts || `<p style="color:var(--muted);padding:1rem">${lang==='ar'?'لا توجد بيانات كافية للرسم':'Not enough data for charts'}</p>`;
}

// ── Top 10 Table ──────────────────────────────────────
function renderTop10(data) {
  const nc = analyticsHeaders.filter(h=>data.filter(r=>isNumeric(r[h])).length>data.length*0.4);
  const el = document.getElementById('top10-container');
  if (!nc.length) { el.innerHTML=''; return; }
  const sortCol=nc[0];
  const sorted=[...data].sort((a,b)=>{
    const av=parseFloat(String(a[sortCol]).replace(/,/g,'')), bv=parseFloat(String(b[sortCol]).replace(/,/g,''));
    return (isNaN(bv)?-Infinity:bv)-(isNaN(av)?-Infinity:av);
  }).slice(0,10);
  const medals=['🥇','🥈','🥉'];
  const rstyles=['background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25)','background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.2)','background:rgba(180,100,40,.08);border:1px solid rgba(180,100,40,.2)'];
  const cols = analyticsHeaders.slice(0,5);
  el.innerHTML=`<div class="card" style="overflow:auto;animation-delay:.2s">
    <div class="card-title">🏆 ${lang==='ar'?'أعلى 10 قيم في عمود '+sortCol:'Top 10 by '+sortCol}</div>
    <div class="data-table-wrap">
    <table class="data-table" style="min-width:480px">
      <thead><tr><th>#</th>${cols.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${sorted.map((row,i)=>`<tr style="${i<3?rstyles[i]:''}; animation:fadeInUp .3s ease ${i*0.04}s both">
        <td>${medals[i]||i+1}</td>${cols.map(h=>`<td>${String(row[h]??'').slice(0,28)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table></div></div>`;
}

// ── Section 3: AI-style Insights ─────────────────────
function renderAIAnalyticsInsights(data) {
  const nc = analyticsHeaders.filter(h=>data.filter(r=>isNumeric(r[h])).length>data.length*0.4);
  const tc = analyticsHeaders.filter(h=>{ const u=new Set(data.map(r=>String(r[h]||'').trim())).size; return u<=20&&u>1&&data.filter(r=>!isEmpty(r[h])).length>data.length*0.4; });
  const dc = analyticsHeaders.filter(h=>data.filter(r=>isDate(r[h])&&!isEmpty(r[h])).length>data.length*0.3);
  const getNums = col => data.map(r=>parseFloat(String(r[col]).replace(/,/g,''))).filter(n=>!isNaN(n));
  const getFreq = col => { const f={}; data.forEach(r=>{const v=String(r[col]||'').trim();if(v)f[v]=(f[v]||0)+1;}); return Object.entries(f).sort((a,b)=>b[1]-a[1]); };
  const stdDev = arr => { const m=arr.reduce((a,b)=>a+b,0)/arr.length; return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length); };
  let ins = [];

  if (detectedType==='sales') {
    if (nc.length) {
      const nums=getNums(nc[0]),total=nums.reduce((a,b)=>a+b,0),avg=total/nums.length;
      ins.push({i:'⚡',t:`${lang==='ar'?'متوسط قيمة الطلب':'Avg order value'}: ${avg.toLocaleString(undefined,{maximumFractionDigits:0})}`});
    }
    if (tc.length && nc.length) {
      const g={}; data.forEach(r=>{const k=String(r[tc[0]]||'').trim();const v=parseFloat(String(r[nc[0]]).replace(/,/g,''));if(k&&!isNaN(v))g[k]=(g[k]||0)+v;});
      const s=Object.entries(g).sort((a,b)=>b[1]-a[1]);
      if(s[0]) ins.push({i:'📈',t:`${lang==='ar'?'أعلى أداء':'Top performer'}: ${s[0][0]} (${s[0][1].toLocaleString(undefined,{maximumFractionDigits:0})})`});
      if(s.length>1) ins.push({i:'📉',t:`${lang==='ar'?'أضعف أداء':'Lowest performer'}: ${s[s.length-1][0]}`});
    }
    if (dc.length && nc.length) {
      const mm={}; data.forEach(r=>{const d=new Date(r[dc[0]]);if(!isNaN(d)){const m=`${d.getFullYear()}-${d.getMonth()+1}`;const v=parseFloat(String(r[nc[0]]).replace(/,/g,''));if(!isNaN(v))mm[m]=(mm[m]||0)+v;}});
      const top=Object.entries(mm).sort((a,b)=>b[1]-a[1])[0];
      if(top) ins.push({i:'🔄',t:`${lang==='ar'?'أكثر شهر نشاطاً':'Most active month'}: ${top[0]}`});
    }
    if (nc.length) {
      const nums=getNums(nc[0]); ins.push({i:'💰',t:`${lang==='ar'?'إجمالي المبيعات':'Total sales'}: ${nums.reduce((a,b)=>a+b,0).toLocaleString(undefined,{maximumFractionDigits:0})}`});
    }
  } else if (detectedType==='customer') {
    ins.push({i:'👥',t:`${lang==='ar'?'إجمالي العملاء':'Total customers'}: ${data.length.toLocaleString()}`});
    if (tc.length) {
      const f=getFreq(tc[0]);
      if(f[0]) ins.push({i:'🏆',t:`${lang==='ar'?'أكثر '+tc[0]+' تكراراً':'Top '+tc[0]}: ${f[0][0]} (${f[0][1]})`});
    }
    if (nc.length) {
      const nums=getNums(nc[0]),avg=nums.reduce((a,b)=>a+b,0)/nums.length;
      ins.push({i:'⭐',t:`${lang==='ar'?'متوسط قيمة العميل':'Avg customer value'}: ${avg.toLocaleString(undefined,{maximumFractionDigits:0})}`});
    }
    const geoCol=analyticsHeaders.find(h=>/منطقة|مدينة|region|city/i.test(h));
    if(geoCol){const u=new Set(data.map(r=>String(r[geoCol]||'').trim())).size;ins.push({i:'📍',t:`${lang==='ar'?'التوزيع الجغرافي':'Geographic distribution'}: ${u} ${lang==='ar'?'منطقة':'regions'}`});}
    if (nc.length){const total=getNums(nc[0]).reduce((a,b)=>a+b,0);ins.push({i:'💤',t:`${lang==='ar'?'إجمالي':'Total'} ${nc[0]}: ${total.toLocaleString(undefined,{maximumFractionDigits:0})}`});}
  } else if (detectedType==='inventory') {
    if (nc.length) {
      const nums=getNums(nc[0]),total=nums.reduce((a,b)=>a+b,0);
      const low=data.filter(r=>{const v=parseFloat(String(r[nc[0]]).replace(/,/g,''));return !isNaN(v)&&v<10;}).length;
      const healthy=Math.round((data.length-low)/data.length*100);
      ins.push({i:'📦',t:`${lang==='ar'?'إجمالي المخزون':'Total inventory'}: ${total.toLocaleString(undefined,{maximumFractionDigits:0})} ${lang==='ar'?'وحدة':'units'}`});
      if(low>0) ins.push({i:'⚠️',t:`${lang==='ar'?'منتجات على وشك النفاد (أقل من 10)':'Low stock (<10 units)'}: ${low}`});
      ins.push({i:'✅',t:`${lang==='ar'?'نسبة المخزون الصحي':'Healthy stock ratio'}: ${healthy}%`});
      if(nc.length>1){const v=getNums(nc[1]).reduce((a,b)=>a+b,0);ins.push({i:'💰',t:`${lang==='ar'?'قيمة المخزون الكلية':'Total inventory value'}: ${v.toLocaleString(undefined,{maximumFractionDigits:0})}`});}
    }
    if(tc.length){const f=getFreq(tc[0]);if(f[0])ins.push({i:'🐌',t:`${lang==='ar'?'أكثر تكراراً':'Most common'}: ${f[0][0]}`});}
  } else {
    ins.push({i:'📊',t:`${lang==='ar'?'إجمالي الصفوف':'Total rows'}: ${data.length.toLocaleString()}`});
    if (nc.length) {
      const nums=getNums(nc[0]),avg=nums.reduce((a,b)=>a+b,0)/nums.length,sd=stdDev(nums);
      ins.push({i:'🔢',t:`${lang==='ar'?'متوسط '+nc[0]:'Avg '+nc[0]}: ${avg.toLocaleString(undefined,{maximumFractionDigits:2})}`});
      ins.push({i:'📈',t:`${lang==='ar'?'أعلى':'Max'}: ${Math.max(...nums).toLocaleString()} | ${lang==='ar'?'أدنى':'Min'}: ${Math.min(...nums).toLocaleString()}`});
      ins.push({i:'📉',t:`σ ${nc[0]}: ${sd.toLocaleString(undefined,{maximumFractionDigits:2})}`});
    }
    if (tc.length){const f=getFreq(tc[0]);if(f[0])ins.push({i:'🔁',t:`${lang==='ar'?'أكثر تكراراً في '+tc[0]:'Top in '+tc[0]}: ${f[0][0]}`});}
  }

  document.getElementById('ai-analytics-insights').innerHTML = ins.slice(0,5).map((c,i)=>`
    <div class="ai-insight-card" style="animation-delay:${i*0.1}s">
      <div class="ai-insight-icon">${c.i}</div>
      <div style="font-size:.87rem">${c.t}</div>
    </div>`).join('');
}

// ── Section 4: Column Profiler ────────────────────────
function renderColumnProfiler(data) {
  const items = analyticsHeaders.map(col => {
    const vals=data.map(r=>r[col]);
    const filled=vals.filter(v=>!isEmpty(v)).length;
    const fillPct=Math.round(filled/vals.length*100);
    const numVals=vals.filter(v=>isNumeric(v)).map(v=>parseFloat(String(v).replace(/,/g,'')));
    const dateVals=vals.filter(v=>isDate(v)&&!isEmpty(v));
    let type='text', typeLbl=lang==='ar'?'نصي':'Text', typeColor='rgba(16,185,129,.2)', typeText='#34d399';
    if(numVals.length>vals.length*0.5){type='numeric';typeLbl=lang==='ar'?'رقمي':'Numeric';typeColor='rgba(99,102,241,.2)';typeText='#818cf8';}
    else if(dateVals.length>vals.length*0.3){type='date';typeLbl=lang==='ar'?'تاريخ':'Date';typeColor='rgba(6,182,212,.2)';typeText='#22d3ee';}
    let details='';
    if(type==='numeric'&&numVals.length>0){
      const mn=Math.min(...numVals),mx=Math.max(...numVals),avg=numVals.reduce((a,b)=>a+b,0)/numVals.length;
      const sorted2=[...numVals].sort((a,b)=>a-b),med=sorted2[Math.floor(sorted2.length/2)];
      const sd=Math.sqrt(numVals.reduce((a,b)=>a+(b-avg)**2,0)/numVals.length);
      const bins=8,rng2=mx-mn||1,bkts=Array(bins).fill(0);
      numVals.forEach(n=>bkts[Math.min(Math.floor((n-mn)/rng2*bins),bins-1)]++);
      const maxB=Math.max(...bkts)||1;
      const spark=bkts.map((c,i)=>`<rect x="${i*10}" y="${22-Math.round(c/maxB*22)}" width="9" height="${Math.round(c/maxB*22)}" fill="#6366f1" opacity=".7"/>`).join('');
      details=`<div class="profiler-stats">
        <span>${lang==='ar'?'أدنى':'Min'}: <b>${mn.toLocaleString(undefined,{maximumFractionDigits:2})}</b></span>
        <span>${lang==='ar'?'أعلى':'Max'}: <b>${mx.toLocaleString(undefined,{maximumFractionDigits:2})}</b></span>
        <span>${lang==='ar'?'متوسط':'Avg'}: <b>${avg.toLocaleString(undefined,{maximumFractionDigits:2})}</b></span>
        <span>${lang==='ar'?'وسيط':'Median'}: <b>${med.toLocaleString(undefined,{maximumFractionDigits:2})}</b></span>
        <span>σ: <b>${sd.toLocaleString(undefined,{maximumFractionDigits:2})}</b></span>
      </div><svg width="82" height="24" style="margin-top:.5rem">${spark}</svg>`;
    } else if(type==='date'&&dateVals.length>0){
      const dates=dateVals.map(v=>new Date(v)).filter(d=>!isNaN(d)).sort((a,b)=>a-b);
      if(dates.length>=2){const range=Math.round((dates[dates.length-1]-dates[0])/(864e5));
        details=`<div class="profiler-stats">
          <span>${lang==='ar'?'من':'From'}: <b>${dates[0].toLocaleDateString(lang==='ar'?'ar-SA':'en-US')}</b></span>
          <span>${lang==='ar'?'إلى':'To'}: <b>${dates[dates.length-1].toLocaleDateString(lang==='ar'?'ar-SA':'en-US')}</b></span>
          <span>${lang==='ar'?'المدة':'Range'}: <b>${range} ${lang==='ar'?'يوم':'days'}</b></span>
        </div>`;}
    } else {
      const unique=new Set(vals.filter(v=>!isEmpty(v)).map(v=>String(v).trim()));
      const freq2={}; vals.forEach(v=>{const s=String(v||'').trim();if(s)freq2[s]=(freq2[s]||0)+1;});
      const top2=Object.entries(freq2).sort((a,b)=>b[1]-a[1])[0];
      details=`<div class="profiler-stats">
        <span>${lang==='ar'?'قيم فريدة':'Unique'}: <b>${unique.size}</b></span>
        ${top2?`<span>${lang==='ar'?'الأكثر تكراراً':'Top'}: <b>${top2[0]}</b> (${top2[1]})</span>`:''}
      </div>`;
    }
    return `<div class="profiler-item">
      <div class="profiler-header" onclick="this.nextElementSibling.classList.toggle('open');this.querySelector('.pchev').textContent=this.nextElementSibling.classList.contains('open')?'▲':'▼'">
        <span class="profiler-col-name">${col}</span>
        <span class="type-badge-sm" style="background:${typeColor};color:${typeText}">${typeLbl}</span>
        <div style="flex:1;margin:0 .75rem">
          <div class="fill-bar-outer"><div class="fill-bar-inner" style="width:${fillPct}%;background:${fillPct>80?'var(--success)':fillPct>50?'var(--warning)':'var(--error)'}"></div></div>
          <div style="font-size:.68rem;color:var(--muted);margin-top:.15rem">${fillPct}% ${lang==='ar'?'ممتلئة':'filled'}</div>
        </div>
        <span class="pchev" style="color:var(--muted);font-size:.8rem">▼</span>
      </div>
      <div class="profiler-body">${details}</div>
    </div>`;
  });
  document.getElementById('column-profiler').innerHTML = `<div class="profiler-list">${items.join('')}</div>`;
}

// ── Section 5: Column Comparison ─────────────────────
function renderColumnComparison() {
  document.getElementById('column-comparison').innerHTML = `
    <div class="card">
      <div class="card-title">⚖️ ${lang==='ar'?'مقارنة الأعمدة':'Column Comparison'}</div>
      <div class="comp-selectors">
        <select id="comp-x" class="comp-select" onchange="runColumnComparison()">
          <option value="">${lang==='ar'?'اختر عمود X':'Select column X'}</option>
          ${analyticsHeaders.map(h=>`<option value="${h}">${h}</option>`).join('')}
        </select>
        <span style="color:var(--muted);flex-shrink:0">vs</span>
        <select id="comp-y" class="comp-select" onchange="runColumnComparison()">
          <option value="">${lang==='ar'?'اختر عمود Y':'Select column Y'}</option>
          ${analyticsHeaders.map(h=>`<option value="${h}">${h}</option>`).join('')}
        </select>
      </div>
      <div id="comp-result" style="margin-top:1.25rem"></div>
    </div>`;
}

function runColumnComparison() {
  const xCol=document.getElementById('comp-x').value, yCol=document.getElementById('comp-y').value;
  if(!xCol||!yCol||xCol===yCol) return;
  const data=getFilteredData();
  const xNum=data.filter(r=>isNumeric(r[xCol])).length>data.length*0.4;
  const yNum=data.filter(r=>isNumeric(r[yCol])).length>data.length*0.4;
  const result=document.getElementById('comp-result');
  if(xNum&&yNum){
    const pairs=data.filter(r=>isNumeric(r[xCol])&&isNumeric(r[yCol])).map(r=>({x:parseFloat(String(r[xCol]).replace(/,/g,'')),y:parseFloat(String(r[yCol]).replace(/,/g,''))})).slice(0,60);
    const n=pairs.length,mx=pairs.reduce((a,b)=>a+b.x,0)/n,my=pairs.reduce((a,b)=>a+b.y,0)/n;
    const num2=pairs.reduce((a,p)=>a+(p.x-mx)*(p.y-my),0);
    const den=Math.sqrt(pairs.reduce((a,p)=>a+(p.x-mx)**2,0)*pairs.reduce((a,p)=>a+(p.y-my)**2,0));
    const corr=den?num2/den:0;
    const cLbl=Math.abs(corr)>0.7?`${lang==='ar'?'ارتباط قوي':'Strong correlation'} 🔥`:Math.abs(corr)>0.4?(lang==='ar'?'ارتباط متوسط':'Moderate correlation'):(lang==='ar'?'لا ارتباط':'Weak correlation');
    const cCol=Math.abs(corr)>0.7?'var(--success)':Math.abs(corr)>0.4?'var(--warning)':'var(--muted)';
    const W=160,H=90;
    const xs=pairs.map(p=>p.x),ys=pairs.map(p=>p.y);
    const xMn=Math.min(...xs),xMx=Math.max(...xs),yMn=Math.min(...ys),yMx=Math.max(...ys);
    const xR=xMx-xMn||1,yR=yMx-yMn||1;
    const dots=pairs.map(p=>`<circle cx="${((p.x-xMn)/xR*W).toFixed(1)}" cy="${(H-(p.y-yMn)/yR*H).toFixed(1)}" r="2.5" fill="#6366f1" opacity=".65"><title>${xCol}: ${p.x} | ${yCol}: ${p.y}</title></circle>`).join('');
    result.innerHTML=`<div style="text-align:center;margin-bottom:.75rem;font-size:.9rem;color:${cCol}">r = ${corr.toFixed(3)} — ${cLbl}</div>
      <svg viewBox="0 0 ${W+10} ${H+10}" style="width:100%;max-width:320px;display:block;margin:0 auto">
        <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="rgba(255,255,255,.08)" stroke-width="1"/>
        <line x1="0" y1="0" x2="0" y2="${H}" stroke="rgba(255,255,255,.08)" stroke-width="1"/>
        ${dots}
      </svg>`;
  } else {
    const catCol=xNum?yCol:xCol,numCol=xNum?xCol:yCol;
    if(!data.filter(r=>isNumeric(r[numCol])).length){result.innerHTML=`<p style="color:var(--muted);text-align:center">${lang==='ar'?'لا يمكن المقارنة':'Cannot compare'}</p>`;return;}
    const g={}; data.forEach(r=>{const k=String(r[catCol]||'').trim();const v=parseFloat(String(r[numCol]).replace(/,/g,''));if(k&&!isNaN(v))g[k]=(g[k]||0)+v;});
    const s2=Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const mxV=Math.max(...s2.map(s=>s[1]))||1, bw2=180/s2.length;
    const bars2=s2.map(([k,v],i)=>`<rect x="${i*bw2+1}%" y="${90-Math.round(v/mxV*78)}%" width="${bw2-2}%" height="${Math.round(v/mxV*78)}%" fill="#6366f1" opacity="${0.55+i*0.04}" rx="2"><title>${k}: ${v.toLocaleString(undefined,{maximumFractionDigits:0})}</title></rect>`).join('');
    const lbls2=s2.map(([k],i)=>`<text x="${(i*bw2+bw2/2).toFixed(1)}%" y="97%" text-anchor="middle" font-size="6.5" fill="var(--muted)">${k.slice(0,7)}</text>`).join('');
    result.innerHTML=`<svg viewBox="0 0 200 105" style="width:100%;height:140px">${bars2}${lbls2}<line x1="0" y1="90%" x2="100%" y2="90%" stroke="rgba(255,255,255,.07)" stroke-width="1"/></svg>`;
  }
}

// ── Analytics PDF ─────────────────────────────────────
function exportAnalyticsPDF() {
  const now=new Date();
  const hijri=gregorianToHijri(now.getFullYear(),now.getMonth()+1,now.getDate());
  const greg=now.toLocaleDateString(lang==='ar'?'ar-SA':'en-US');
  const data=getFilteredData();
  const nc=analyticsHeaders.filter(h=>data.filter(r=>isNumeric(r[h])).length>data.length*0.4);
  let statsRows='';
  nc.slice(0,4).forEach(col=>{
    const nums=data.map(r=>parseFloat(String(r[col]).replace(/,/g,''))).filter(n=>!isNaN(n));
    if(!nums.length)return;
    const avg=nums.reduce((a,b)=>a+b,0)/nums.length;
    statsRows+=`<tr><td>${col}</td><td>${nums.length}</td><td>${Math.min(...nums).toLocaleString(undefined,{maximumFractionDigits:2})}</td><td>${Math.max(...nums).toLocaleString(undefined,{maximumFractionDigits:2})}</td><td>${avg.toLocaleString(undefined,{maximumFractionDigits:2})}</td><td>${nums.reduce((a,b)=>a+b,0).toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>`;
  });
  const insEls=document.getElementById('ai-analytics-insights')?.querySelectorAll('.ai-insight-card');
  const insList=insEls?[...insEls].map(el=>`<li>${el.textContent.trim()}</li>`).join(''):'';
  const profEl=document.getElementById('column-profiler');
  const colSummary=analyticsHeaders.map(col=>{
    const vals=data.map(r=>r[col]);
    const filled=vals.filter(v=>!isEmpty(v)).length;
    const unique=new Set(vals.filter(v=>!isEmpty(v)).map(v=>String(v).trim())).size;
    const isNum=data.filter(r=>isNumeric(r[col])).length>data.length*0.4;
    const isDt=data.filter(r=>isDate(r[col])&&!isEmpty(r[col])).length>data.length*0.3;
    const tl=isNum?(lang==='ar'?'رقمي':'Numeric'):isDt?(lang==='ar'?'تاريخ':'Date'):(lang==='ar'?'نصي':'Text');
    return `<tr><td>${col}</td><td>${tl}</td><td>${Math.round(filled/vals.length*100)}%</td><td>${unique}</td></tr>`;
  }).join('');
  const pw=window.open('','_blank');
  pw.document.write(`<!DOCTYPE html><html dir="${lang==='ar'?'rtl':'ltr'}" lang="${lang}">
  <head><meta charset="UTF-8"><title>DataCell Analytics</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>body{font-family:${lang==='ar'?"'Tajawal'":"'Inter'"};direction:${lang==='ar'?'rtl':'ltr'};padding:40px;color:#1a1a1a;background:white;font-size:13px}h1{background:linear-gradient(135deg,#6366f1,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:26px}h2{color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:20px 0 10px}table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#6366f1;color:white;padding:7px;text-align:start;font-size:12px}td{padding:7px;border-bottom:1px solid #e2e8f0;font-size:12px}.stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.stat-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}.big{font-size:20px;font-weight:800;color:#6366f1}@media print{body{padding:20px}}</style></head>
  <body>
  <h1>DataCell</h1>
  <p style="color:#64748b">${lang==='ar'?'تقرير تحليل البيانات':'Analytics Report'} • ${greg} | ${hijri}</p>
  <p>${lang==='ar'?'الملف':'File'}: ${filename||'—'} | ${lang==='ar'?'الصفوف':'Rows'}: ${data.length} | ${lang==='ar'?'الأعمدة':'Cols'}: ${analyticsHeaders.length} | ${lang==='ar'?'نوع البيانات':'Type'}: ${detectedType}</p>
  <h2>${lang==='ar'?'إحصائيات الأعمدة الرقمية':'Numeric Statistics'}</h2>
  <table><thead><tr><th>${lang==='ar'?'العمود':'Column'}</th><th>${lang==='ar'?'العدد':'Count'}</th><th>Min</th><th>Max</th><th>${lang==='ar'?'متوسط':'Avg'}</th><th>${lang==='ar'?'الإجمالي':'Total'}</th></tr></thead><tbody>${statsRows}</tbody></table>
  <h2>${lang==='ar'?'التحليل الذكي':'Smart Insights'}</h2><ul style="line-height:2">${insList}</ul>
  <h2>${lang==='ar'?'ملخص الأعمدة':'Column Summary'}</h2>
  <table><thead><tr><th>${lang==='ar'?'العمود':'Column'}</th><th>${lang==='ar'?'النوع':'Type'}</th><th>${lang==='ar'?'% ممتلئة':'Filled'}</th><th>${lang==='ar'?'فريدة':'Unique'}</th></tr></thead><tbody>${colSummary}</tbody></table>
  <p style="margin-top:30px;color:#94a3b8;font-size:11px">Generated by DataCell</p>
  <script>window.onload=function(){window.print();}<\/script></body></html>`);
  pw.document.close();
}

// ── Analytics Presentation Mode ───────────────────────
function openAnalyticsPresentation() {
  const pres=document.getElementById('presentation-mode');
  pres.classList.add('active');
  const data=getFilteredData();
  const nc=analyticsHeaders.filter(h=>data.filter(r=>isNumeric(r[h])).length>data.length*0.4);
  document.getElementById('pres-gauge-wrap').innerHTML=`
    <div style="font-size:1.1rem;font-weight:700;color:var(--secondary);margin-bottom:.5rem">
      ${lang==='ar'?'تقرير التحليل':'Analytics Report'} — ${filename||''}
    </div>`;
  const cells=nc.slice(0,3).map(col=>{
    const nums=data.map(r=>parseFloat(String(r[col]).replace(/,/g,''))).filter(n=>!isNaN(n));
    const total=nums.reduce((a,b)=>a+b,0);
    return `<div class="pres-stat"><div class="stat-number">${total.toLocaleString(undefined,{maximumFractionDigits:0})}</div><div class="stat-label">${lang==='ar'?'إجمالي '+col:'Total '+col}</div></div>`;
  }).join('');
  document.getElementById('pres-grid').innerHTML=`
    <div class="pres-stat"><div class="stat-number">${data.length.toLocaleString()}</div><div class="stat-label">${lang==='ar'?'إجمالي الصفوف':'Total Rows'}</div></div>
    <div class="pres-stat"><div class="stat-number">${analyticsHeaders.length}</div><div class="stat-label">${lang==='ar'?'عدد الأعمدة':'Columns'}</div></div>
    ${cells}`;
}

// ═══════════════════════════════════════════════════════
// WOW INVESTOR SECTIONS
// ═══════════════════════════════════════════════════════

// ROI Engine constants (Separation of Concerns — pure logic, no DOM)
// Manual cleaning: 60 min/file | DataCell: 1 min/file | Speed factor: 60×
var ROI_MANUAL_MIN = 60;
var ROI_SYS_MIN    = 1;
var _roiPrev = { h: 0, m: 0, y: 0 };

/**
 * Animated counter: counts from `from` to `to` using ease-out cubic.
 * Zero-side-effect — only updates the specified DOM element.
 * @param {string} id   - Element ID
 * @param {number} from - Start value
 * @param {number} to   - End value
 * @param {string} suf  - Suffix string appended to displayed number
 * @param {number} dur  - Animation duration in ms
 */
function roiCountUp(id, from, to, suf, dur) {
  var el = document.getElementById(id);
  if (!el) return;
  var start = null;
  var diff = to - from;
  function tick(ts) {
    if (!start) start = ts;
    var p = Math.min((ts - start) / dur, 1);
    var ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + diff * ease).toLocaleString('ar-SA') + (suf || '');
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/** Compute and display ROI results. Called on every slider change. */
function wowROI() {
  var e = +document.getElementById('wow-emp').value;
  var f = +document.getElementById('wow-files').value;
  var r = +document.getElementById('wow-rate').value;

  // Update slider value badges (sanitized — numbers only, no innerHTML risk)
  document.getElementById('wow-empV').textContent   = e;
  document.getElementById('wow-filesV').textContent = f;
  document.getElementById('wow-rateV').textContent  = r;

  // Speed factor (fixed: 60 min manual ÷ 1 min system = 60×)
  var speedFactor = Math.round(ROI_MANUAL_MIN / ROI_SYS_MIN);
  var speedEl = document.getElementById('wow-speed-x');
  if (speedEl) speedEl.textContent = speedFactor + '×';

  // Core calculation
  // Hours saved/month = employees × files × (manualMin − sysMin) / 60
  var hoursSaved  = Math.round(e * f * (ROI_MANUAL_MIN - ROI_SYS_MIN) / 60);
  var moneySaved  = Math.round(hoursSaved * r);
  var yearSaved   = moneySaved * 12;

  // Animated counters from previous value → new value
  roiCountUp('wow-hours', _roiPrev.h, hoursSaved, '',      600);
  roiCountUp('wow-money', _roiPrev.m, moneySaved, ' ر.س', 700);
  roiCountUp('wow-year',  _roiPrev.y, yearSaved,  ' ر.س', 800);

  _roiPrev = { h: hoursSaved, m: moneySaved, y: yearSaved };
}
function wowAnim(id,target,suffix,dur){
  var el=document.getElementById(id),s=0,step=target/(dur/16);
  var t=setInterval(function(){s=Math.min(s+step,target);el.textContent=Math.round(s).toLocaleString('ar-SA')+(suffix||'');if(s>=target)clearInterval(t);},16);
}
function wowScore(){
  var rows=window.cleanedData||cleanData||[];
  var empty=0,dups=0,clean=0,seen={};
  rows.forEach(function(r){
    var k=JSON.stringify(r),hasE=Object.values(r).some(function(v){return v===null||v===undefined||String(v).trim()==='';});
    if(hasE)empty++;else if(seen[k])dups++;else clean++;
    seen[k]=true;
  });
  var total=rows.length||1,score=Math.round(clean/total*100);
  var ring=document.getElementById('wow-ring');
  if(!ring)return;
  var circ=2*Math.PI*54;
  ring.style.strokeDasharray=circ;
  ring.style.strokeDashoffset=circ*(1-score/100);
  ring.style.stroke=score>=80?'#16a34a':score>=60?'#d97706':'#dc2626';
  var n=document.getElementById('wow-score-num'),c=0;
  var ti=setInterval(function(){c=Math.min(c+2,score);n.textContent=c;if(c>=score)clearInterval(ti);},20);
  document.getElementById('wow-score-label').textContent=score>=80?'بياناتك ممتازة 🎉':score>=60?'جودة متوسطة':'تحتاج معالجة عاجلة';
  setTimeout(function(){
    document.getElementById('wow-b1').style.width=Math.round(dups/total*100)+'%';
    document.getElementById('wow-b2').style.width=Math.round(empty/total*100)+'%';
    document.getElementById('wow-b3').style.width=Math.round(empty/total*100)+'%';
    document.getElementById('wow-b4').style.width=Math.round(clean/total*100)+'%';
    document.getElementById('wow-b1-count').textContent=dups+' سجل';
    document.getElementById('wow-b2-count').textContent=empty+' سجل';
    document.getElementById('wow-b3-count').textContent=empty+' سجل';
    document.getElementById('wow-b4-count').textContent=clean+' سجل';
  },300);
}
function wowInit(){
  wowROI();
  wowScore();
  wowAnim('wow-c1',148,'',1400);
  wowAnim('wow-c2',4,'M+',1600);
  wowAnim('wow-c3',18700,'',1800);
  wowAnim('wow-c4',97,'%',1200);
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
