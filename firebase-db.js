import { app } from "./firebase-config.js";
import {
  getFirestore, doc, collection,
  onSnapshot, runTransaction, setDoc, getDocs, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export const db   = getFirestore(app);
export const auth = getAuth(app);

// ── 管理員清單 ────────────────────────────────
export const ADMIN_LIST = [
  "aaronhsu@gis.fcu.edu.tw",
  "yoyoshen@gis.fcu.edu.tw",
  "sheena@geosense.tw",
  "minnie@gis.fcu.edu.tw",
  "novia@gis.fcu.edu.tw",
  "rexyang@gis.fcu.edu.tw",
  "jillhuang@gis.fcu.edu.tw",
];

export function isAdmin(email) {
  return ADMIN_LIST.includes(email?.toLowerCase());
}

// ── Google 登入 ───────────────────────────────
export async function googleLogin() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: "gis.fcu.edu.tw" });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function googleLogout() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── 即時監聽時段名額 ──────────────────────────
export function listenSlots(callback) {
  return onSnapshot(collection(db, "slots"), (snapshot) => {
    const map = {};
    snapshot.forEach((d) => {
      const { date, time, booked } = d.data();
      if (!map[date]) map[date] = {};
      map[date][time] = booked;
    });
    callback(map);
  });
}

// ── 查詢此帳號是否已預約 ──────────────────────
export async function getMyAppointment(email) {
  const snap = await getDocs(collection(db, "appointments"));
  const found = snap.docs.find(d => d.data().email === email);
  return found ? { id: found.id, ...found.data() } : null;
}

// ── 送出預約 ──────────────────────────────────
export async function submitAppointment(payload) {
  const { date, time, dept, empName, dependents, email } = payload;
  const totalPeople = 1 + dependents.length;
  const slotId  = `${date}_${time.replace(":", "")}`;
  const slotRef = doc(db, "slots", slotId);
  const apptRef = doc(collection(db, "appointments"));

  try {
    // 先檢查是否已預約
    const existing = await getMyAppointment(email);
    if (existing) throw new Error("您已經預約過了，如需更改請聯絡福委");

    await runTransaction(db, async (tx) => {
      const slotSnap = await tx.get(slotRef);
      if (!slotSnap.exists()) throw new Error("查無此時段");
      const { booked, limit } = slotSnap.data();
      if (booked + totalPeople > limit) {
        throw new Error(`名額不足（剩餘 ${limit - booked} 位，您需要 ${totalPeople} 位）`);
      }
      tx.update(slotRef, { booked: booked + totalPeople });
      tx.set(apptRef, {
        date, time, dept, empName, dependents,
        totalPeople, email, createdAt: serverTimestamp()
      });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

// ── 取得所有預約（後台用）────────────────────
export async function getAllAppointments() {
  const snap = await getDocs(collection(db, "appointments"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── 刪除預約並還原名額 ────────────────────────
export async function deleteAppointment(appt) {
  const slotId  = `${appt.date}_${appt.time.replace(":", "")}`;
  const slotRef = doc(db, "slots", slotId);
  const apptRef = doc(db, "appointments", appt.id);

  await runTransaction(db, async (tx) => {
    const slotSnap = await tx.get(slotRef);
    if (slotSnap.exists()) {
      const booked = slotSnap.data().booked - appt.totalPeople;
      tx.update(slotRef, { booked: Math.max(0, booked) });
    }
    tx.delete(apptRef);
  });
}

// ── 初始化時段資料 ────────────────────────────
const SLOTS_DATA = {
  "2026-07-18": [
    { time: "07:30", limit: 2 }, { time: "07:45", limit: 4 },
    { time: "08:00", limit: 9 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
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

export async function initSlots() {
  // 先刪除所有舊資料
  const snap = await getDocs(collection(db, "slots"));
  for (const d of snap.docs) await deleteDoc(d.ref);
  console.log("舊資料清除完成");

  let count = 0;
  for (const [date, slots] of Object.entries(SLOTS_DATA)) {
    for (const slot of slots) {
      const id = `${date}_${slot.time.replace(":", "")}`;
      await setDoc(doc(db, "slots", id), { date, time: slot.time, limit: slot.limit, booked: 0 });
      count++;
      console.log(`✓ ${date} ${slot.time}`);
    }
  }
  console.log(`✅ 初始化完成，共寫入 ${count} 個時段`);
}
window.initSlots = initSlots;
