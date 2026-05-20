import { listenSlots, submitAppointment, getMyAppointment, googleLogin, googleLogout, onAuthChange, isAdmin } from "./firebase-db.js";

const DEPT_LIST = ["總管理處","天眼公司","統合處","科管處","空資處"];
const SLOTS_DATA = {
  "2026-07-18": [{ time: "07:30", limit: 2 }, { time: "07:45", limit: 4 }, { time: "08:00", limit: 9 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-07-19": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-07-25": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-07-26": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-08-01": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-08-02": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-08-08": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-08-09": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-08-15": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-08-16": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-08-22": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-08-23": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-08-29": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-08-30": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-09-05": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 2 }, { time: "09:30", limit: 5 }],
  "2026-09-06": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-09-12": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 6 }, { time: "09:30", limit: 4 }],
  "2026-09-13": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-09-19": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-09-20": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-09-26": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
  "2026-09-27": [{ time: "07:45", limit: 5 }, { time: "08:00", limit: 10 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }],
};
const WEEKDAY_ZH = ["日","一","二","三","四","五","六"];
const STEPS = ["登入","選擇日期","選擇時段","填寫資料","預約完成"];

let state = {
  step: 0, user: null, myAppt: null,
  selectedDate: null, selectedTime: null,
  booked: {}, dept: "", empName: "", dependents: [],
  errors: {}, confirmed: null, submitting: false,
};

function formatDate(dateStr) {
  const [y,m,d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  return { m, dy: d, wd: WEEKDAY_ZH[dt.getDay()], full: `${m}/${d} (${WEEKDAY_ZH[dt.getDay()]})` };
}
function getLimit(date, time) { return SLOTS_DATA[date]?.find(s => s.time === time)?.limit ?? 0; }
function getBooked(date, time) { return state.booked[date]?.[time] ?? 0; }
function getRemaining(date, time) { return getLimit(date, time) - getBooked(date, time); }
function totalPeople() { return 1 + state.dependents.length; }
function el(id) { return document.getElementById(id); }
function setLoading(show) { el("loadingOverlay").classList.toggle("show", show); }

function renderStepbar() {
  const steps = state.user ? STEPS : ["登入"];
  el("stepbar").innerHTML = STEPS.map((label, i) => {
    const isDone = i < state.step, isActive = i === state.step;
    return `<div class="step-item">
      <div class="step-row">
        ${i > 0 ? `<div class="step-line ${i <= state.step ? "done" : ""}"></div>` : ""}
        <div class="step-circle ${isDone ? "done" : isActive ? "active" : ""}">${isDone ? "✓" : i+1}</div>
        ${i < STEPS.length-1 ? `<div class="step-line ${i < state.step ? "done" : ""}"></div>` : ""}
      </div>
      <div class="step-label ${isActive ? "active" : ""}">${label}</div>
    </div>`;
  }).join("");
}

// ── Step 0: 登入 ──
function renderStep0() {
  el("main").innerHTML = `
    <div style="text-align:center;padding:40px 0">
      <div style="font-size:48px;margin-bottom:16px">🏥</div>
      <div style="font-size:20px;font-weight:900;color:#0f2942;margin-bottom:8px">歡迎使用健檢預約系統</div>
      <div style="font-size:14px;color:#64748b;margin-bottom:32px">請使用公司 Gmail 帳號登入後進行預約</div>
      <button onclick="handleLogin()" style="
        border:none;background:linear-gradient(135deg,#0f2942,#0d5c8a);
        color:#fff;border-radius:14px;padding:16px 40px;
        font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;
        box-shadow:0 6px 20px rgba(13,92,138,.35);
        display:inline-flex;align-items:center;gap:12px">
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#fff" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>
        使用 Google 帳號登入
      </button>
      <div style="margin-top:20px;font-size:12px;color:#94a3b8">僅限公司 Gmail 帳號</div>
    </div>`;
}

// ── 已預約畫面 ──
function renderAlreadyBooked() {
  const a = state.myAppt;
  const { full } = formatDate(a.date);
  el("main").innerHTML = `
    <div style="text-align:center">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <div style="font-size:20px;font-weight:900;color:#0f2942;margin-bottom:6px">您已完成預約</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:24px">如需更改請聯絡福委</div>
      <div style="background:#fff;border-radius:20px;padding:24px;box-shadow:0 3px 16px rgba(0,0,0,.07);text-align:left;margin-bottom:20px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div style="background:#f0f9ff;border-radius:12px;padding:14px">
            <div style="font-size:11px;color:#64748b;margin-bottom:4px">健檢日期</div>
            <div style="font-size:16px;font-weight:900">${full}</div>
          </div>
          <div style="background:#f0f9ff;border-radius:12px;padding:14px">
            <div style="font-size:11px;color:#64748b;margin-bottom:4px">報到時段</div>
            <div style="font-size:26px;font-weight:900;color:#0d5c8a">${a.time}</div>
          </div>
        </div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:10px;font-weight:700">預約名單</div>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#eff6ff;border-radius:10px;margin-bottom:8px">
          <span style="background:#dbeafe;color:#1d4ed8;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700">員工</span>
          <span style="font-size:15px;font-weight:800">${a.empName}</span>
          <span style="font-size:12px;color:#64748b;margin-left:auto">${a.dept}</span>
        </div>
        ${(a.dependents||[]).map((dep,i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f0fdf4;border-radius:10px;margin-bottom:8px">
            <span style="background:#dcfce7;color:#15803d;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700">眷屬 ${i+1}</span>
            <span style="font-size:15px;font-weight:800">${dep}</span>
          </div>`).join("")}
        <div style="margin-top:12px;padding:12px 16px;background:#f8fafc;border-radius:10px;display:flex;justify-content:space-between">
          <span style="color:#64748b;font-size:13px;font-weight:600">合計人數</span>
          <span style="font-weight:900;color:#0d5c8a;font-size:18px">${a.totalPeople} 位</span>
        </div>
      </div>
      <div style="font-size:13px;color:#64748b">登入帳號：${state.user.email}</div>
      <button onclick="handleLogout()" style="margin-top:16px;border:1.5px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 20px;font-size:13px;cursor:pointer;font-family:inherit;color:#475569">登出</button>
    </div>`;
}

// ── Step 1: 選日期 ──
function renderStep1() {
  const months = {};
  Object.keys(SLOTS_DATA).sort().forEach(date => {
    const { m } = formatDate(date);
    if (!months[m]) months[m] = [];
    months[m].push(date);
  });
  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div>
        <div style="font-size:18px;font-weight:900;color:#0f2942">選擇健檢日期</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">登入帳號：${state.user.email}</div>
      </div>
      <button onclick="handleLogout()" style="border:1.5px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit;color:#475569">登出</button>
    </div>`;
  for (const [month, dates] of Object.entries(months)) {
    html += `<div class="month-block">
      <div class="month-header"><div class="month-badge">${month}</div><div class="month-label">${month} 月</div></div>
      <div class="date-grid">`;
    for (const date of dates.sort()) {
      const { full } = formatDate(date);
      const totalLimit  = SLOTS_DATA[date].reduce((a,s) => a+s.limit, 0);
      const totalBooked = SLOTS_DATA[date].reduce((a,s) => a+getBooked(date,s.time), 0);
      const remaining   = totalLimit - totalBooked;
      const isFull      = remaining === 0;
      const pct         = Math.min((totalBooked/totalLimit)*100, 100);
      html += `<button class="date-card ${isFull?"full":""}" ${isFull?"disabled":`onclick="selectDate('${date}')"`}>
        <div class="date-name">${full}</div>
        <div class="date-remain ${isFull?"full":remaining<=5?"low":""}">${isFull?"已額滿":`剩 ${remaining} 位`}</div>
        <div class="progress-bar"><div class="progress-fill ${isFull?"full":remaining<=5?"low":""}" style="width:${pct}%"></div></div>
        <div class="date-count">${totalBooked}/${totalLimit}</div>
      </button>`;
    }
    html += `</div></div>`;
  }
  el("main").innerHTML = html;
}

// ── Step 2: 選時段 ──
function renderStep2() {
  const { full } = formatDate(state.selectedDate);
  let html = `<div class="page-header">
    <button class="btn-back" onclick="goBack(2)">← 返回</button>
    <div><div class="page-header-text">${full}</div><div class="page-header-subtext">請選擇時段（名額含員工及眷屬）</div></div>
  </div><div class="slot-grid">`;
  for (const slot of SLOTS_DATA[state.selectedDate]) {
    const cnt = getBooked(state.selectedDate, slot.time);
    const rem = slot.limit - cnt;
    const isFull = rem <= 0;
    const pct = Math.min((cnt/slot.limit)*100, 100);
    html += `<button class="slot-card ${isFull?"full":""}" ${isFull?"disabled":`onclick="selectTime('${slot.time}')"`}>
      <div class="slot-time ${isFull?"full":""}">${slot.time}</div>
      <div class="slot-meta">
        <span class="slot-remain ${isFull?"full":rem<=3?"low":""}">${isFull?"已額滿":`剩 ${rem} 位`}</span>
        ${!isFull?`<span class="slot-arrow">選擇 →</span>`:""}
      </div>
      <div class="progress-bar" style="margin-top:8px"><div class="progress-fill ${isFull?"full":rem<=3?"low":""}" style="width:${pct}%"></div></div>
      <div class="slot-count">${cnt}/${slot.limit} 已預約</div>
    </button>`;
  }
  html += `</div>`;
  el("main").innerHTML = html;
}

// ── Step 3: 填寫資料 ──
function renderStep3() {
  const { full } = formatDate(state.selectedDate);
  const remaining = getRemaining(state.selectedDate, state.selectedTime);
  const total = totalPeople();
  const isOver = total > remaining;
  const deptOptions = DEPT_LIST.map(d => `<option value="${d}" ${state.dept===d?"selected":""}>${d}</option>`).join("");
  let depRows = state.dependents.length === 0
    ? `<div class="dep-empty">無眷屬同行 — 可點選「新增眷屬」加入</div>`
    : state.dependents.map((name,idx) => `
      <div class="dep-row">
        <div class="dep-badge">眷${idx+1}</div>
        <div style="flex:1">
          <input class="form-control ${state.errors[`dep_${idx}`]?"error":""}" type="text"
            placeholder="眷屬 ${idx+1} 姓名" value="${name}" oninput="updateDependent(${idx},this.value)"/>
          ${state.errors[`dep_${idx}`]?`<div class="form-error">${state.errors[`dep_${idx}`]}</div>`:""}
        </div>
        <button class="btn-remove" onclick="removeDependent(${idx})">✕</button>
      </div>`).join("");

  el("main").innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="goBack(3)">← 返回</button>
      <div class="page-header-text">填寫預約資料</div>
    </div>
    <div class="summary-bar">
      <div class="summary-item"><div class="summary-sub">日期</div><div class="summary-val">${full}</div></div>
      <div class="summary-divider"></div>
      <div class="summary-item"><div class="summary-sub">時段</div><div class="summary-val big">${state.selectedTime}</div></div>
      <div class="summary-divider"></div>
      <div class="summary-item"><div class="summary-sub">剩餘名額</div><div class="summary-val ${remaining<=3?"red":"green"}">${remaining} 位</div></div>
    </div>
    ${state.errors.quota?`<div class="error-banner">⚠️ ${state.errors.quota}</div>`:""}
    <div class="form-card">
      <div class="form-group">
        <label class="form-label">單位／部門 <span class="form-required">*</span></label>
        <select class="form-control ${state.errors.dept?"error":""}" onchange="updateField('dept',this.value)">
          <option value="">— 請選擇單位 —</option>${deptOptions}
        </select>
        ${state.errors.dept?`<div class="form-error">${state.errors.dept}</div>`:""}
      </div>
      <div class="form-group">
        <label class="form-label">員工姓名 <span class="form-required">*</span></label>
        <input class="form-control ${state.errors.empName?"error":""}" type="text"
          placeholder="請輸入員工姓名" value="${state.empName}" oninput="updateField('empName',this.value)"/>
        ${state.errors.empName?`<div class="form-error">${state.errors.empName}</div>`:""}
      </div>
      <div class="form-divider">
        <div class="dep-header">
          <div><div class="dep-header-text">眷屬名單</div><div class="dep-header-sub">每位眷屬各占 1 個名額，不限人數</div></div>
          <button class="btn-add" onclick="addDependent()">＋ 新增眷屬</button>
        </div>
        <div id="depList">${depRows}</div>
        <div class="quota-summary ${isOver?"over":""}">
          <div class="quota-text">本次共需名額：員工 1 位${state.dependents.length>0?` ＋ 眷屬 ${state.dependents.length} 位`:""}</div>
          <div class="quota-count ${isOver?"over":""}">${total} 位</div>
        </div>
      </div>
      <button class="btn-submit ${state.submitting?"loading":""}" onclick="handleSubmit()" ${state.submitting?"disabled":""}>
        ${state.submitting?"送出中…":"確認預約"}
      </button>
    </div>`;
}

// ── Step 4: 完成 ──
function renderStep4() {
  const { full } = formatDate(state.confirmed.date);
  el("main").innerHTML = `
    <div class="success-wrap">
      <div class="success-icon">✓</div>
      <div class="success-title">預約成功！</div>
      <div class="success-sub">以下是您的預約資訊，請準時報到</div>
      <div class="result-card">
        <div class="result-grid">
          <div class="result-item"><div class="result-item-sub">健檢日期</div><div class="result-item-val">${full}</div></div>
          <div class="result-item"><div class="result-item-sub">報到時段</div><div class="result-item-val big">${state.confirmed.time}</div></div>
        </div>
        <div class="result-list-title">預約名單</div>
        <div class="result-person emp">
          <span class="tag tag-emp">員工</span>
          <span class="result-person-name">${state.confirmed.empName}</span>
          <span class="result-person-dept">${state.confirmed.dept}</span>
        </div>
        ${state.confirmed.dependents.map((dep,i) => `
          <div class="result-person dep">
            <span class="tag tag-dep">眷屬 ${i+1}</span>
            <span class="result-person-name">${dep}</span>
          </div>`).join("")}
        <div class="result-total">
          <span class="result-total-label">合計佔用名額</span>
          <span class="result-total-val">${1+state.confirmed.dependents.length} 位</span>
        </div>
      </div>
      <div class="notice-box">
        <div class="notice-title">📋 注意事項</div>
        <div class="notice-body">
          · 請於預約時段前 10 分鐘抵達現場報到<br>
          · 健檢前一晚 10 點後請禁食禁水<br>
          · 眷屬請攜帶與員工關係之相關證明文件<br>
          · 如需取消或更改，請聯絡福委
        </div>
      </div>
    </div>`;
}

function render() {
  renderStepbar();
  if (state.step === 0) renderStep0();
  else if (state.myAppt && state.step === 1) renderAlreadyBooked();
  else if (state.step === 1) renderStep1();
  else if (state.step === 2) renderStep2();
  else if (state.step === 3) renderStep3();
  else if (state.step === 4) renderStep4();
}

// ── 事件 ──
window.handleLogin = async () => {
  try {
    const user = await googleLogin();
    state.user = user;
    setLoading(true);
    state.myAppt = await getMyAppointment(user.email);
    setLoading(false);
    state.step = 1;
    render();
  } catch(e) {
    setLoading(false);
    alert("登入失敗：" + e.message);
  }
};

window.handleLogout = async () => {
  await googleLogout();
  state = { ...state, user: null, myAppt: null, step: 0, selectedDate: null, selectedTime: null, dept: "", empName: "", dependents: [], errors: {}, confirmed: null };
  render();
};

window.selectDate = (date) => { state.selectedDate = date; state.step = 2; render(); };
window.selectTime = (time) => { state.selectedTime = time; state.step = 3; render(); };
window.goBack = (fromStep) => { state.step = fromStep - 1; state.errors = {}; render(); };
window.updateField = (field, value) => {
  state[field] = value;
  state.errors[field] = undefined;
  // 只更新名額小計，不重繪整個表單
  const total = totalPeople();
  const rem = getRemaining(state.selectedDate, state.selectedTime);
  const isOver = total > rem;
  const qs = document.querySelector('.quota-summary');
  if (qs) {
    qs.className = 'quota-summary ' + (isOver ? 'over' : '');
    qs.querySelector('.quota-count').className = 'quota-count ' + (isOver ? 'over' : '');
    qs.querySelector('.quota-count').textContent = total + ' 位';
  }
};
window.addDependent = () => { state.dependents.push(""); renderStep3(); };
window.updateDependent = (idx, val) => { state.dependents[idx] = val; state.errors[`dep_${idx}`] = undefined; };
window.removeDependent = (idx) => {
  state.dependents.splice(idx, 1);
  const errs = {};
  Object.entries(state.errors).forEach(([k,v]) => {
    if (!k.startsWith("dep_")) { errs[k]=v; return; }
    const i = parseInt(k.split("_")[1]);
    if (i < idx) errs[k]=v;
    else if (i > idx) errs[`dep_${i-1}`]=v;
  });
  state.errors = errs;
  renderStep3();
};

window.handleSubmit = async () => {
  const errors = {};
  if (!state.dept) errors.dept = "請選擇單位";
  if (!state.empName.trim()) errors.empName = "請填寫員工姓名";
  state.dependents.forEach((d,i) => { if (!d.trim()) errors[`dep_${i}`] = "請填寫眷屬姓名"; });
  const rem = getRemaining(state.selectedDate, state.selectedTime);
  if (totalPeople() > rem) errors.quota = `此時段剩餘 ${rem} 個名額，您共需 ${totalPeople()} 個`;
  if (Object.keys(errors).length) { state.errors = errors; renderStep3(); return; }

  state.submitting = true;
  setLoading(true);
  const result = await submitAppointment({
    date: state.selectedDate, time: state.selectedTime,
    dept: state.dept, empName: state.empName,
    dependents: [...state.dependents], email: state.user.email,
  });
  state.submitting = false;
  setLoading(false);

  if (result.ok) {
    state.confirmed = { date: state.selectedDate, time: state.selectedTime, dept: state.dept, empName: state.empName, dependents: [...state.dependents] };
    state.step = 4;
    render();
  } else {
    state.errors = { quota: result.message };
    renderStep3();
  }
};

// ── 監聽名額 ──
listenSlots((bookedMap) => {
  state.booked = bookedMap;
  if (state.step === 1) renderStep1();
  else if (state.step === 2) renderStep2();
});

// ── 初始渲染 ──
render();
