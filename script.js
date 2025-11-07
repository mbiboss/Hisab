/* script.js - Vanilla JS ledger PWA
   Clean, commented, mobile-first.
*/

/* ------------------ helpers ------------------ */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const TODAY = () => new Date();

function formatDMY(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}, ${mm}, ${yyyy}`;
}
function formatSlash(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function addDays(date, days) { const t = new Date(date.getTime()); t.setDate(t.getDate() + days); return t; }
function parseDMYString(str) { if (!str) return null; const parts = str.includes(',') ? str.split(',').map(s => s.trim()) : str.split('/').map(s => s.trim()); if (parts.length < 3) return null; return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`); }

/* ------------------ state & refs ------------------ */
const STORAGE_KEY = 'ajker-hisab-v1';
const REM_KEY = 'ajker-hisab-reminder';
const THEME_KEY = 'ajker-theme'; // Defined THEME_KEY
const LANG_KEY = 'ajker-lang'; // Defined LANG_KEY
const appState = { month: new Date(TODAY().getFullYear(), TODAY().getMonth(), 1), lang: localStorage.getItem(LANG_KEY) || 'bn', theme: localStorage.getItem(THEME_KEY) || 'dark', rows: [], note: '' };

const tableBody = $('#tableBody');
const tableFoot = $('#tableFoot');
const addRowBtn = $('#addRow');
const saveBtn = $('#saveBtn');
const downloadBtn = $('#downloadBtn');
const toast = $('#toast');
const monthPanel = $('#monthPanel');
const monthSelector = $('#monthSelector');
const filledMonths = $('#filledMonths');
const logoArea = $('#logoArea');
const splash = $('#splash');
const tapStart = $('#tapStart');
const appDiv = $('#app');
const themeBtn = $('#themeBtn');
const langBtn = $('#langBtn');
const reminderBtn = $('#reminderBtn');
const reminderModal = $('#reminderModal');
const reminderTime = $('#reminderTime');
const reminderSave = $('#reminderSave');
const reminderCancel = $('#reminderCancel');
const reminderExists = $('#reminderExists');
const reminderEmpty = $('#reminderEmpty');
const reminderTimeDisplay = $('#reminderTimeDisplay');
const reminderDeleteBtn = $('#reminderDeleteBtn');
const reminderCloseBtn = $('#reminderCloseBtn');
const monthNoteInput = $('#monthNote');
const displayMonth = $('#displayMonth');
const monthEndPrompt = $('#monthEndPrompt');
const promptDownloadBtn = $('#promptDownloadBtn');

/* ------------------ load/save ------------------ */
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { try { const obj = JSON.parse(raw); if (obj.rows) appState.rows = obj.rows; if (obj.month) appState.month = new Date(obj.month); if (obj.note) appState.note = obj.note; } catch (e) { console.warn(e); } }
  applyTheme(appState.theme); applyLang(appState.lang); updateMonthLabel(); renderTable(); monthNoteInput.value = appState.note || '';
}
function saveState(showToast = true) { const payload = { month: appState.month.toISOString(), rows: appState.rows, note: appState.note || '' }; localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); if (showToast) showSavedToast(); }

let toastTimer = null; function showSavedToast() { toast.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000); }

/* ------------------ table rendering ------------------ */
function renderTable() {
  tableBody.innerHTML = ''; const rows = appState.rows.filter(r => { const d = parseDMYString(r.date); return d && d.getMonth() === appState.month.getMonth() && d.getFullYear() === appState.month.getFullYear(); }).sort((a, b) => parseDMYString(a.date) - parseDMYString(b.date));
  const placeholder = window.langTexts?.notePlaceholder || 'notes...';
  rows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="input-cell date-input" value="${r.date}" data-index="${idx}"/></td>
      <td><input class="input-cell in-input" value="${r.in || ''}" data-index="${idx}"/></td>
      <td><input class="input-cell out-input" value="${r.out || ''}" data-index="${idx}"/></td>
      <td><input class="input-cell ot-input" value="${r.ot || ''}" data-index="${idx}"/></td>
      <td><input class="input-cell note-input" placeholder="${placeholder}" value="${r.note || ''}" data-index="${idx}"/></td>
      <td><button class="small-btn del" data-index="${idx}" title="Delete">✕</button></td>
    `;
    tr.style.opacity = '0';
    tr.style.transform = 'translateY(-10px)';
    tr.style.transition = 'all 0.3s ease';
    tableBody.appendChild(tr);
    setTimeout(() => { tr.style.opacity = '1'; tr.style.transform = 'translateY(0)'; }, idx * 30);
  });
  updateTotals(); attachTableListeners(); populateMonthSelector();
}

function updateTotals() { const rows = appState.rows.filter(r => { const d = parseDMYString(r.date); return d && d.getMonth() === appState.month.getMonth() && d.getFullYear() === appState.month.getFullYear(); }); const sum = rows.reduce((acc, r) => { acc.in += Number(r.in || 0); acc.out += Number(r.out || 0); acc.ot += Number(r.ot || 0); return acc; }, { in: 0, out: 0, ot: 0 }); const totalText = window.langTexts?.total || 'Total'; tableFoot.innerHTML = `<tr><td>${totalText}</td><td>${sum.in}</td><td>${sum.out}</td><td>${sum.ot}</td><td colspan="2"></td></tr>`; checkMonthCompletion(); }

function checkMonthCompletion() {
  const rows = appState.rows.filter(r => { const d = parseDMYString(r.date); return d && d.getMonth() === appState.month.getMonth() && d.getFullYear() === appState.month.getFullYear(); });

  if (rows.length === 0) {
    monthEndPrompt.classList.add('hidden');
    return;
  }

  const lastDayOfMonth = new Date(appState.month.getFullYear(), appState.month.getMonth() + 1, 0).getDate();
  const dates = rows.map(r => parseDMYString(r.date)).filter(d => d !== null);
  const uniqueDays = new Set(dates.map(d => d.getDate()));

  const isMonthComplete = uniqueDays.size >= lastDayOfMonth;

  if (isMonthComplete) {
    monthEndPrompt.classList.remove('hidden');
  } else {
    monthEndPrompt.classList.add('hidden');
  }
}

function attachTableListeners() { $$('.input-cell').forEach(inp => { inp.oninput = (e) => { const idx = Number(e.target.dataset.index); const globalIndex = findGlobalIndexByDisplayedIndex(idx); if (globalIndex === -1) return; const t = e.target; if (t.classList.contains('date-input')) appState.rows[globalIndex].date = t.value; else if (t.classList.contains('in-input')) appState.rows[globalIndex].in = t.value; else if (t.classList.contains('out-input')) appState.rows[globalIndex].out = t.value; else if (t.classList.contains('ot-input')) appState.rows[globalIndex].ot = t.value; else if (t.classList.contains('note-input')) appState.rows[globalIndex].note = t.value; saveState(false); updateTotals(); }; }); $$('.del').forEach(b => b.onclick = (e) => { const idx = Number(e.target.dataset.index); const globalIndex = findGlobalIndexByDisplayedIndex(idx); if (globalIndex > -1) { appState.rows.splice(globalIndex, 1); saveState(); renderTable(); } }); }
function findGlobalIndexByDisplayedIndex(displayedIndex) { const filtered = appState.rows.map((r, i) => { const d = parseDMYString(r.date); return { r, i, ok: d && d.getMonth() === appState.month.getMonth() && d.getFullYear() === appState.month.getFullYear() }; }).filter(x => x.ok); if (displayedIndex < 0 || displayedIndex >= filtered.length) return -1; return filtered[displayedIndex].i; }

/* ------------------ add row ------------------ */
addRowBtn.addEventListener('click', (e) => {
  createRipple(e, addRowBtn);
  const rows = appState.rows.filter(r => { const d = parseDMYString(r.date); return d && d.getMonth() === appState.month.getMonth() && d.getFullYear() === appState.month.getFullYear(); }).map(r => parseDMYString(r.date)).sort((a, b) => a - b);
  let dateToAdd;
  if (rows.length === 0) { const today = TODAY(); if (today.getMonth() === appState.month.getMonth() && today.getFullYear() === appState.month.getFullYear()) { dateToAdd = today; } else { dateToAdd = new Date(appState.month.getFullYear(), appState.month.getMonth(), 1); } } else { const last = rows[rows.length - 1]; dateToAdd = addDays(last, 1); }
  const newRow = { date: formatDMY(dateToAdd), in: '', out: '', ot: '', note: '' };
  appState.rows.push(newRow); saveState(); renderTable(); const lastDay = new Date(appState.month.getFullYear(), appState.month.getMonth() + 1, 0).getDate(); if (dateToAdd.getDate() === lastDay) suggestDownloadMonth();
});

/* ------------------ save & export ------------------ */
saveBtn.addEventListener('click', (e) => {
  appState.note = monthNoteInput.value || '';
  saveState();
  const rect = saveBtn.getBoundingClientRect();
  createConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  createRipple(e, saveBtn);
});
downloadBtn.addEventListener('click', async (e) => {
  createRipple(e, downloadBtn);
  await exportMonthAsTxt(appState.month);
});
promptDownloadBtn.addEventListener('click', async (e) => {
  createRipple(e, promptDownloadBtn);
  await exportMonthAsTxt(appState.month);
});

function buildTxtForMonth(monthDate) { const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; const rows = appState.rows.filter(r => { const d = parseDMYString(r.date); return d && d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear(); }).sort((a, b) => parseDMYString(a.date) - parseDMYString(b.date)); const header = `***${monthNames[monthDate.getMonth()]}***${monthDate.getFullYear()}***\n`; const cols = `Date           | In Time | Out Time | OT Time | Notes |\n`; const divider = '-'.repeat(62) + '\n'; let body = ''; rows.forEach(r => { const d = parseDMYString(r.date); const lineDate = d ? formatSlash(d) : r.date; const inV = String(r.in || ''); const outV = String(r.out || ''); const otV = String(r.ot || ''); const note = r.note ? ` ${r.note}` : ''; const pad = (s, len) => s.padEnd(len, ' '); body += `${pad(lineDate, 14)} | ${pad(inV, 6)} | ${pad(outV, 7)} | ${pad(otV, 6)} |${note}\n`; body += divider; }); const totals = rows.reduce((acc, r) => { acc.in += Number(r.in || 0); acc.out += Number(r.out || 0); acc.ot += Number(r.ot || 0); return acc; }, { in: 0, out: 0, ot: 0 }); const totalsText = `Total : ${totals.in} | ${totals.out} | ${totals.ot}\n\n`; const note = appState.note ? `(notes) ${appState.note}\n` : '(notes)\n'; return header + cols + divider + body + totalsText + note; }

async function exportMonthAsTxt(monthDate) {
  const content = buildTxtForMonth(monthDate); const monthName = monthDate.toLocaleString('en-US', { month: 'long' }); const filename = `Hisab_${monthName}_${monthDate.getFullYear()}.txt`;
  if (window.showSaveFilePicker) { try { const opts = { suggestedName: filename, types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }] }; const handle = await window.showSaveFilePicker(opts); const writable = await handle.createWritable(); await writable.write(content); await writable.close(); alert(window.langTexts?.fileSaved || 'File saved successfully.'); return; } catch (e) { console.warn('File Save API failed', e); } }
  const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function suggestDownloadMonth() { const monthName = appState.month.toLocaleString(appState.lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long' }); const prompt = window.langTexts?.downloadPrompt || `End of ${monthName} reached. Download this month's file?`; setTimeout(() => { const ok = confirm(`${monthName} ${prompt}`); if (ok) downloadBtn.click(); }, 250); }

/* ------------------ month panel ------------------ */
function updateMonthLabel() {
  const label = appState.month.toLocaleString(appState.lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' });
  displayMonth.textContent = label;
  populateMonthSelector();
}

function populateMonthSelector() {
  const currentYear = TODAY().getFullYear();
  const startYear = currentYear - 2;
  const endYear = currentYear + 1;

  monthSelector.min = `${startYear}-01`;
  monthSelector.max = `${endYear}-12`;

  const year = appState.month.getFullYear();
  const month = String(appState.month.getMonth() + 1).padStart(2, '0');
  monthSelector.value = `${year}-${month}`;

  updateFilledMonthsIndicator();
}

function updateFilledMonthsIndicator() {
  const monthsWithData = {};

  appState.rows.forEach(r => {
    const d = parseDMYString(r.date);
    if (d) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthsWithData[key] = d;
    }
  });

  const sortedMonths = Object.values(monthsWithData).sort((a, b) => b - a);

  if (sortedMonths.length === 0) {
    filledMonths.innerHTML = `<span class="no-data">${appState.lang === 'bn' ? 'কোন ডেটা নেই' : 'No data'}</span>`;
  } else {
    filledMonths.innerHTML = sortedMonths.map(d => {
      const label = d.toLocaleString(appState.lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', year: 'numeric' });
      const year = d.getFullYear();
      const month = d.getMonth();
      return `<span class="filled-chip" data-year="${year}" data-month="${month}" role="button" tabindex="0" style="opacity:0;transform:translateY(10px)">${label}</span>`;
    }).join('');

    // Add stagger animation and click handlers to chips
    $$('.filled-chip').forEach((chip, idx) => {
      setTimeout(() => {
        chip.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        chip.style.opacity = '1';
        chip.style.transform = 'translateY(0)';
      }, idx * 50);

      chip.addEventListener('click', () => {
        const year = parseInt(chip.dataset.year);
        const month = parseInt(chip.dataset.month);
        appState.month = new Date(year, month, 1);
        updateMonthLabel();
        renderTable();
        monthPanel.classList.add('hidden');
      });

      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') chip.click();
      });
    });
  }
}

monthSelector.addEventListener('change', (e) => {
  const [year, month] = e.target.value.split('-');
  appState.month = new Date(parseInt(year), parseInt(month) - 1, 1);
  updateMonthLabel();
  renderTable();
});

logoArea.addEventListener('click', () => monthPanel.classList.toggle('hidden'));
logoArea.addEventListener('keydown', (e) => { if (e.key === 'Enter') logoArea.click(); });

document.addEventListener('click', (e) => {
  if (!monthPanel.classList.contains('hidden') && !monthPanel.contains(e.target) && !logoArea.contains(e.target)) {
    monthPanel.classList.add('hidden');
  }
});

/* ------------------ theme & language ------------------ */
function applyTheme(theme) {
  if (theme === 'light') document.body.classList.add('light');
  else document.body.classList.remove('light');
  localStorage.setItem(THEME_KEY, theme);
  const metaTheme = document.getElementById('meta-theme-color');
  if (metaTheme) { metaTheme.setAttribute('content', theme === 'light' ? '#ffffff' : '#000000'); }

  // Update theme icon
  const themeIconPath = document.getElementById('themeIconPath');
  if (themeIconPath) {
    if (theme === 'light') {
      // Sun icon for light mode
      themeIconPath.setAttribute('d', 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z');
    } else {
      // Moon icon for dark mode
      themeIconPath.setAttribute('d', 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z');
    }
  }
}
themeBtn.addEventListener('click', () => { appState.theme = (appState.theme === 'dark') ? 'light' : 'dark'; applyTheme(appState.theme); });

function applyLang(lang) {
  appState.lang = lang;
  localStorage.setItem(LANG_KEY, lang);

  const translations = {
    bn: {
      appTitle: 'বালের হিসাব',
      addRow: 'সারি যোগ করুন',
      save: 'সংরক্ষণ',
      download: 'ডাউনলোড (.txt)',
      reminderTitle: 'দৈনিক রিমাইন্ডার',
      reminderLabel: 'দৈনিক রিমাইন্ডারের জন্য সময় নির্বাচন করুন',
      reminderSetFor: 'রিমাইন্ডার সেট করা হয়েছে',
      reminderMessage: 'কোন রিমাইন্ডার সেট নেই',
      reminderNote: 'বিজ্ঞপ্তির জন্য ব্রাউজার অনুমতি প্রয়োজন',
      cancel: 'বাতিল',
      close: 'বন্ধ করুন',
      deleteReminder: 'রিমাইন্ডার মুছুন',
      setReminder: 'রিমাইন্ডার সেট করুন',
      monthNote: 'মাসিক নোট',
      monthNotePlaceholder: 'কিছু লেখ বোকা-টোশা',
      tableHeaders: {
        date: 'তারিখ',
        inTime: 'ইন টাইম',
        outTime: 'আউট টাইম',
        otTime: 'ওটি টাইম',
        notes: 'নোট',
        action: 'কাজ'
      },
      total: 'মোট',
      notePlaceholder: 'নোট...',
      splashBtn: 'চালিয়ে যেতে যেকোনো জায়গায় ট্যাপ করুন',
      savedToast: '✅ সফলভাবে সংরক্ষিত',
      chooseTime: 'একটি সময় নির্বাচন করুন',
      permissionRequired: 'বিজ্ঞপ্তি অনুমতি প্রয়োজন',
      reminderSaved: 'রিমাইন্ডার সংরক্ষিত',
      reminderDeleted: 'রিমাইন্ডার মুছে ফেলা হয়েছে',
      fileSaved: 'ফাইল সফলভাবে সংরক্ষিত।',
      downloadPrompt: 'এর শেষে পৌঁছেছে। এই মাসের ফাইল ডাউনলোড করবেন?'
    },
    en: {
      appTitle: 'Baler Hisab',
      addRow: 'Add Row',
      save: 'Save',
      download: 'Download (.txt)',
      reminderTitle: 'Daily Reminder',
      reminderLabel: 'Choose time for daily reminder',
      reminderSetFor: 'Reminder set for',
      reminderMessage: 'No reminder set',
      reminderNote: 'Notifications require browser permission',
      cancel: 'Cancel',
      close: 'Close',
      deleteReminder: 'Delete Reminder',
      setReminder: 'Set Reminder',
      monthNote: 'Month Note',
      monthNotePlaceholder: 'Add a month-level note...',
      tableHeaders: {
        date: 'Date',
        inTime: 'In Time',
        outTime: 'Out Time',
        otTime: 'OT Time',
        notes: 'Notes',
        action: 'Action'
      },
      total: 'Total',
      notePlaceholder: 'notes...',
      splashBtn: 'Tap anywhere to continue',
      savedToast: '✅ Saved successfully',
      chooseTime: 'Choose a time',
      permissionRequired: 'Notification permission required',
      reminderSaved: 'Reminder saved',
      reminderDeleted: 'Reminder deleted',
      fileSaved: 'File saved successfully.',
      downloadPrompt: 'End of month reached. Download this month\'s file?'
    }
  };

  const t = translations[lang];

  document.querySelector('.app-title').textContent = t.appTitle;
  document.querySelector('.splash-title').textContent = lang === 'bn' ? 'আজকের হিসাব কি তোর বাপ করব ?' : t.appTitle;
  addRowBtn.textContent = t.addRow;
  saveBtn.textContent = t.save;
  downloadBtn.textContent = t.download;
  document.getElementById('reminderTitle').textContent = t.reminderTitle;
  const reminderLabelElem = document.querySelector('.reminder-time-label');
  const reminderMessageElem = document.querySelector('.reminder-message');
  const reminderSetForElem = document.querySelector('.reminder-label');
  const reminderNoteElem = document.querySelector('.reminder-empty .muted');
  if (reminderLabelElem) reminderLabelElem.textContent = t.reminderLabel;
  if (reminderMessageElem) reminderMessageElem.textContent = t.reminderMessage;
  if (reminderSetForElem) reminderSetForElem.textContent = t.reminderSetFor;
  if (reminderNoteElem) reminderNoteElem.textContent = t.reminderNote;
  reminderCancel.textContent = t.cancel;
  reminderCloseBtn.textContent = t.close;
  reminderSave.textContent = t.setReminder;
  reminderDeleteBtn.textContent = t.deleteReminder;
  document.querySelector('label[for="monthNote"]').textContent = t.monthNote;
  monthNoteInput.placeholder = t.monthNotePlaceholder;

  const headers = document.querySelectorAll('.ledger thead th');
  const headerKeys = Object.values(t.tableHeaders);
  headers.forEach((th, idx) => {
    if (headerKeys[idx]) th.textContent = headerKeys[idx];
  });

  toast.textContent = t.savedToast;
  tapStart.textContent = t.splashBtn;

  window.langTexts = t;
  updateMonthLabel();
  renderTable();
}
langBtn.addEventListener('click', () => applyLang(appState.lang === 'bn' ? 'en' : 'bn'));

/* ------------------ reminders ------------------ */
function openReminderModal() {
  reminderModal.classList.remove('hidden');
  const saved = localStorage.getItem(REM_KEY);

  if (saved) {
    // Reminder exists - show the time and delete option
    try {
      const o = JSON.parse(saved);
      const time = o.time || '00:00';
      reminderTimeDisplay.textContent = time;
      reminderExists.classList.remove('hidden');
      reminderEmpty.classList.add('hidden');
    } catch (e) {
      // If parsing fails, show empty state
      showEmptyReminderState();
    }
  } else {
    // No reminder - show set reminder option
    showEmptyReminderState();
  }
}

function showEmptyReminderState() {
  const now = new Date();
  reminderTime.value = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  reminderExists.classList.add('hidden');
  reminderEmpty.classList.remove('hidden');
}

reminderBtn.addEventListener('click', openReminderModal);
reminderCancel.addEventListener('click', () => reminderModal.classList.add('hidden'));
reminderCloseBtn.addEventListener('click', () => reminderModal.classList.add('hidden'));

reminderSave.addEventListener('click', async (e) => {
  createRipple(e, reminderSave);
  const time = reminderTime.value;
  if (!time) {
    alert(window.langTexts?.chooseTime || 'Choose a time');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    alert(window.langTexts?.permissionRequired || 'Notification permission required');
    return;
  }
  const payload = { time };
  localStorage.setItem(REM_KEY, JSON.stringify(payload));
  scheduleReminder(time);
  reminderModal.classList.add('hidden');
  showSavedToast();
});

reminderDeleteBtn.addEventListener('click', (e) => {
  createRipple(e, reminderDeleteBtn);
  if (reminderTimeout) clearTimeout(reminderTimeout);
  reminderTimeout = null;
  localStorage.removeItem(REM_KEY);
  reminderTime.value = '';
  reminderModal.classList.add('hidden');
  showSavedToast();
});

let reminderTimeout = null;
function scheduleReminder(timeString) {
  if (reminderTimeout) clearTimeout(reminderTimeout);

  const [hh, mm] = timeString.split(':').map(n => Number(n));
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);

  if (target <= now) target = addDays(target, 1);

  const ms = target - now;

  reminderTimeout = setTimeout(() => {
    showLocalNotification('আজকের হিসাব পূরণ করো!', 'Time to fill your daily record!');
    scheduleReminder(timeString);
  }, ms);

  console.log(`Reminder scheduled for ${target.toLocaleString()}`);
}

async function showLocalNotification(bnText, enText) { const title = appState.lang === 'bn' ? bnText : enText; const options = { body: title, tag: 'ajker-hisab-reminder', renotify: true, data: { url: location.href } }; if ('serviceWorker' in navigator && navigator.serviceWorker.ready) { const reg = await navigator.serviceWorker.ready; reg.showNotification(title, options); } else { new Notification(title, options); } }

function loadReminderOnStart() { const s = localStorage.getItem(REM_KEY); if (s) { try { const o = JSON.parse(s); scheduleReminder(o.time); } catch (e) { } } }

/* ------------------ startup & SW ------------------ */
function startApp() {
  splash.classList.add('hidden');
  appDiv.classList.remove('hidden');
  loadState();
  registerServiceWorker();
  loadReminderOnStart();
}

splash.addEventListener('click', (e) => {
  if (e.target === splash || e.target.closest('.splash-card')) {
    startApp();
  }
});

tapStart.addEventListener('click', (e) => {
  e.stopPropagation();
  startApp();
});

window.addEventListener('load', () => createDynamicManifest());

async function registerServiceWorker() { if ('serviceWorker' in navigator) { try { const reg = await navigator.serviceWorker.register('sw.js', { scope: './' }); console.log('sw registered', reg); } catch (e) { console.warn('sw register failed', e); } } }

function createDynamicManifest() { const manifest = { name: 'আজকের হিসাব', short_name: 'হিসাব', start_url: '.', display: 'standalone', background_color: '#0b1020', theme_color: '#0b1020', icons: [{ src: 'logo.png', sizes: '192x192', type: 'image/png' }] }; const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }); const url = URL.createObjectURL(blob); const link = document.querySelector('link[rel="manifest"]') || document.createElement('link'); link.rel = 'manifest'; link.href = url; document.head.appendChild(link); }

function warmCache() { if ('serviceWorker' in navigator) { try { navigator.serviceWorker.ready.then(reg => reg.active?.postMessage({ type: 'warm-cache' })); } catch (e) { } } }
warmCache();

monthNoteInput.addEventListener('input', () => { appState.note = monthNoteInput.value; saveState(false); });

/* expose export for debugging */
window._exportText = () => exportMonthAsTxt(appState.month);

// load state if user skips splash (dev)
if (splash.classList.contains('hidden')) { loadState(); registerServiceWorker(); loadReminderOnStart(); }

/* ------------------ particles ------------------ */
function createParticles() {
  const container = $('#particles');
  const particleCount = 50;
  const types = ['particle', 'particle particle-star', 'particle particle-glow', 'particle particle-square'];

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    const typeIndex = Math.floor(Math.random() * types.length);
    particle.className = types[typeIndex];

    const size = Math.random() * 4 + 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;

    particle.style.left = `${Math.random() * 100}%`;
    particle.style.animationDuration = `${Math.random() * 20 + 15}s`;
    particle.style.animationDelay = `${Math.random() * 8}s`;
    particle.style.setProperty('--drift', `${(Math.random() - 0.5) * 150}px`);

    container.appendChild(particle);
  }
}

function createConfetti(x, y) {
  const colors = ['var(--accent1)', 'var(--accent2)', '#ffb86b', '#ff6b6b', '#a78bfa', '#fbbf24'];
  const confettiCount = 30;

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.left = `${x}px`;
    confetti.style.top = `${y}px`;
    confetti.style.width = `${Math.random() * 8 + 4}px`;
    confetti.style.height = `${Math.random() * 8 + 4}px`;
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    confetti.style.zIndex = '999';
    confetti.style.pointerEvents = 'none';
    confetti.style.opacity = '1';

    const angle = (Math.random() * 360) * (Math.PI / 180);
    const velocity = Math.random() * 300 + 200;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity - 200;

    document.body.appendChild(confetti);

    let posX = x, posY = y, velocityY = vy, velocityX = vx;
    const gravity = 1200;
    const startTime = Date.now();

    function animateConfetti() {
      const elapsed = (Date.now() - startTime) / 1000;
      velocityY += gravity * 0.016;
      posX += velocityX * 0.016;
      posY += velocityY * 0.016;

      confetti.style.transform = `translate(${posX - x}px, ${posY - y}px) rotate(${elapsed * 720}deg)`;
      confetti.style.opacity = Math.max(0, 1 - elapsed / 2);

      if (elapsed < 2 && posY < window.innerHeight + 100) {
        requestAnimationFrame(animateConfetti);
      } else {
        confetti.remove();
      }
    }

    requestAnimationFrame(animateConfetti);
  }
}

function createRipple(event, element) {
  const ripple = document.createElement('span');
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.className = 'ripple';

  element.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
}

window.addEventListener('load', createParticles);