import { app } from "./firebase-config.js";
import {
  getFirestore, doc, collection,
  onSnapshot, runTransaction, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const db   = getFirestore(app);
const auth = getAuth(app);

const DEPT_LIST = ["總管理處","天眼公司","統合處","科管處","空資處"];
const SLOTS_DATA = {
  "2026-07-18":[{time:"07:30",limit:2},{time:"07:45",limit:4},{time:"08:00",limit:9},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-07-19":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-07-25":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-07-26":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-01":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-02":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-08":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-09":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-15":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-16":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-22":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-23":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-29":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-30":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-05":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:2},{time:"09:30",limit:5}],
  "2026-09-06":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-12":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:6},{time:"09:30",limit:4}],
  "2026-09-13":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-19":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-20":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-26":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-27":[{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
};
const WD = ["日","一","二","三","四","五","六"];
const STEPS = ["選擇日期","選擇時段","填寫資料","預約完成"];

let state = {
  user: null, myAppt: null,
  step: 0,
  selectedDate: null, selectedTime: null,
  booked: {},
  dept: "", empName: "", dependents: [],
  errors: {}, confirmed: null, submitting: false,
};

function fmtDate(ds) {
  const [y,m,d] = ds.split("-").map(Number);
  const dt = new Date(y,m-1,d);
  return { m, d, wd: WD[dt.getDay()], full: `${m}/${d} (${WD[dt.getDay()]})` };
}
function getLimit(date,time){ return SLOTS_DATA[date]?.find(s=>s.time===time)?.limit??0; }
function getBooked(date,time){ return state.booked[date]?.[time]??0; }
function getRemaining(date,time){ return getLimit(date,time)-getBooked(date,time); }
function totalPeople(){ return 1+state.dependents.length; }
function el(id){ return document.getElementById(id); }
function setLoading(v){ el("loadingOverlay").classList.toggle("show",v); }

// ── 畫面切換 ──────────────────────────────────
function showLogin(){
  el("loginScreen").style.display="flex";
  el("appScreen").style.display="none";
}
function showApp(){
  el("loginScreen").style.display="none";
  el("appScreen").style.display="block";
}

// ── Google 登入 ───────────────────────────────
window.signInWithGoogle = async () => {
  try {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch(e) {
    setLoading(false);
    alert("登入失敗：" + e.message);
  }
};
window.doLogout = async () => {
  await signOut(auth);
};

// ── 查詢是否已預約 ────────────────────────────
async function getMyAppt(email) {
  const snap = await getDocs(collection(db,"appointments"));
  const found = snap.docs.find(d => d.data().email === email);
  return found ? { id: found.id, ...found.data() } : null;
}

// ── Step Bar ──────────────────────────────────
function renderStepbar() {
  el("stepbar").innerHTML = STEPS.map((label,i) => {
    const isDone = i < state.step, isActive = i === state.step;
    return `<div class="step-item">
      <div class="step-row">
        ${i>0?`<div class="step-line ${i<=state.step?"done":""}"></div>`:""}
        <div class="step-circle ${isDone?"done":isActive?"active":""}">${isDone?"✓":i+1}</div>
        ${i<STEPS.length-1?`<div class="step-line ${i<state.step?"done":""}"></div>`:""}
      </div>
      <div class="step-label ${isActive?"active":""}">${label}</div>
    </div>`;
  }).join("");
}

// ── 已預約畫面 ────────────────────────────────
function renderAlreadyBooked() {
  const a = state.myAppt;
  const { full } = fmtDate(a.date);
  el("main").innerHTML = `
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <div style="font-size:20px;font-weight:900;color:#0f2942;margin-bottom:6px">您已完成預約</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:24px">如需更改請聯絡福委</div>
      <div style="background:#fff;border-radius:20px;padding:24px;box-shadow:0 3px 16px rgba(0,0,0,.07);text-align:left;max-width:480px;margin:0 auto">
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
        ${(a.dependents||[]).map((dep,i)=>`
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f0fdf4;border-radius:10px;margin-bottom:8px">
            <span style="background:#dcfce7;color:#15803d;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700">眷屬 ${i+1}</span>
            <span style="font-size:15px;font-weight:800">${dep}</span>
          </div>`).join("")}
        <div style="margin-top:12px;padding:12px 16px;background:#f8fafc;border-radius:10px;display:flex;justify-content:space-between">
          <span style="color:#64748b;font-size:13px;font-weight:600">合計人數</span>
          <span style="font-weight:900;color:#0d5c8a;font-size:18px">${a.totalPeople} 位</span>
        </div>
      </div>
    </div>`;
}

// ── Step 0：選日期 ────────────────────────────
function renderStep0() {
  const months = {};
  Object.keys(SLOTS_DATA).sort().forEach(date => {
    const {m} = fmtDate(date);
    if (!months[m]) months[m]=[];
    months[m].push(date);
  });
  let html = `<div style="font-size:20px;font-weight:900;color:#0f2942;text-align:center;margin-bottom:6px">選擇健檢日期</div>
    <div style="font-size:13px;color:#64748b;text-align:center;margin-bottom:24px">點選日期後再選時段，名額含眷屬</div>`;
  for (const [month,dates] of Object.entries(months)) {
    html += `<div class="month-block">
      <div class="month-header"><div class="month-badge">${month}</div><div class="month-label">${month} 月</div></div>
      <div class="date-grid">`;
    for (const date of dates.sort()) {
      const {full} = fmtDate(date);
      const totalLimit  = SLOTS_DATA[date].reduce((a,s)=>a+s.limit,0);
      const totalBooked = SLOTS_DATA[date].reduce((a,s)=>a+getBooked(date,s.time),0);
      const remaining   = totalLimit-totalBooked;
      const isFull      = remaining===0;
      const pct         = Math.min((totalBooked/totalLimit)*100,100);
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

// ── Step 1：選時段 ────────────────────────────
function renderStep1() {
  const {full} = fmtDate(state.selectedDate);
  let html = `<div class="page-header">
    <button class="btn-back" onclick="goBack(1)">← 返回</button>
    <div><div class="page-header-text">${full}</div><div class="page-header-subtext">請選擇時段（名額含員工及眷屬）</div></div>
  </div><div class="slot-grid">`;
  for (const slot of SLOTS_DATA[state.selectedDate]) {
    const cnt=getBooked(state.selectedDate,slot.time);
    const rem=slot.limit-cnt;
    const isFull=rem<=0;
    const pct=Math.min((cnt/slot.limit)*100,100);
    html+=`<button class="slot-card ${isFull?"full":""}" ${isFull?"disabled":`onclick="selectTime('${slot.time}')"`}>
      <div class="slot-time ${isFull?"full":""}">${slot.time}</div>
      <div class="slot-meta">
        <span class="slot-remain ${isFull?"full":rem<=3?"low":""}">${isFull?"已額滿":`剩 ${rem} 位`}</span>
        ${!isFull?`<span class="slot-arrow">選擇 →</span>`:""}
      </div>
      <div class="progress-bar" style="margin-top:8px"><div class="progress-fill ${isFull?"full":rem<=3?"low":""}" style="width:${pct}%"></div></div>
      <div class="slot-count">${cnt}/${slot.limit} 已預約</div>
    </button>`;
  }
  html+=`</div>`;
  el("main").innerHTML=html;
}

// ── Step 2：填寫資料 ──────────────────────────
function renderStep2() {
  const {full}=fmtDate(state.selectedDate);
  const remaining=getRemaining(state.selectedDate,state.selectedTime);
  const total=totalPeople();
  const isOver=total>remaining;
  const deptOptions=DEPT_LIST.map(d=>`<option value="${d}" ${state.dept===d?"selected":""}>${d}</option>`).join("");
  let depRows=state.dependents.length===0
    ?`<div class="dep-empty">無眷屬同行 — 可點選「新增眷屬」加入</div>`
    :state.dependents.map((name,idx)=>`
      <div class="dep-row">
        <div class="dep-badge">眷${idx+1}</div>
        <div style="flex:1">
          <input class="form-control ${state.errors[`dep_${idx}`]?"error":""}" type="text"
            placeholder="眷屬 ${idx+1} 姓名" value="${name}"
            oninput="updateDependent(${idx},this.value)"/>
          ${state.errors[`dep_${idx}`]?`<div class="form-error">${state.errors[`dep_${idx}`]}</div>`:""}
        </div>
        <button class="btn-remove" onclick="removeDependent(${idx})">✕</button>
      </div>`).join("");

  el("main").innerHTML=`
    <div class="page-header">
      <button class="btn-back" onclick="goBack(2)">← 返回</button>
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
        <select class="form-control ${state.errors.dept?"error":""}" onchange="updateDept(this.value)">
          <option value="">— 請選擇單位 —</option>${deptOptions}
        </select>
        ${state.errors.dept?`<div class="form-error">${state.errors.dept}</div>`:""}
      </div>
      <div class="form-group">
        <label class="form-label">員工姓名 <span class="form-required">*</span></label>
        <input class="form-control ${state.errors.empName?"error":""}" type="text"
          placeholder="請輸入員工姓名" value="${state.empName}"
          oninput="updateEmpName(this.value)"/>
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
      <button class="btn-submit" onclick="handleSubmit()" ${state.submitting?"disabled":""}>
        ${state.submitting?"送出中…":"確認預約"}
      </button>
    </div>`;
}

// ── Step 3：完成 ──────────────────────────────
function renderStep3() {
  const {full}=fmtDate(state.confirmed.date);
  el("main").innerHTML=`
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
        ${state.confirmed.dependents.map((dep,i)=>`
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

// ── 主渲染 ────────────────────────────────────
function render() {
  renderStepbar();
  if (state.myAppt) { renderAlreadyBooked(); return; }
  if (state.step===0) renderStep0();
  else if (state.step===1) renderStep1();
  else if (state.step===2) renderStep2();
  else if (state.step===3) renderStep3();
}

// ── User Bar ──────────────────────────────────
function renderUserBar(user) {
  el("userBar").innerHTML=`
    <div class="user-bar-name">👤 ${user.displayName||user.email}</div>
    <button class="btn-logout" onclick="doLogout()">登出</button>`;
}

// ── 事件 ──────────────────────────────────────
window.selectDate=(date)=>{ state.selectedDate=date; state.step=1; render(); };
window.selectTime=(time)=>{ state.selectedTime=time; state.step=2; render(); };
window.goBack=(fromStep)=>{ state.step=fromStep-1; state.errors={}; render(); };

window.updateDept=(val)=>{ state.dept=val; state.errors.dept=undefined; };
window.updateEmpName=(val)=>{ state.empName=val; state.errors.empName=undefined; };
window.updateDependent=(idx,val)=>{ state.dependents[idx]=val; state.errors[`dep_${idx}`]=undefined; };

window.addDependent=()=>{ state.dependents.push(""); renderStep2(); };
window.removeDependent=(idx)=>{
  state.dependents.splice(idx,1);
  const errs={};
  Object.entries(state.errors).forEach(([k,v])=>{
    if(!k.startsWith("dep_")){errs[k]=v;return;}
    const i=parseInt(k.split("_")[1]);
    if(i<idx) errs[k]=v;
    else if(i>idx) errs[`dep_${i-1}`]=v;
  });
  state.errors=errs;
  renderStep2();
};

window.handleSubmit=async()=>{
  const errors={};
  if(!state.dept) errors.dept="請選擇單位";
  if(!state.empName.trim()) errors.empName="請填寫員工姓名";
  state.dependents.forEach((d,i)=>{ if(!d.trim()) errors[`dep_${i}`]="請填寫眷屬姓名"; });
  const rem=getRemaining(state.selectedDate,state.selectedTime);
  if(totalPeople()>rem) errors.quota=`此時段剩餘 ${rem} 個名額，您共需 ${totalPeople()} 個`;
  if(Object.keys(errors).length){ state.errors=errors; renderStep2(); return; }

  state.submitting=true; setLoading(true);
  try {
    const slotId=`${state.selectedDate}_${state.selectedTime.replace(":","")}`
    const slotRef=doc(db,"slots",slotId);
    const apptRef=doc(collection(db,"appointments"));
    await runTransaction(db,async(tx)=>{
      const snap=await tx.get(slotRef);
      if(!snap.exists()) throw new Error("查無此時段");
      const {booked,limit}=snap.data();
      if(booked+totalPeople()>limit) throw new Error(`名額不足（剩餘 ${limit-booked} 位）`);
      tx.update(slotRef,{booked:booked+totalPeople()});
      tx.set(apptRef,{
        date:state.selectedDate, time:state.selectedTime,
        dept:state.dept, empName:state.empName,
        dependents:[...state.dependents],
        totalPeople:totalPeople(),
        email:state.user.email,
        createdAt:serverTimestamp()
      });
    });
    state.confirmed={date:state.selectedDate,time:state.selectedTime,dept:state.dept,empName:state.empName,dependents:[...state.dependents]};
    state.step=3; state.myAppt={...state.confirmed,totalPeople:totalPeople()};
  } catch(e) {
    state.errors={quota:e.message};
    renderStep2();
  }
  state.submitting=false; setLoading(false);
  if(state.step===3) render();
};

// ── 即時監聽名額 ──────────────────────────────
onSnapshot(collection(db,"slots"),(snapshot)=>{
  const map={};
  snapshot.forEach(d=>{
    const {date,time,booked}=d.data();
    if(!map[date]) map[date]={};
    map[date][time]=booked;
  });
  state.booked=map;
  if(state.user && !state.myAppt){
    if(state.step===0) renderStep0();
    else if(state.step===1) renderStep1();
  }
});

// ── Auth 狀態監聽 ─────────────────────────────
onAuthStateChanged(auth, async(user)=>{
  setLoading(false);
  if(!user){
    state.user=null; state.myAppt=null;
    showLogin();
    return;
  }
  state.user=user;
  setLoading(true);
  state.myAppt=await getMyAppt(user.email);
  setLoading(false);
  renderUserBar(user);
  showApp();
  render();
});
