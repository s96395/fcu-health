// =============================================
// app.js — 逢甲健檢預約系統主邏輯
// =============================================

import { listenSlots, submitAppointment } from "./firebase-db.js";

// ── 常數 ──────────────────────────────────────

const DEPT_LIST = [
  "總管理處",
  "天眼公司",
  "統合處",
  "科管處",
  "空資處",
];

const SLOTS_DATA = {
  "2025-07-18": [
    { time: "07:30", limit: 2 }, { time: "07:45", limit: 4 },
    { time: "08:00", limit: 9 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-07-19": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-07-25": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-07-26": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-08-01": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-08-02": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-08-08": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-08-09": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-08-15": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-08-16": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-08-22": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-08-23": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-08-29": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-08-30": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-09-05": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 2 }, { time: "09:30", limit: 5 },
  ],
  "2025-09-06": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-09-12": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 6 }, { time: "09:30", limit: 4 },
  ],
  "2025-09-13": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-09-19": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-09-20": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-09-26": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
  "2025-09-27": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 },
  ],
};

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const STEPS = ["選擇日期", "選擇時段", "填寫資料", "預約完成"];

// ── 狀態 ──────────────────────────────────────
let state = {
  step:         0,
  selectedDate: null,
  selectedTime: null,
  booked:       {},   // 即時從 Firestore 同步
  dept:         "",
  empName:      "",
  dependents:   [],   // string[]
  errors:       {},
  confirmed:    null,
  submitting:   false,
};

// ── 工具函式 ──────────────────────────────────

function formatDate(dateStr) {
  const d  = new Date(dateStr + "T00:00:00");
  const m  = d.getMonth() + 1;
  const dy = d.getDate();
  const wd = WEEKDAY_ZH[d.getDay()];
  return { m, dy, wd, full: `${m}/${dy} (${wd})` };
}

function getLimit(date, time) {
  return SLOTS_DATA[date]?.find(s => s.time === time)?.limit ?? 0;
}

function getBooked(date, time) {
  return state.booked[date]?.[time] ?? 0;
}

function getRemaining(date, time) {
  return getLimit(date, time) - getBooked(date, time);
}

function totalPeople() {
  return 1 + state.dependents.length;
}

function el(id) { return document.getElementById(id); }

function setLoading(show) {
  el("loadingOverlay").classList.toggle("show", show);
}

// ── 渲染 Step Bar ──────────────────────────────

function renderStepbar() {
  const bar = el("stepbar");
  bar.innerHTML = STEPS.map((label, i) => {
    const isDone   = i < state.step;
    const isActive = i === state.step;
    const circleClass = isDone ? "done" : isActive ? "active" : "";
    const lineClass   = i <= state.step ? "done" : "";
    const labelClass  = isActive ? "active" : "";
    return `
      <div class="step-item">
        <div class="step-row">
          ${i > 0 ? `<div class="step-line ${lineClass}"></div>` : ""}
          <div class="step-circle ${circleClass}">${isDone ? "✓" : i + 1}</div>
          ${i < STEPS.length - 1 ? `<div class="step-line ${i < state.step ? "done" : ""}"></div>` : ""}
        </div>
        <div class="step-label ${labelClass}">${label}</div>
      </div>`;
  }).join("");
}

// ── Step 0：選日期 ────────────────────────────

function renderStep0() {
  // 依月份分組
  const months = {};
  Object.keys(SLOTS_DATA).sort().forEach(date => {
    const { m } = formatDate(date);
    if (!months[m]) months[m] = [];
    months[m].push(date);
  });

  let html = `
    <div class="section-title">選擇健檢日期</div>
    <div class="section-subtitle">點選日期後再選時段，名額已含眷屬人數</div>`;

  for (const [month, dates] of Object.entries(months)) {
    html += `
      <div class="month-block">
        <div class="month-header">
          <div class="month-badge">${month}</div>
          <div class="month-label">${month} 月</div>
        </div>
        <div class="date-grid">`;

    for (const date of dates.sort()) {
      const { full } = formatDate(date);
      const totalLimit  = SLOTS_DATA[date].reduce((a, s) => a + s.limit, 0);
      const totalBooked = SLOTS_DATA[date].reduce((a, s) => a + getBooked(date, s.time), 0);
      const remaining   = totalLimit - totalBooked;
      const isFull      = remaining === 0;
      const pct         = Math.min((totalBooked / totalLimit) * 100, 100);
      const fillClass   = isFull ? "full" : remaining <= 5 ? "low" : "";
      const remainText  = isFull ? "已額滿" : `剩 ${remaining} 位`;
      const remainClass = isFull ? "full" : remaining <= 5 ? "low" : "";

      html += `
        <button class="date-card ${isFull ? "full" : ""}"
          ${isFull ? "disabled" : `onclick="selectDate('${date}')"`}>
          <div class="date-name">${full}</div>
          <div class="date-remain ${remainClass}">${remainText}</div>
          <div class="progress-bar">
            <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
          </div>
          <div class="date-count">${totalBooked}/${totalLimit}</div>
        </button>`;
    }

    html += `</div></div>`;
  }

  el("main").innerHTML = html;
}

// ── Step 1：選時段 ────────────────────────────

function renderStep1() {
  const { full } = formatDate(state.selectedDate);
  const slots = SLOTS_DATA[state.selectedDate];

  let html = `
    <div class="page-header">
      <button class="btn-back" onclick="goBack(1)">← 返回</button>
      <div>
        <div class="page-header-text">${full}</div>
        <div class="page-header-subtext">請選擇時段（名額含員工本人及眷屬）</div>
      </div>
    </div>
    <div class="slot-grid">`;

  for (const slot of slots) {
    const cnt       = getBooked(state.selectedDate, slot.time);
    const remaining = slot.limit - cnt;
    const isFull    = remaining <= 0;
    const pct       = Math.min((cnt / slot.limit) * 100, 100);
    const timeClass = isFull ? "full" : "";
    const remClass  = isFull ? "full" : remaining <= 3 ? "low" : "";
    const fillClass = isFull ? "full" : remaining <= 3 ? "low" : "";

    html += `
      <button class="slot-card ${isFull ? "full" : ""}"
        ${isFull ? "disabled" : `onclick="selectTime('${slot.time}')"`}>
        <div class="slot-time ${timeClass}">${slot.time}</div>
        <div class="slot-meta">
          <span class="slot-remain ${remClass}">
            ${isFull ? "已額滿" : `剩 ${remaining} 位`}
          </span>
          ${!isFull ? `<span class="slot-arrow">選擇 →</span>` : ""}
        </div>
        <div class="progress-bar" style="margin-top:8px">
          <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        <div class="slot-count">${cnt}/${slot.limit} 已預約</div>
      </button>`;
  }

  html += `</div>`;
  el("main").innerHTML = html;
}

// ── Step 2：填寫資料 ──────────────────────────

function renderStep2() {
  const { full }  = formatDate(state.selectedDate);
  const remaining = getRemaining(state.selectedDate, state.selectedTime);
  const total     = totalPeople();
  const isOver    = total > remaining;

  // 名額顏色
  const remClass = remaining <= 3 ? "red" : "green";

  // 錯誤提示
  const quotaErr = state.errors.quota
    ? `<div class="error-banner">⚠️ ${state.errors.quota}</div>` : "";

  // 眷屬列表
  let depRows = "";
  if (state.dependents.length === 0) {
    depRows = `<div class="dep-empty">無眷屬同行 — 可點選「新增眷屬」加入</div>`;
  } else {
    state.dependents.forEach((name, idx) => {
      const errMsg = state.errors[`dep_${idx}`]
        ? `<div class="form-error">${state.errors[`dep_${idx}`]}</div>` : "";
      depRows += `
        <div class="dep-row">
          <div class="dep-badge">眷${idx + 1}</div>
          <div style="flex:1">
            <input class="form-control ${state.errors[`dep_${idx}`] ? "error" : ""}"
              type="text" placeholder="眷屬 ${idx + 1} 姓名"
              value="${name}"
              oninput="updateDependent(${idx}, this.value)" />
            ${errMsg}
          </div>
          <button class="btn-remove" onclick="removeDependent(${idx})">✕</button>
        </div>`;
    });
  }

  // 單位選項
  const deptOptions = DEPT_LIST.map(d =>
    `<option value="${d}" ${state.dept === d ? "selected" : ""}>${d}</option>`
  ).join("");

  el("main").innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="goBack(2)">← 返回</button>
      <div class="page-header-text">填寫預約資料</div>
    </div>

    <!-- 摘要 -->
    <div class="summary-bar">
      <div class="summary-item">
        <div class="summary-sub">日期</div>
        <div class="summary-val">${full}</div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <div class="summary-sub">時段</div>
        <div class="summary-val big">${state.selectedTime}</div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <div class="summary-sub">剩餘名額</div>
        <div class="summary-val ${remClass}">${remaining} 位</div>
      </div>
    </div>

    ${quotaErr}

    <div class="form-card">

      <!-- 單位 -->
      <div class="form-group">
        <label class="form-label">
          單位／部門 <span class="form-required">*</span>
        </label>
        <select class="form-control ${state.errors.dept ? "error" : ""}"
          onchange="updateField('dept', this.value)">
          <option value="">— 請選擇單位 —</option>
          ${deptOptions}
        </select>
        ${state.errors.dept ? `<div class="form-error">${state.errors.dept}</div>` : ""}
      </div>

      <!-- 員工姓名 -->
      <div class="form-group">
        <label class="form-label">
          員工姓名 <span class="form-required">*</span>
        </label>
        <input class="form-control ${state.errors.empName ? "error" : ""}"
          type="text" placeholder="請輸入員工姓名"
          value="${state.empName}"
          oninput="updateField('empName', this.value)" />
        ${state.errors.empName ? `<div class="form-error">${state.errors.empName}</div>` : ""}
      </div>

      <!-- 眷屬 -->
      <div class="form-divider">
        <div class="dep-header">
          <div>
            <div class="dep-header-text">眷屬名單</div>
            <div class="dep-header-sub">每位眷屬各占 1 個名額，不限人數</div>
          </div>
          <button class="btn-add" onclick="addDependent()">＋ 新增眷屬</button>
        </div>
        <div id="depList">${depRows}</div>

        <!-- 名額小計 -->
        <div class="quota-summary ${isOver ? "over" : ""}">
          <div class="quota-text">
            本次共需名額：員工 1 位${state.dependents.length > 0 ? ` ＋ 眷屬 ${state.dependents.length} 位` : ""}
          </div>
          <div class="quota-count ${isOver ? "over" : ""}">${total} 位</div>
        </div>
      </div>

      <button class="btn-submit ${state.submitting ? "loading" : ""}"
        onclick="handleSubmit()"
        ${state.submitting ? "disabled" : ""}>
        ${state.submitting ? "送出中…" : "確認預約"}
      </button>
    </div>`;
}

// ── Step 3：完成 ──────────────────────────────

function renderStep3() {
  const { full } = formatDate(state.confirmed.date);
  const depRows  = state.confirmed.dependents.map((name, i) => `
    <div class="result-person dep">
      <span class="tag tag-dep">眷屬 ${i + 1}</span>
      <span class="result-person-name">${name}</span>
    </div>`).join("");

  el("main").innerHTML = `
    <div class="success-wrap">
      <div class="success-icon">✓</div>
      <div class="success-title">預約成功！</div>
      <div class="success-sub">以下是您的預約資訊，請準時報到</div>

      <div class="result-card">
        <div class="result-grid">
          <div class="result-item">
            <div class="result-item-sub">健檢日期</div>
            <div class="result-item-val">${full}</div>
          </div>
          <div class="result-item">
            <div class="result-item-sub">報到時段</div>
            <div class="result-item-val big">${state.confirmed.time}</div>
          </div>
        </div>

        <div class="result-list-title">預約名單</div>
        <div class="result-person emp">
          <span class="tag tag-emp">員工</span>
          <span class="result-person-name">${state.confirmed.empName}</span>
          <span class="result-person-dept">${state.confirmed.dept}</span>
        </div>
        ${depRows}

        <div class="result-total">
          <span class="result-total-label">合計佔用名額</span>
          <span class="result-total-val">${1 + state.confirmed.dependents.length} 位</span>
        </div>
      </div>

      <div class="notice-box">
        <div class="notice-title">📋 注意事項</div>
        <div class="notice-body">
          · 請於預約時段前 10 分鐘抵達現場報到<br>
          · 健檢前一晚 10 點後請禁食禁水<br>
          · 眷屬請攜帶與員工關係之相關證明文件<br>
          · 如需取消或更改，請提前通知主辦單位
        </div>
      </div>

      <button class="btn-reset" onclick="resetAll()">再次預約</button>
    </div>`;
}

// ── 主渲染入口 ────────────────────────────────

function render() {
  renderStepbar();
  if (state.step === 0) renderStep0();
  else if (state.step === 1) renderStep1();
  else if (state.step === 2) renderStep2();
  else if (state.step === 3) renderStep3();
}

// ── 事件處理（掛到 window 供 HTML onclick 使用）─

window.selectDate = (date) => {
  state.selectedDate = date;
  state.selectedTime = null;
  state.step = 1;
  render();
};

window.selectTime = (time) => {
  const rem = getRemaining(state.selectedDate, time);
  if (rem <= 0) return;
  state.selectedTime = time;
  state.step = 2;
  render();
};

window.goBack = (fromStep) => {
  state.step = fromStep - 1;
  state.errors = {};
  render();
};

window.updateField = (field, value) => {
  state[field] = value;
  state.errors[field] = undefined;
  // 僅更新 quota 小計，不全部重繪
  renderStep2();
};

window.addDependent = () => {
  state.dependents.push("");
  renderStep2();
};

window.updateDependent = (idx, val) => {
  state.dependents[idx] = val;
  state.errors[`dep_${idx}`] = undefined;
};

window.removeDependent = (idx) => {
  state.dependents.splice(idx, 1);
  const errs = {};
  Object.entries(state.errors).forEach(([k, v]) => {
    if (!k.startsWith("dep_")) { errs[k] = v; return; }
    const i = parseInt(k.split("_")[1]);
    if (i < idx) errs[k] = v;
    else if (i > idx) errs[`dep_${i - 1}`] = v;
  });
  state.errors = errs;
  renderStep2();
};

window.handleSubmit = async () => {
  // 驗證
  const errors = {};
  if (!state.dept)         errors.dept    = "請選擇單位";
  if (!state.empName.trim()) errors.empName = "請填寫員工姓名";
  state.dependents.forEach((d, i) => {
    if (!d.trim()) errors[`dep_${i}`] = "請填寫眷屬姓名";
  });

  const rem = getRemaining(state.selectedDate, state.selectedTime);
  if (totalPeople() > rem) {
    errors.quota = `此時段剩餘 ${rem} 個名額，您共需 ${totalPeople()} 個（含眷屬 ${state.dependents.length} 位）`;
  }

  if (Object.keys(errors).length) {
    state.errors = errors;
    renderStep2();
    return;
  }

  // 送出
  state.submitting = true;
  setLoading(true);

  const result = await submitAppointment({
    date:       state.selectedDate,
    time:       state.selectedTime,
    dept:       state.dept,
    empName:    state.empName,
    dependents: [...state.dependents],
  });

  state.submitting = false;
  setLoading(false);

  if (result.ok) {
    state.confirmed = {
      date:       state.selectedDate,
      time:       state.selectedTime,
      dept:       state.dept,
      empName:    state.empName,
      dependents: [...state.dependents],
    };
    state.step = 3;
    render();
  } else {
    state.errors = { quota: result.message };
    renderStep2();
  }
};

window.resetAll = () => {
  state = {
    step: 0, selectedDate: null, selectedTime: null,
    booked: state.booked,   // 保留即時名額資料
    dept: "", empName: "", dependents: [],
    errors: {}, confirmed: null, submitting: false,
  };
  render();
};

// ── 啟動：監聽 Firestore 即時名額 ─────────────

listenSlots((bookedMap) => {
  state.booked = bookedMap;
  // 若在選日期或時段頁面，即時更新畫面
  if (state.step === 0) renderStep0();
  else if (state.step === 1) renderStep1();
  // step 2/3 不主動重繪（避免打斷填寫）
  // 但 handleSubmit 送出時仍會用最新 getRemaining() 判斷
});

// 初始渲染
render();
