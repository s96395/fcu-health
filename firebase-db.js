// =============================================
// firebase-db.js
// Firestore 所有讀寫操作集中在這裡
// =============================================

import { app } from "./firebase-config.js";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  onSnapshot,
  runTransaction,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const db = getFirestore(app);

// ── 即時監聽所有時段名額 ──────────────────────
// callback(bookedMap) 每次有變動就觸發
// bookedMap 格式：{ "2025-07-18": { "07:30": 1, "07:45": 0 }, ... }
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

// ── 送出預約（Transaction 原子操作，防止超訂）──
// payload: { date, time, dept, empName, dependents[] }
// 回傳 { ok: true } 或 { ok: false, message: "錯誤訊息" }
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

      // 更新已預約人數
      tx.update(slotRef, { booked: booked + totalPeople });

      // 新增預約紀錄
      const apptRef = doc(apptCol);
      tx.set(apptRef, {
        date,
        time,
        dept,
        empName,
        dependents,       // 眷屬姓名陣列
        totalPeople,
        createdAt: serverTimestamp()
      });
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

// ── 初始化時段資料（只需執行一次）─────────────
// 在 browser console 執行：initSlots() 即可
import { setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

export async function initSlots() {
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
    }
  }
  console.log(`✅ 初始化完成，共寫入 ${count} 個時段`);
}

// 掛到 window 方便 console 執行
window.initSlots = initSlots;
