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
  "2026-07-18":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:4},{time:"08:00",limit:9},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-07-19":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-07-25":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-07-26":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-01":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-02":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-08":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-09":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-15":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-16":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-22":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-23":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-29":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-08-30":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-05":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:2},{time:"09:30",limit:5}],
  "2026-09-06":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-12":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:6},{time:"09:30",limit:4}],
  "2026-09-13":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-19":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-20":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-26":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
  "2026-09-27":[{time:"07:30",limit:6,scope:"endoscopy"},{time:"07:45",limit:5},{time:"08:00",limit:10},{time:"09:00",limit:5},{time:"09:30",limit:5}],
};
const WD=["日","一","二","三","四","五","六"];
const STEPS=["填寫資料","預約完成"];

// person: { name, dept, date, time, mode:"online"|"self", note, endoscopy:bool, expanded }
let state={
  user:null, myAppt:null, step:0, booked:{},
  emp:{ name:"", dept:"", date:"", time:"", mode:"online", note:"", endoscopy:false, expanded:true },
  dependents:[], // [{name, date, time, mode, note, endoscopy, expanded}]
  errors:{}, confirmed:null, submitting:false,
};

function fmtDate(ds){
  const [y,m,d]=ds.split("-").map(Number);
  const dt=new Date(y,m-1,d);
  return {m,d,wd:WD[dt.getDay()],full:`${m}/${d}(${WD[dt.getDay()]})`};
}
function getLimit(date,time){return SLOTS_DATA[date]?.find(s=>s.time===time)?.limit??0;}
function getBooked(date,time){return state.booked[date]?.[time]??0;}
function getRemaining(date,time){return getLimit(date,time)-getBooked(date,time);}
function el(id){return document.getElementById(id);}
function setLoading(v){el("loadingOverlay").classList.toggle("show",v);}
function showLogin(){el("loginScreen").style.display="flex";el("appScreen").style.display="none";}
function showApp(){el("loginScreen").style.display="none";el("appScreen").style.display="block";}

window.signInWithGoogle=async()=>{
  try{setLoading(true);await signInWithPopup(auth,new GoogleAuthProvider());}
  catch(e){setLoading(false);alert("登入失敗："+e.message);}
};
window.doLogout=async()=>{await signOut(auth);};

async function getMyAppt(email){
  const snap=await getDocs(collection(db,"appointments"));
  const found=snap.docs.find(d=>d.data().email===email);
  return found?{id:found.id,...found.data()}:null;
}

function renderStepbar(){
  el("stepbar").innerHTML=STEPS.map((label,i)=>{
    const isDone=i<state.step,isActive=i===state.step;
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

function renderUserBar(user){
  el("userBar").innerHTML=`
    <div class="user-bar-name">👤 ${user.displayName||user.email}</div>
    <button class="btn-logout" onclick="doLogout()">登出</button>`;
}

// ── 日期時段選擇器 ────────────────────────────
function renderDateTimePicker(prefix, selDate, selTime, isEndoscopy=false){
  const months={};
  Object.keys(SLOTS_DATA).sort().forEach(date=>{
    const {m}=fmtDate(date);
    if(!months[m]) months[m]=[];
    months[m].push(date);
  });
  let html=`<div style="margin-bottom:14px">`;
  for(const [month,dates] of Object.entries(months)){
    html+=`<div style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:8px">${month} 月</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">`;
    for(const date of dates.sort()){
      const {full}=fmtDate(date);
      const totalLimit=SLOTS_DATA[date].reduce((a,s)=>a+s.limit,0);
      const totalBooked=SLOTS_DATA[date].reduce((a,s)=>a+getBooked(date,s.time),0);
      const remaining=totalLimit-totalBooked;
      const isFull=remaining===0;
      const isSel=selDate===date;
      html+=`<button onclick="selectPersonDate('${prefix}','${date}')"
        style="border:2px solid ${isSel?"#0d5c8a":"#e2e8f0"};border-radius:12px;
        padding:8px 12px;cursor:${isFull&&!isSel?"not-allowed":"pointer"};
        background:${isSel?"#0d5c8a":"#fff"};
        color:${isSel?"#fff":isFull?"#cbd5e1":"#0f2942"};
        font-size:14px;font-weight:700;font-family:inherit;
        opacity:${isFull&&!isSel?0.5:1};transition:all .15s;text-align:center"
        ${isFull&&!isSel?"disabled":""}>
        ${full}<br>
        <span style="font-size:11px;font-weight:400;color:${isSel?"rgba(255,255,255,0.75)":isFull?"#cbd5e1":"#94a3b8"}">
          ${isFull?"額滿":`剩${remaining}位`}
        </span>
      </button>`;
    }
    html+=`</div></div>`;
  }
  html+=`</div>`;
  if(selDate){
    html+=`<div style="margin-top:8px">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:10px">選擇時段</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">`;
    for(const slot of SLOTS_DATA[selDate]){
      // 腸胃鏡時段只給腸胃鏡，非腸胃鏡時段不給腸胃鏡
      if(slot.scope==="endoscopy" && !isEndoscopy) continue;
      if(!slot.scope && isEndoscopy) continue;
      const rem=getRemaining(selDate,slot.time);
      const isFull=rem<=0;
      const isSel=selTime===slot.time;
      const pct=Math.min(((getBooked(selDate,slot.time))/slot.limit)*100,100);
      html+=`<button onclick="selectPersonTime('${prefix}','${slot.time}')"
        style="border:2px solid ${isSel?"#0d5c8a":"#e2e8f0"};border-radius:14px;
        padding:14px;cursor:${isFull&&!isSel?"not-allowed":"pointer"};
        background:${isSel?"#0d5c8a":"#fff"};text-align:left;
        font-family:inherit;transition:all .15s;opacity:${isFull&&!isSel?0.5:1}"
        ${isFull&&!isSel?"disabled":""}>
        <div style="font-size:22px;font-weight:900;color:${isSel?"#fff":isFull?"#cbd5e1":"#0d5c8a"}">${slot.time}</div>
        <div style="font-size:12px;color:${isSel?"rgba(255,255,255,0.8)":isFull?"#cbd5e1":"#64748b"};margin-top:5px">
          ${isFull?"已額滿":`剩 ${rem} 位`}
        </div>
        <div style="margin-top:8px;height:5px;border-radius:3px;background:${isSel?"rgba(255,255,255,0.3)":"#e2e8f0"};overflow:hidden">
          <div style="height:100%;width:${pct}%;border-radius:3px;background:${isSel?"rgba(255,255,255,0.8)":rem<=3?"#ef4444":"#0d5c8a"}"></div>
        </div>
      </button>`;
    }
    html+=`</div></div>`;
  }
  return html;
}

// ── 人員卡片 ──────────────────────────────────
function renderPersonCard(person, prefix, label, tagBg, nameErr, dateErr, timeErr, noteErr, showDept=false){
  const isEndoscopy=person.endoscopy||false;
  const isExp=person.expanded;
  const isSelf=person.mode==="self";
  const hasSummary=person.name&&(isSelf?person.note:(person.date&&person.time));
  const dateStr=person.date?fmtDate(person.date).full:"";
  const deptOptions=showDept?DEPT_LIST.map(d=>`<option value="${d}" ${person.dept===d?"selected":""}>${d}</option>`).join(""):"";

  let summary="";
  if(hasSummary&&!isExp){
    summary=isSelf
      ?`<span style="font-size:14px;color:#64748b">自行預約 · ${person.note}</span>`
      :`<span style="font-size:13px;color:#64748b">· ${dateStr} ${person.time}</span>`;
  }

  return `<div style="background:#fff;border-radius:18px;box-shadow:0 2px 14px rgba(0,0,0,.07);margin-bottom:14px;overflow:hidden">
    <div onclick="toggleExpand('${prefix}')" style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;cursor:pointer;user-select:none">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="background:${tagBg};color:#fff;border-radius:9px;padding:4px 12px;font-size:13px;font-weight:800">${label}</span>
        ${person.name?`<span style="font-size:16px;font-weight:800;color:#0f2942">${person.name}</span>`:""}
        ${summary}
        ${!person.name&&!isExp?`<span style="font-size:14px;color:#94a3b8">點此展開填寫</span>`:""}
      </div>
      <span style="font-size:20px;color:#94a3b8;transition:transform .2s;display:inline-block;transform:rotate(${isExp?180:0}deg);flex-shrink:0">▾</span>
    </div>
    ${isExp?`<div style="padding:0 20px 20px;border-top:1px solid #f1f5f9">

      ${showDept?`<div style="margin-top:16px;margin-bottom:16px">
        <label class="form-label">單位／部門 <span class="form-required">*</span></label>
        <select class="form-control ${state.errors.dept?"error":""}" onchange="updatePersonDept(this.value)">
          <option value="">— 請選擇單位 —</option>${deptOptions}
        </select>
        ${state.errors.dept?`<div class="form-error">${state.errors.dept}</div>`:""}
      </div>`:""}

      <div style="margin-top:16px;margin-bottom:16px">
        <label class="form-label">姓名 <span class="form-required">*</span></label>
        <input class="form-control ${nameErr?"error":""}" type="text"
          placeholder="請輸入中文全名" value="${person.name}"
          oninput="updatePersonName('${prefix}',this.value)"/>
        ${nameErr?`<div class="form-error">${nameErr}</div>`:""}
        <div style="font-size:12px;color:#94a3b8;margin-top:6px">⚠️ 請務必填寫中文全名</div>
      </div>

      <div style="margin-bottom:16px">
        <label class="form-label">預約方式 <span class="form-required">*</span></label>
        <div class="radio-group">
          <label class="radio-option ${!isSelf?"selected":""}" onclick="setPersonMode('${prefix}','online')">
            <input type="radio" name="mode_${prefix}" ${!isSelf?"checked":""} readonly> 使用網站預約時段
          </label>
          <label class="radio-option ${isSelf?"selected":""}" onclick="setPersonMode('${prefix}','self')">
            <input type="radio" name="mode_${prefix}" ${isSelf?"checked":""} readonly> 自行與晨悅聯繫預約
          </label>
        </div>
      </div>

      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:800;color:#92400e;margin-bottom:8px">🔔 腸胃鏡檢查注意事項</div>
        <div style="font-size:13px;color:#78350f;line-height:1.8">
          · 選擇腸胃鏡的同仁，受檢時間固定於 <strong>07:30</strong><br>
          · 每日腸胃鏡名額上限 6 位，額滿後不可再預約<br>
          · 請勾選「我有預約腸胃鏡檢查」後系統將自動導向 07:30 時段
        </div>
      </div>

      ${isSelf?`
        <div style="margin-bottom:16px">
          <label class="form-label">約定時間備註 <span class="form-required">*</span></label>
          <input class="form-control ${noteErr?"error":""}" type="text"
            placeholder="例：7/18 上午 10:00"
            value="${person.note||""}"
            oninput="updatePersonNote('${prefix}',this.value)"/>
          ${noteErr?`<div class="form-error">${noteErr}</div>`:""}
          <div style="font-size:12px;color:#94a3b8;margin-top:6px">此欄位僅供記錄，不佔用網站名額</div>
        </div>
      `:`
        <label class="form-label" style="margin-bottom:12px">選擇日期與時段 <span class="form-required">*</span></label>
        ${dateErr?`<div class="form-error" style="margin-bottom:8px">${dateErr}</div>`:""}
        ${timeErr?`<div class="form-error" style="margin-bottom:8px">${timeErr}</div>`:""}
        <div style="margin-bottom:14px">
          <label style="display:flex;align-items:center;gap:12px;padding:14px 18px;border:2px solid ${isEndoscopy?"#0d5c8a":"#e2e8f0"};border-radius:12px;cursor:pointer;background:${isEndoscopy?"#eff6ff":"#fff"};transition:all .2s">
            <input type="checkbox" ${isEndoscopy?"checked":""} onchange="toggleEndoscopy('${prefix}',this.checked)"
              style="width:20px;height:20px;accent-color:#0d5c8a;cursor:pointer;flex-shrink:0"/>
            <div>
              <div style="font-size:15px;font-weight:700;color:#0f2942">我有預約腸胃鏡檢查</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">勾選後將只開放 07:30 時段</div>
            </div>
          </label>
        </div>
        ${renderDateTimePicker(prefix, person.date, person.time, isEndoscopy)}
      `}
    </div>`:""}
  </div>`;
}

// ── Step 0：填寫 ──────────────────────────────
function renderStep0(){
  const e=state.errors;
  const depCards=state.dependents.map((dep,idx)=>`
    <div style="position:relative">
      ${renderPersonCard(dep,"dep_"+idx,"眷屬 "+(idx+1),"#059669",
        e["dep_"+idx+"_name"],e["dep_"+idx+"_date"],e["dep_"+idx+"_time"],e["dep_"+idx+"_note"])}
      <button onclick="removeDependent(${idx})"
        title="移除此眷屬"
        style="position:absolute;top:14px;right:52px;background:#fef2f2;border:1px solid #fca5a5;color:#ef4444;border-radius:8px;padding:4px 10px;font-size:13px;cursor:pointer">✕</button>
    </div>`).join("");

  el("main").innerHTML=`
    <div style="font-size:20px;font-weight:900;color:#0f2942;margin-bottom:6px">填寫預約資料</div>
    <div style="font-size:14px;color:#64748b;margin-bottom:22px">員工與眷屬可各自選擇不同日期及時段</div>
    ${e.submit?`<div class="error-banner">⚠️ ${e.submit}</div>`:""}
    ${renderPersonCard(state.emp,"emp","員工","#0d5c8a",e.emp_name,e.emp_date,e.emp_time,e.emp_note,true)}
    ${depCards}
    <button onclick="addDependent()"
      style="width:100%;border:2px dashed #cbd5e1;background:#fff;border-radius:16px;
      padding:16px;font-size:15px;font-weight:700;color:#64748b;cursor:pointer;
      font-family:inherit;margin-bottom:24px;transition:all .2s"
      onmouseover="this.style.borderColor='#0d5c8a';this.style.color='#0d5c8a'"
      onmouseout="this.style.borderColor='#cbd5e1';this.style.color='#64748b'">
      ＋ 新增眷屬
    </button>
    <button class="btn-submit" onclick="handleSubmit()" ${state.submitting?"disabled":""}>
      ${state.submitting?"送出中…":"確認預約"}
    </button>`;
}

// ── Step 1：完成 ──────────────────────────────
function renderStep1(){
  const emp=state.confirmed.emp;
  const depList=state.confirmed.dependents.map((dep,i)=>{
    const info=dep.mode==="self"?`自行預約 · ${dep.note}`:`${dep.date?fmtDate(dep.date).full:""} ${dep.time}`;
    return `<div class="result-person dep">
      <span class="tag tag-dep">眷屬 ${i+1}</span>
      <span class="result-person-name">${dep.name}</span>
      <span class="result-person-dept">${info}</span>
    </div>`;
  }).join("");
  const failList=state.confirmed.failed||[];
  const failNote=failList.length>0
    ?`<div class="error-banner" style="text-align:left;margin-bottom:18px">
        ⚠️ 以下眷屬時段已額滿，未完成預約，請聯絡福委：<br>
        ${failList.map(f=>`<strong>${f.name}</strong>（${f.date?fmtDate(f.date).full:""} ${f.time}）`).join("、")}
      </div>`:""
  const empInfo=emp.mode==="self"?`自行預約 · ${emp.note}`:`${emp.date?fmtDate(emp.date).full:""} ${emp.time} · ${emp.dept}`;
  el("main").innerHTML=`
    <div class="success-wrap">
      <div class="success-icon">✓</div>
      <div class="success-title">${failList.length>0?"部分預約成功！":"預約成功！"}</div>
      <div class="success-sub">以下是您的預約資訊，請準時報到</div>
      ${failNote}
      <div class="result-card">
        <div class="result-list-title">預約名單</div>
        <div class="result-person emp">
          <span class="tag tag-emp">員工</span>
          <span class="result-person-name">${emp.name}</span>
          <span class="result-person-dept">${empInfo}</span>
        </div>
        ${depList}
        <div class="result-total">
          <span class="result-total-label">成功預約人數</span>
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

function render(){
  renderStepbar();
  if(state.myAppt){renderAlreadyBooked();return;}
  if(state.step===0) renderStep0();
  else if(state.step===1) renderStep1();
}

function renderAlreadyBooked(){
  const a=state.myAppt;
  const emp=a.emp||{name:a.empName,dept:a.dept,date:a.date,time:a.time,mode:"online"};
  const deps=(a.dependents||[]).map((dep,i)=>{
    const d=typeof dep==="object"?dep:{name:dep,date:emp.date,time:emp.time,mode:"online",endoscopy:false};
    const info=d.mode==="self"?`自行預約 · ${d.note}`:`${d.date?fmtDate(d.date).full:""} ${d.time||""}`;
    const endoTag=d.endoscopy?`<span style="background:#dbeafe;color:#1d4ed8;border-radius:5px;padding:1px 6px;font-size:11px;font-weight:700;margin-left:6px">腸胃鏡</span>`:"";
    return `<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#f0fdf4;border-radius:12px;margin-bottom:10px;flex-wrap:wrap">
      <span style="background:#dcfce7;color:#15803d;border-radius:7px;padding:3px 10px;font-size:13px;font-weight:700">眷屬 ${i+1}</span>
      <span style="font-size:16px;font-weight:800">${d.name}${endoTag}</span>
      <span style="font-size:13px;color:#64748b;margin-left:auto">${info}</span>
    </div>`;
  }).join("");
  const empInfo=emp.mode==="self"?`自行預約 · ${emp.note}`:`${emp.date?fmtDate(emp.date).full:""} ${emp.time||""} · ${emp.dept||""}`;
  el("main").innerHTML=`
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:44px;margin-bottom:14px">📋</div>
      <div style="font-size:22px;font-weight:900;color:#0f2942;margin-bottom:8px">您已完成預約</div>
      <div style="font-size:14px;color:#64748b;margin-bottom:26px">如需更改請聯絡福委</div>
      <div style="background:#fff;border-radius:22px;padding:26px;box-shadow:0 3px 16px rgba(0,0,0,.07);text-align:left;max-width:520px;margin:0 auto">
        <div style="font-size:13px;color:#94a3b8;margin-bottom:12px;font-weight:700">預約名單</div>
        <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#eff6ff;border-radius:12px;margin-bottom:10px;flex-wrap:wrap">
          <span style="background:#dbeafe;color:#1d4ed8;border-radius:7px;padding:3px 10px;font-size:13px;font-weight:700">員工</span>
          <span style="font-size:16px;font-weight:800">${emp.name}</span>
          <span style="font-size:13px;color:#64748b;margin-left:auto">${empInfo}</span>
        </div>
        ${deps}
      </div>
    </div>`;
}

// ── 事件 ──────────────────────────────────────
window.toggleExpand=(prefix)=>{
  if(prefix==="emp") state.emp.expanded=!state.emp.expanded;
  else { const idx=parseInt(prefix.split("_")[1]); state.dependents[idx].expanded=!state.dependents[idx].expanded; }
  renderStep0();
};
window.updatePersonDept=(val)=>{ state.emp.dept=val; state.errors.dept=undefined; };
window.updatePersonName=(prefix,val)=>{
  if(prefix==="emp"){ state.emp.name=val; state.errors.emp_name=undefined; }
  else { const idx=parseInt(prefix.split("_")[1]); state.dependents[idx].name=val; state.errors["dep_"+idx+"_name"]=undefined; }
};
window.updatePersonNote=(prefix,val)=>{
  if(prefix==="emp"){ state.emp.note=val; state.errors.emp_note=undefined; }
  else { const idx=parseInt(prefix.split("_")[1]); state.dependents[idx].note=val; state.errors["dep_"+idx+"_note"]=undefined; }
};
window.setPersonMode=(prefix,mode)=>{
  if(prefix==="emp"){ state.emp.mode=mode; state.emp.date=""; state.emp.time=""; state.emp.note=""; }
  else { const idx=parseInt(prefix.split("_")[1]); state.dependents[idx].mode=mode; state.dependents[idx].date=""; state.dependents[idx].time=""; state.dependents[idx].note=""; }
  renderStep0();
};
window.toggleEndoscopy=(prefix,val)=>{
  if(prefix==="emp"){ state.emp.endoscopy=val; state.emp.date=""; state.emp.time=""; }
  else { const idx=parseInt(prefix.split("_")[1]); state.dependents[idx].endoscopy=val; state.dependents[idx].date=""; state.dependents[idx].time=""; }
  renderStep0();
};
window.selectPersonDate=(prefix,date)=>{
  if(prefix==="emp"){ state.emp.date=date; state.emp.time=""; state.errors.emp_date=undefined; }
  else { const idx=parseInt(prefix.split("_")[1]); state.dependents[idx].date=date; state.dependents[idx].time=""; state.errors["dep_"+idx+"_date"]=undefined; }
  renderStep0();
};
window.selectPersonTime=(prefix,time)=>{
  if(prefix==="emp"){ state.emp.time=time; state.errors.emp_time=undefined; }
  else { const idx=parseInt(prefix.split("_")[1]); state.dependents[idx].time=time; state.errors["dep_"+idx+"_time"]=undefined; }
  renderStep0();
};
window.addDependent=()=>{ state.dependents.push({name:"",date:"",time:"",mode:"online",note:"",endoscopy:false,expanded:true}); renderStep0(); };
window.removeDependent=(idx)=>{ state.dependents.splice(idx,1); renderStep0(); };

window.handleSubmit=async()=>{
  const errors={};
  if(!state.emp.dept) errors.dept="請選擇單位";
  if(!state.emp.name.trim()) errors.emp_name="請填寫員工姓名";
  if(state.emp.mode==="online"){
    if(!state.emp.date) errors.emp_date="請選擇日期";
    if(!state.emp.time) errors.emp_time="請選擇時段";
    if(state.emp.date&&state.emp.time&&getRemaining(state.emp.date,state.emp.time)<=0) errors.emp_time="此時段已額滿，請重新選擇";
  } else {
    if(!state.emp.note.trim()) errors.emp_note="請填寫約定時間";
  }
  state.dependents.forEach((dep,i)=>{
    if(!dep.name.trim()) errors["dep_"+i+"_name"]="請填寫眷屬姓名";
    if(dep.mode==="online"){
      if(!dep.date) errors["dep_"+i+"_date"]="請選擇日期";
      if(!dep.time) errors["dep_"+i+"_time"]="請選擇時段";
    } else {
      if(!dep.note.trim()) errors["dep_"+i+"_note"]="請填寫約定時間";
    }
  });
  if(Object.keys(errors).length){
    if(errors.emp_name||errors.emp_date||errors.emp_time||errors.emp_note||errors.dept) state.emp.expanded=true;
    state.dependents.forEach((dep,i)=>{
      if(errors["dep_"+i+"_name"]||errors["dep_"+i+"_date"]||errors["dep_"+i+"_time"]||errors["dep_"+i+"_note"]) dep.expanded=true;
    });
    state.errors=errors; renderStep0(); return;
  }

  state.submitting=true; setLoading(true);
  const failed=[], succeededDeps=[];

  // 員工預約
  try{
    const apptRef=doc(collection(db,"appointments"));
    if(state.emp.mode==="online"){
      const slotId=`${state.emp.date}_${state.emp.time.replace(":","")}`
      const slotRef=doc(db,"slots",slotId);
      await runTransaction(db,async(tx)=>{
        const snap=await tx.get(slotRef);
        if(!snap.exists()) throw new Error("查無此時段");
        const {booked,limit}=snap.data();
        if(booked+1>limit) throw new Error("您選擇的時段已額滿，請重新選擇");
        tx.update(slotRef,{booked:booked+1});
        tx.set(apptRef,{
          emp:{name:state.emp.name,dept:state.emp.dept,date:state.emp.date,time:state.emp.time,mode:"online",endoscopy:state.emp.endoscopy},
          dependents:state.dependents.map(d=>({name:d.name,date:d.date,time:d.time,mode:d.mode,note:d.note,endoscopy:d.endoscopy})),
          email:state.user.email, totalPeople:1+state.dependents.length,
          createdAt:serverTimestamp()
        });
      });
    } else {
      // 自行預約不扣名額，直接寫入
      await runTransaction(db,async(tx)=>{
        tx.set(apptRef,{
          emp:{name:state.emp.name,dept:state.emp.dept,mode:"self",note:state.emp.note,endoscopy:state.emp.endoscopy},
          dependents:state.dependents.map(d=>({name:d.name,date:d.date,time:d.time,mode:d.mode,note:d.note,endoscopy:d.endoscopy})),
          email:state.user.email, totalPeople:1+state.dependents.length,
          createdAt:serverTimestamp()
        });
      });
    }
  }catch(e){
    state.submitting=false; setLoading(false);
    state.errors={submit:e.message}; state.emp.expanded=true;
    renderStep0(); return;
  }

  // 眷屬各自扣名額（只有 online 的才扣）
  for(const dep of state.dependents){
    if(dep.mode==="self"){ succeededDeps.push(dep); continue; }
    try{
      const slotId=`${dep.date}_${dep.time.replace(":","")}`
      const slotRef=doc(db,"slots",slotId);
      await runTransaction(db,async(tx)=>{
        const snap=await tx.get(slotRef);
        if(!snap.exists()) throw new Error("查無此時段");
        const {booked,limit}=snap.data();
        if(booked+1>limit) throw new Error("額滿");
        tx.update(slotRef,{booked:booked+1});
      });
      succeededDeps.push(dep);
    }catch(e){ failed.push(dep); }
  }

  state.confirmed={
    emp:{...state.emp},
    dependents:succeededDeps.map(d=>({name:d.name,date:d.date,time:d.time,mode:d.mode,note:d.note,endoscopy:d.endoscopy||false})),
    failed:failed.map(d=>({name:d.name,date:d.date,time:d.time}))
  };
  state.myAppt={...state.confirmed};
  state.step=1;
  state.submitting=false; setLoading(false);
  render();
};

// 即時監聽名額
onSnapshot(collection(db,"slots"),(snapshot)=>{
  const map={};
  snapshot.forEach(d=>{
    const {date,time,booked}=d.data();
    if(!map[date]) map[date]={};
    map[date][time]=booked;
  });
  state.booked=map;
  if(state.user&&!state.myAppt&&state.step===0) renderStep0();
});

onAuthStateChanged(auth,async(user)=>{
  setLoading(false);
  if(!user){state.user=null;state.myAppt=null;showLogin();return;}
  state.user=user;
  setLoading(true);
  state.myAppt=await getMyAppt(user.email);
  setLoading(false);
  renderUserBar(user);
  showApp();
  render();
});
