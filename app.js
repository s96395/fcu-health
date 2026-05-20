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
const WD=["日","一","二","三","四","五","六"];
const STEPS=["填寫資料","預約完成"];

// person: { name, date, time, expanded }
// emp: { name, dept, date, time, expanded }
let state={
  user:null, myAppt:null, step:0, booked:{},
  emp:{ name:"", dept:"", date:"", time:"", expanded:true },
  dependents:[], // [{name, date, time, expanded}]
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

// ── 日期＋時段選擇器（嵌入式）────────────────
function renderDateTimePicker(person, prefix, selectedDate, selectedTime){
  const months={};
  Object.keys(SLOTS_DATA).sort().forEach(date=>{
    const {m}=fmtDate(date);
    if(!months[m]) months[m]=[];
    months[m].push(date);
  });

  let dateHtml=`<div style="margin-bottom:12px">`;
  for(const [month,dates] of Object.entries(months)){
    dateHtml+=`<div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:6px">${month} 月</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">`;
    for(const date of dates.sort()){
      const {full}=fmtDate(date);
      const totalLimit=SLOTS_DATA[date].reduce((a,s)=>a+s.limit,0);
      const totalBooked=SLOTS_DATA[date].reduce((a,s)=>a+getBooked(date,s.time),0);
      const remaining=totalLimit-totalBooked;
      const isFull=remaining===0;
      const isSelected=selectedDate===date;
      dateHtml+=`<button onclick="selectPersonDate('${prefix}','${date}')"
        style="border:2px solid ${isSelected?"#0d5c8a":isFull?"#e2e8f0":"#e2e8f0"};
        border-radius:10px;padding:6px 10px;cursor:${isFull?"not-allowed":"pointer"};
        background:${isSelected?"#0d5c8a":isFull?"#f8fafc":"#fff"};
        color:${isSelected?"#fff":isFull?"#cbd5e1":"#0f2942"};
        font-size:12px;font-weight:700;font-family:inherit;
        opacity:${isFull&&!isSelected?0.5:1};transition:all .15s"
        ${isFull&&!isSelected?"disabled":""}>
        ${full}<br>
        <span style="font-size:10px;font-weight:400;color:${isSelected?"rgba(255,255,255,0.8)":isFull?"#cbd5e1":"#94a3b8"}">
          ${isFull?"額滿":`剩${remaining}`}
        </span>
      </button>`;
    }
    dateHtml+=`</div></div>`;
  }
  dateHtml+=`</div>`;

  let timeHtml="";
  if(selectedDate){
    const slots=SLOTS_DATA[selectedDate]||[];
    timeHtml=`<div style="margin-top:4px">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:8px">選擇時段</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">`;
    for(const slot of slots){
      const rem=getRemaining(selectedDate,slot.time);
      const isFull=rem<=0;
      const isSelected=selectedTime===slot.time;
      const pct=Math.min(((getBooked(selectedDate,slot.time))/slot.limit)*100,100);
      timeHtml+=`<button onclick="selectPersonTime('${prefix}','${slot.time}')"
        style="border:2px solid ${isSelected?"#0d5c8a":isFull?"#e2e8f0":"#e2e8f0"};
        border-radius:12px;padding:12px;cursor:${isFull?"not-allowed":"pointer"};
        background:${isSelected?"#0d5c8a":isFull?"#f8fafc":"#fff"};
        text-align:left;font-family:inherit;transition:all .15s;
        opacity:${isFull&&!isSelected?0.5:1}"
        ${isFull&&!isSelected?"disabled":""}>
        <div style="font-size:20px;font-weight:900;color:${isSelected?"#fff":isFull?"#cbd5e1":"#0d5c8a"}">${slot.time}</div>
        <div style="font-size:11px;color:${isSelected?"rgba(255,255,255,0.8)":isFull?"#cbd5e1":"#64748b"};margin-top:4px">
          ${isFull?"已額滿":`剩 ${rem} 位`}
        </div>
        <div style="margin-top:6px;height:4px;border-radius:2px;background:${isSelected?"rgba(255,255,255,0.3)":"#e2e8f0"};overflow:hidden">
          <div style="height:100%;width:${pct}%;border-radius:2px;background:${isSelected?"rgba(255,255,255,0.8)":rem<=3?"#ef4444":"#0d5c8a"}"></div>
        </div>
      </button>`;
    }
    timeHtml+=`</div></div>`;
  }

  return dateHtml+timeHtml;
}

// ── 人員卡片 ──────────────────────────────────
function renderPersonCard(person, prefix, label, tagColor, nameErr, dateErr, timeErr, showDept=false){
  const isExpanded=person.expanded;
  const hasSummary=person.name&&person.date&&person.time;
  const {full}=person.date?fmtDate(person.date):{full:""};
  const deptOptions=showDept?DEPT_LIST.map(d=>`<option value="${d}" ${person.dept===d?"selected":""}>${d}</option>`).join(""):"";

  return `<div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.07);margin-bottom:12px;overflow:hidden">
    <!-- 卡片 Header -->
    <div onclick="toggleExpand('${prefix}')" style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;cursor:pointer;user-select:none">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="background:${tagColor};color:#fff;border-radius:8px;padding:3px 10px;font-size:12px;font-weight:800">${label}</span>
        ${hasSummary&&!isExpanded
          ?`<span style="font-size:14px;font-weight:700;color:#0f2942">${person.name}</span>
            <span style="font-size:12px;color:#64748b">· ${full} ${person.time}</span>`
          :person.name
            ?`<span style="font-size:14px;font-weight:700;color:#0f2942">${person.name}</span>`
            :`<span style="font-size:13px;color:#94a3b8">點此展開填寫</span>`
        }
      </div>
      <span style="font-size:18px;color:#94a3b8;transition:transform .2s;display:inline-block;transform:rotate(${isExpanded?180:0}deg)">▾</span>
    </div>

    <!-- 卡片內容 -->
    ${isExpanded?`<div style="padding:0 18px 18px;border-top:1px solid #f1f5f9">
      ${showDept?`<div style="margin-top:14px;margin-bottom:12px">
        <label style="font-size:12px;font-weight:800;color:#334155;display:block;margin-bottom:6px">單位／部門 <span style="color:#ef4444">*</span></label>
        <select class="form-control ${state.errors.dept?"error":""}" onchange="updatePersonDept(this.value)" style="width:100%">
          <option value="">— 請選擇單位 —</option>${deptOptions}
        </select>
        ${state.errors.dept?`<div class="form-error">${state.errors.dept}</div>`:""}
      </div>`:""}
      <div style="margin-top:14px;margin-bottom:14px">
        <label style="font-size:12px;font-weight:800;color:#334155;display:block;margin-bottom:6px">姓名 <span style="color:#ef4444">*</span></label>
        <input class="form-control ${nameErr?"error":""}" type="text"
          placeholder="請輸入姓名" value="${person.name}"
          oninput="updatePersonName('${prefix}',this.value)"
          style="width:100%"/>
        ${nameErr?`<div class="form-error">${nameErr}</div>`:""}
      </div>
      <label style="font-size:12px;font-weight:800;color:#334155;display:block;margin-bottom:10px">選擇日期與時段 <span style="color:#ef4444">*</span></label>
      ${dateErr?`<div class="form-error" style="margin-bottom:8px">${dateErr}</div>`:""}
      ${timeErr?`<div class="form-error" style="margin-bottom:8px">${timeErr}</div>`:""}
      ${renderDateTimePicker(person, prefix, person.date, person.time)}
    </div>`:""}
  </div>`;
}

// ── Step 0：填寫資料 ──────────────────────────
function renderStep0(){
  const e=state.errors;

  let depCards=state.dependents.map((dep,idx)=>`
    <div style="position:relative">
      ${renderPersonCard(dep,"dep_"+idx,"眷屬 "+(idx+1),"#059669",
        e["dep_"+idx+"_name"],e["dep_"+idx+"_date"],e["dep_"+idx+"_time"])}
      <button onclick="removeDependent(${idx})"
        style="position:absolute;top:12px;right:48px;background:none;border:none;color:#ef4444;font-size:18px;cursor:pointer;line-height:1">✕</button>
    </div>`).join("");

  el("main").innerHTML=`
    <div style="font-size:18px;font-weight:900;color:#0f2942;margin-bottom:6px">填寫預約資料</div>
    <div style="font-size:13px;color:#64748b;margin-bottom:20px">員工與眷屬可選擇不同日期及時段</div>

    ${e.submit?`<div class="error-banner">⚠️ ${e.submit}</div>`:""}

    <!-- 員工卡片 -->
    ${renderPersonCard(state.emp,"emp","員工","#0d5c8a",
      e.emp_name,e.emp_date,e.emp_time,true)}

    <!-- 眷屬卡片 -->
    ${depCards}

    <!-- 新增眷屬按鈕 -->
    <button onclick="addDependent()"
      style="width:100%;border:2px dashed #cbd5e1;background:#fff;border-radius:14px;
      padding:14px;font-size:14px;font-weight:700;color:#64748b;cursor:pointer;
      font-family:inherit;margin-bottom:20px;transition:all .2s"
      onmouseover="this.style.borderColor='#0d5c8a';this.style.color='#0d5c8a'"
      onmouseout="this.style.borderColor='#cbd5e1';this.style.color='#64748b'">
      ＋ 新增眷屬
    </button>

    <!-- 送出 -->
    <button class="btn-submit" onclick="handleSubmit()" ${state.submitting?"disabled":""}>
      ${state.submitting?"送出中…":"確認預約"}
    </button>`;
}

// ── Step 1：完成 ──────────────────────────────
function renderStep1(){
  const {full}=fmtDate(state.confirmed.emp.date);
  const depList=state.confirmed.dependents.map((dep,i)=>`
    <div class="result-person dep">
      <span class="tag tag-dep">眷屬 ${i+1}</span>
      <span class="result-person-name">${dep.name}</span>
      <span class="result-person-dept">${fmtDate(dep.date).full} ${dep.time}</span>
    </div>`).join("");
  const failList=state.confirmed.failed||[];
  const failNote=failList.length>0
    ?`<div class="error-banner" style="text-align:left;margin-bottom:16px">
        ⚠️ 以下眷屬時段已額滿，未完成預約，請聯絡福委：<br>
        ${failList.map(f=>`<strong>${f.name}</strong>（${fmtDate(f.date).full} ${f.time}）`).join("、")}
      </div>`:""
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
          <span class="result-person-name">${state.confirmed.emp.name}</span>
          <span class="result-person-dept">${fmtDate(state.confirmed.emp.date).full} ${state.confirmed.emp.time} · ${state.confirmed.emp.dept}</span>
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

// ── 已預約 ────────────────────────────────────
function renderAlreadyBooked(){
  const a=state.myAppt;
  const deps=(a.dependents||[]).map((dep,i)=>{
    const d=typeof dep==="object"?dep:{name:dep,date:a.emp?.date||a.date,time:a.emp?.time||a.time};
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f0fdf4;border-radius:10px;margin-bottom:8px;flex-wrap:wrap">
      <span style="background:#dcfce7;color:#15803d;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700">眷屬 ${i+1}</span>
      <span style="font-size:15px;font-weight:800">${d.name}</span>
      <span style="font-size:12px;color:#64748b;margin-left:auto">${d.date?fmtDate(d.date).full:""} ${d.time||""}</span>
    </div>`;
  }).join("");
  const empDate=a.emp?.date||a.date;
  const empTime=a.emp?.time||a.time;
  el("main").innerHTML=`
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <div style="font-size:20px;font-weight:900;color:#0f2942;margin-bottom:6px">您已完成預約</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:24px">如需更改請聯絡福委</div>
      <div style="background:#fff;border-radius:20px;padding:24px;box-shadow:0 3px 16px rgba(0,0,0,.07);text-align:left;max-width:480px;margin:0 auto">
        <div style="font-size:12px;color:#94a3b8;margin-bottom:10px;font-weight:700">預約名單</div>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#eff6ff;border-radius:10px;margin-bottom:8px;flex-wrap:wrap">
          <span style="background:#dbeafe;color:#1d4ed8;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700">員工</span>
          <span style="font-size:15px;font-weight:800">${a.emp?.name||a.empName}</span>
          <span style="font-size:12px;color:#64748b;margin-left:auto">${empDate?fmtDate(empDate).full:""} ${empTime} · ${a.emp?.dept||a.dept}</span>
        </div>
        ${deps}
      </div>
    </div>`;
}

// ── 事件 ──────────────────────────────────────
window.toggleExpand=(prefix)=>{
  if(prefix==="emp"){
    state.emp.expanded=!state.emp.expanded;
  } else {
    const idx=parseInt(prefix.split("_")[1]);
    state.dependents[idx].expanded=!state.dependents[idx].expanded;
  }
  renderStep0();
};

window.updatePersonDept=(val)=>{
  state.emp.dept=val;
  state.errors.dept=undefined;
};

window.updatePersonName=(prefix,val)=>{
  if(prefix==="emp"){state.emp.name=val;state.errors.emp_name=undefined;}
  else{const idx=parseInt(prefix.split("_")[1]);state.dependents[idx].name=val;state.errors["dep_"+idx+"_name"]=undefined;}
};

window.selectPersonDate=(prefix,date)=>{
  if(prefix==="emp"){state.emp.date=date;state.emp.time="";state.errors.emp_date=undefined;}
  else{const idx=parseInt(prefix.split("_")[1]);state.dependents[idx].date=date;state.dependents[idx].time="";state.errors["dep_"+idx+"_date"]=undefined;}
  renderStep0();
};

window.selectPersonTime=(prefix,time)=>{
  if(prefix==="emp"){state.emp.time=time;state.errors.emp_time=undefined;}
  else{const idx=parseInt(prefix.split("_")[1]);state.dependents[idx].time=time;state.errors["dep_"+idx+"_time"]=undefined;}
  renderStep0();
};

window.addDependent=()=>{
  state.dependents.push({name:"",date:"",time:"",expanded:true});
  renderStep0();
};

window.removeDependent=(idx)=>{
  state.dependents.splice(idx,1);
  renderStep0();
};

window.handleSubmit=async()=>{
  const errors={};
  if(!state.emp.dept) errors.dept="請選擇單位";
  if(!state.emp.name.trim()) errors.emp_name="請填寫員工姓名";
  if(!state.emp.date) errors.emp_date="請選擇日期";
  if(!state.emp.time) errors.emp_time="請選擇時段";
  const empRem=getRemaining(state.emp.date,state.emp.time);
  if(state.emp.date&&state.emp.time&&empRem<=0) errors.emp_time="此時段已額滿，請重新選擇";
  state.dependents.forEach((dep,i)=>{
    if(!dep.name.trim()) errors["dep_"+i+"_name"]="請填寫眷屬姓名";
    if(!dep.date) errors["dep_"+i+"_date"]="請選擇日期";
    if(!dep.time) errors["dep_"+i+"_time"]="請選擇時段";
  });
  if(Object.keys(errors).length){
    // 展開有錯誤的卡片
    if(errors.emp_name||errors.emp_date||errors.emp_time||errors.dept) state.emp.expanded=true;
    state.dependents.forEach((dep,i)=>{
      if(errors["dep_"+i+"_name"]||errors["dep_"+i+"_date"]||errors["dep_"+i+"_time"]) dep.expanded=true;
    });
    state.errors=errors;renderStep0();return;
  }

  state.submitting=true;setLoading(true);
  const failed=[];
  const succeededDeps=[];

  // 員工預約
  try{
    const slotId=`${state.emp.date}_${state.emp.time.replace(":","")}`
    const slotRef=doc(db,"slots",slotId);
    const apptRef=doc(collection(db,"appointments"));
    await runTransaction(db,async(tx)=>{
      const snap=await tx.get(slotRef);
      if(!snap.exists()) throw new Error("查無此時段");
      const {booked,limit}=snap.data();
      if(booked+1>limit) throw new Error("您選擇的時段已額滿，請重新選擇");
      tx.update(slotRef,{booked:booked+1});
      tx.set(apptRef,{
        emp:{name:state.emp.name,dept:state.emp.dept,date:state.emp.date,time:state.emp.time},
        dependents:state.dependents.map(d=>({name:d.name,date:d.date,time:d.time})),
        email:state.user.email,
        totalPeople:1+state.dependents.length,
        createdAt:serverTimestamp()
      });
    });
  }catch(e){
    state.submitting=false;setLoading(false);
    state.errors={submit:e.message};
    state.emp.expanded=true;
    renderStep0();return;
  }

  // 眷屬各自扣名額
  for(const dep of state.dependents){
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
    }catch(e){
      failed.push(dep);
    }
  }

  state.confirmed={
    emp:{...state.emp},
    dependents:succeededDeps.map(d=>({name:d.name,date:d.date,time:d.time})),
    failed:failed.map(d=>({name:d.name,date:d.date,time:d.time}))
  };
  state.myAppt={...state.confirmed,emp:state.emp};
  state.step=1;
  state.submitting=false;setLoading(false);
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
