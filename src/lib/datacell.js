// ═══════════════════════════════════════════════════════
// STATE & CONFIG
// ═══════════════════════════════════════════════════════
let lang = 'ar';
let rawData = [];
let cleanData = [];
let headers = [];
let rawHeaders = [];
let filename = '';
let problems = {};

// ═══════════════════════════════════════════════════════
// FILE HANDLING (إصلاح مشكلة الرفع)
// ═══════════════════════════════════════════════════════
function handleFile(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function handleDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function processFile(file) {
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
      rawHeaders = [...headers];
      
      startProcessing();
    } catch(err) {
      alert("خطأ في قراءة الملف");
    }
  };
  reader.readAsArrayBuffer(file);
}

function startProcessing() {
  showScreen('processing');
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = '100%';
  
  setTimeout(() => {
    analyzeData();
    showDiagnosis();
  }, 1000);
}

// ═══════════════════════════════════════════════════════
// ANALYSIS & SCREENS
// ═══════════════════════════════════════════════════════
function analyzeData() {
  problems = { duplicates: 0, emptyCells: 0, formatIssues: 0, outliers: 0, emptyColumns: 0 };
  // منطق التحليل البسيط
  rawData.forEach(row => {
    headers.forEach(h => {
      if (!row[h] || row[h] === '') problems.emptyCells++;
    });
  });
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
}

function showDiagnosis() {
  showScreen('diagnosis');
  // استدعاء رندر البيانات في شاشة التقرير إذا وجدت
  if(window.renderPreviewTable) renderPreviewTable();
}

// ═══════════════════════════════════════════════════════
// INSIGHTS & MOBILE FIX (حل مشكلة الرموز)
// ═══════════════════════════════════════════════════════
function renderComparisonTable(tableId, data) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;

  const preview = data.slice(0, 10);
  const cols = rawHeaders.length ? rawHeaders : (data.length ? Object.keys(data[0]) : []);

  const ths = `<tr>${cols.map(h => `<th style="text-align:right">${h}</th>`).join('')}</tr>`;
  
  const trs = preview.map(row => {
    const tds = cols.map(col => {
      let val = row[col] === null || row[col] === undefined ? '' : String(row[col]).trim();
      return `<td title="${val}" style="white-space:nowrap; max-width:150px; overflow:hidden; text-overflow:ellipsis; direction:rtl; text-align:right">${val}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  tbl.innerHTML = `<thead>${ths}</thead><tbody>${trs}</tbody>`;
}

function showInsights() {
  showScreen('insights');
  renderComparisonTable('clean-table-before', rawData);
  renderComparisonTable('clean-table-after', cleanData);
}

function startCleaning() {
  showScreen('cleaning');
  cleanData = JSON.parse(JSON.stringify(rawData));
  // عملية تنظيف سريعة
  setTimeout(() => {
    showInsights();
  }, 1500);
}

// ═══════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════
window.handleFile = handleFile;
window.handleDrop = handleDrop;
window.startCleaning = startCleaning;
window.showInsights = showInsights;
window.loadSampleData = () => { 
  rawData = [{ "الاسم": "تجربة", "القيمة": "100" }]; 
  headers = ["الاسم", "القيمة"]; 
  rawHeaders = [...headers];
  startProcessing(); 
};