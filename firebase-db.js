// =============================================
// firebase-db.js
// Firestore 所有讀寫操作集中在這裡
// =============================================

import { app } from "./firebase-config.js";
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  runTransaction,
  setDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const db = getFirestore(app);

// ── 時段資料 ──────────────────────────────────
const SLOTS_DATA = {
  "2025-07-18": [
    { time: "07:30", limit: 2 }, { time: "07:45", limit: 4 },
    { time: "08:00", limit: 9 }, { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-07-19": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-07-25": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-07-26": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-08-01": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-08-02": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-08-08": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-08-09": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-08-15": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-08-16": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-08-22": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-08-23": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-08-29": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-08-30": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-09-05": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 2 }, { time: "09:30", limit: 5 }
  ],
  "2025-09-06": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-09-12": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 6 }, { time: "09:30", limit: 4 }
  ],
  "2025-09-13": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-09-19": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-09-20": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-09-26": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
  "2025-09-27": [
    { time: "07:45", limit: 5 }, { time: "08:00", limit: 10 },
    { time: "09:00", limit: 5 }, { time: "09:30", limit: 5 }
  ],
};

// ── 即時監聽所有時段名額 ──────────────────────
export function listenSlots(callback) {
  const ref = collection(db, "slots");
  return onSnapshot(ref, (snapshot) => {
    const map = {};
    snapshot.forEach((d) => {
      const { date, time, booked } = d.data();
      if (!map[date]) map[date] = {};
      map[date][time] = booked;
    });
    callback(map);
  });
}

// ── 送出預約（Transaction 防止超訂）──────────
export async function submitAppointment(payload) {
  const { date, time, dept, empName, dependents } = payload;
  const totalPeople = 1 + dependents.length;
  const slotId  = `${date}_${time.replace(":", "")}`;
  const slotRef = doc(db, "slots", slotId);
  const apptCol = collection(db, "appointments");

  try {
    await runTransaction(db, async (tx) => {
      const slotSnap = await tx.get(slotRef);
      if (!slotSnap.exists()) throw new Error("查無此時段");
      const { booked, limit } = slotSnap.data();
      if (booked + totalPeople > limit) {
        throw new Error(`名額不足（剩餘 ${limit - booked} 位，您需要 ${totalPeople} 位）`);
      }
      tx.update(slotRef, { booked: booked + totalPeople });
      const apptRef = doc(apptCol);
      tx.set(apptRef, {
        date, time, dept, empName, dependents,
        totalPeople, createdAt: serverTimestamp()
      });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

// ── 初始化時段資料（只需執行一次）─────────────
async function initSlots() {
  let count = 0;
  for (const [date, slots] of Object.entries(SLOTS_DATA)) {
    for (const slot of slots) {
      const id = `${date}_${slot.time.replace(":", "")}`;
      await setDoc(doc(db, "slots", id), {
        date,
        time: slot.time,
        limit: slot.limit,
        booked: 0
      });
      count++;
      console.log(`寫入 ${date} ${slot.time}...`);
    }
  }
  console.log(`✅ 初始化完成，共寫入 ${count} 個時段`);
}

window.initSlots = initSlots;
