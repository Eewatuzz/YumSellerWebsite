import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  connectFirestoreEmulator,
  collection,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// -------------------------
// Global state
// -------------------------
const state = {
  promptPayNumber: "0812345678",
  allOrders: []
};

let db, auth;

// ใช้ appId แบบเดิมของพี่
const appId = (typeof __app_id !== "undefined" && __app_id) ? __app_id : "spicy-salad-shop-default";
const collectionPath = `artifacts/${appId}/public/data/orders`;

// -------------------------
// Firebase init
// -------------------------
async function initFirebase() {
  const firebaseConfig = {
    apiKey: "AIzaSyC8NakcfPvEb6ldYne6qhtWtuip3ypznYo",
    authDomain: "yumded7yarnnam.firebaseapp.com",
    projectId: "yumded7yarnnam",
    storageBucket: "yumded7yarnnam.firebasestorage.app",
    messagingSenderId: "412720248955",
    appId: "1:412720248955:web:a5b79f0c84668c81de8ade",
    measurementId: "G-XVK46QEB5F"
  };

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);

  // ต่อ emulator (เฉพาะตอน localhost)
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    console.log("Connected to local Auth and Firestore Emulators");
  }

  // สำคัญ: ตั้ง persistence เพื่อให้ refresh แล้วยังอยู่
  await setPersistence(auth, browserLocalPersistence);

  console.log("Firebase & Auth initialized successfully");
}

// -------------------------
// Staff check (พี่ใช้ staff/{uid} เหมือนเดิมได้)
// -------------------------
async function isStaff(uid) {
  const snap = await getDoc(doc(db, "staff", uid));
  return snap.exists();
}

// -------------------------
// UI helpers
// -------------------------
function showMerchantPanel() {
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("merchantPanel").style.display = "block";
}

function showLogin() {
  document.getElementById("merchantPanel").style.display = "none";
  document.getElementById("loginBox").style.display = "block";
}

// -------------------------
// Login / Logout
// -------------------------
async function loginStaff(email, password) {
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    const ok = await isStaff(cred.user.uid);
    if (!ok) {
      await signOut(auth);
      errEl.textContent = "บัญชีนี้ไม่มีสิทธิ์พนักงาน";
      return;
    }

    // ถ้าผ่าน จะถูก onAuthStateChanged จัดการ UI + listen ให้อีกที
  } catch (e) {
    errEl.textContent = e.message;
    console.error(e);
  }
}

async function logoutStaff() {
  await signOut(auth);
  showLogin();
}

// -------------------------
// Orders realtime
// -------------------------
function listenToOrders() {
  const noOrders = document.getElementById("no-orders-banner");

  const handleIncoming = (snapshot) => {
    const orders = [];
    snapshot.forEach((d) => orders.push(d.data()));

    // createdAt ของพี่เป็น string/number ก็ได้ แต่ขอให้ sort ได้
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    state.allOrders = orders;

    renderMerchantDashboard();
    if (noOrders) {
      if (orders.length === 0) noOrders.classList.remove("hidden");
      else noOrders.classList.add("hidden");
    }
  };

  const q = collection(db, collectionPath);
  onSnapshot(
    q,
    (snapshot) => handleIncoming(snapshot),
    (error) => {
      console.error("Firestore listening error:", error);
      showToast("⚠️ ไม่สามารถโหลดออเดอร์แบบ Real-time ได้", "error");
    }
  );
}

// ใช้ในปุ่มเปลี่ยนสถานะของพี่
window.updateOrderStatus = async function (orderId, newStatus) {
  try {
    const docRef = doc(db, collectionPath, orderId);
    await updateDoc(docRef, { status: newStatus });

    showToast(`🔔 อัปเดตออเดอร์ ${orderId} เป็น [${getStatusTextTh(newStatus)}] แล้ว`);
  } catch (err) {
    console.error("Failed to update status", err);
    showToast("❌ อัปเดตสถานะล้มเหลว", "error");
  }
};


// -------------------------------------------------------------
// เพิ่มฟังก์ชันสำหรับดึงข้อความภาษาไทย และ สีของ Badge สถานะยำ
// -------------------------------------------------------------
function getStatusBadge(status) {
    switch (status) {
        case 'pending':
            return `<span class="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="fa-solid fa-spinner animate-spin mr-1 text-[9px]"></i>รอตรวจสลิป</span>`;
        case 'preparing':
            return `<span class="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="fa-solid fa-fire-burner mr-1"></i>กำลังปรุงยำ</span>`;
        case 'completed':
            return `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="fa-solid fa-check mr-1"></i>เสร็จเรียบร้อย</span>`;
        case 'cancelled':
            return `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="fa-solid fa-xmark mr-1"></i>ยกเลิกแล้ว</span>`;
        default:
            return '';
    }
}

function getStatusTextTh(status) {
    switch (status) {
        case 'pending': return 'รอตรวจสลิป';
        case 'preparing': return 'กำลังปรุงยำ';
        case 'completed': return 'เสร็จเรียบร้อย';
        case 'cancelled': return 'ยกเลิกออเดอร์';
        default: return status;
    }
}

// เพิ่มเติม: ฟังก์ชันสำหรับการดูรูปสลิปขยายใหญ่ (แถมให้เผื่อยังไม่มีครับ)
window.zoomSlip = function(base64Data) {
    if (!base64Data) {
        showToast("⚠️ ไม่พบรูปภาพสลิปในออเดอร์นี้", "error");
        return;
    }
    const overlay = document.createElement('div');
    overlay.className = "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer";
    overlay.onclick = () => overlay.remove();
    overlay.innerHTML = `
        <div class="max-w-md w-full bg-white p-3 rounded-2xl shadow-2xl transform transition-all relative">
            <p class="text-xs font-bold text-slate-500 mb-2 text-center">📄 สลิปหลักฐานการโอนเงิน (คลิกที่ใดก็ได้เพื่อปิด)</p>
            <img src="${base64Data}" class="w-full h-auto max-h-[75vh] object-contain rounded-xl shadow-inner mx-auto" />
        </div>
    `;
    document.body.appendChild(overlay);
};

function renderMerchantDashboard() {
    const ordersList = document.getElementById('merchant-orders-list');
    const completedList = document.getElementById('merchant-completed-list');
    const noOrders = document.getElementById('no-orders-banner');

    // Counter statistics
    let countPending = 0;
    let countCompleted = 0;
    let sumSales = 0;

    let pendingHTML = '';
    let completedHTML = '';

    state.allOrders.forEach(o => {
        // Process totals
        if (o.status === 'completed') {
            countCompleted++;
            sumSales += o.totalPrice;
        } else if (o.status !== 'cancelled') {
            countPending++;
        }

        // Render Item
        const isCompleted = o.status === 'completed' || o.status === 'cancelled';
        const cardHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4 transition-all hover:shadow-md">
                <!-- Top details -->
                <div class="flex flex-wrap justify-between items-start gap-2 border-b pb-3">
                    <div>
                        <span class="bg-slate-100 text-slate-700 font-mono text-xs font-bold px-2.5 py-1 rounded">
                            ${o.orderId}
                        </span>
                        <span class="text-xs text-slate-400 ml-2">${new Date(o.createdAt).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.</span>
                    </div>
                    <div class="flex items-center space-x-1.5">
                        ${getStatusBadge(o.status)}
                    </div>
                </div>

                <!-- Customer contacts -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs md:text-sm">
                    <div>
                        <p class="text-slate-400 text-xs">ลูกค้า</p>
                        <p class="font-semibold text-slate-700">${o.customerName} <span class="text-slate-400 text-xs">(${o.phone})</span></p>
                    </div>
                    <div>
                        <p class="text-slate-400 text-xs">เวลาจัดส่ง/รับ</p>
                        <p class="font-semibold text-red-500 flex items-center">
                            <i class="fa-regular fa-clock mr-1 text-xs"></i> นัดรับเวลา: ${o.pickupTime} น.
                        </p>
                    </div>
                </div>

                <!-- Address -->
                <div class="text-xs md:text-sm bg-slate-50 p-2.5 rounded-xl">
                    <p class="text-slate-400 text-[10px]">สถานที่รับอาหาร</p>
                    <p class="text-slate-600 font-medium">${o.address}</p>
                </div>

                <!-- Salad contents specs -->
                <div class="border-t border-dashed pt-3">
                    <p class="text-slate-400 text-xs mb-1.5">รายการยำที่สั่ง</p>
                    <div class="bg-orange-50/20 p-3 rounded-xl border border-orange-100/50">
                        <p class="font-bold text-orange-800 text-sm">🥗 ยำ${o.base}</p>
                        <div class="flex flex-wrap gap-1 mt-1.5">
                            ${o.addons.length > 0 ? o.addons.map(a => `<span class="bg-white text-orange-700 border border-orange-200 text-xs px-2 py-0.5 rounded-full">${a}</span>`).join('') : '<span class="text-slate-400 text-xs">ไม่เพิ่มเครื่อง</span>'}
                        </div>
                        <div class="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-dashed border-orange-100">
                            <span class="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-md">🌶️ ${o.spiciness.split(' ')[0]}</span>
                            <span class="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-md">🍋 ${o.preference.split(' ')[0]}</span>
                        </div>
                        ${o.note && o.note !== 'ไม่มี' ? `<p class="text-xs text-red-500 font-medium mt-2 bg-red-50 p-1.5 rounded"><i class="fa-solid fa-comment-dots mr-1"></i>โน้ต: ${o.note}</p>` : ''}
                    </div>
                </div>

                <!-- Financial summary and Slip check -->
                <div class="flex flex-wrap items-center justify-between gap-4 pt-3 border-t">
                    <div>
                        <p class="text-slate-400 text-[10px]">ยอดเงินเก็บทั้งหมด</p>
                        <p class="text-xl font-bold text-slate-800">${o.totalPrice} บาท</p>
                    </div>

                    <!-- Slip view click -->
                    <div class="flex items-center space-x-3">
                        <button onclick="zoomSlip('${o.slipBase64}')" class="flex items-center space-x-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs px-3 py-1.5 rounded-lg transition-colors">
                            <i class="fa-solid fa-image text-slate-400"></i>
                            <span>ตรวจสอบสลิปโอน</span>
                        </button>

                        <!-- State transition selectors -->
                        ${!isCompleted ? `
                            <div class="flex items-center space-x-1">
                                ${o.status === 'pending' ? `
                                    <button onclick="updateOrderStatus('${o.orderId}', 'preparing')" class="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-all">
                                        เริ่มปรุงยำ
                                    </button>
                                ` : ''}
                                ${o.status === 'preparing' ? `
                                    <button onclick="updateOrderStatus('${o.orderId}', 'completed')" class="bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-all">
                                        ปรุงเสร็จ/จัดส่งเรียบร้อย
                                    </button>
                                ` : ''}
                                <button onclick="updateOrderStatus('${o.orderId}', 'cancelled')" class="hover:bg-red-50 text-red-500 text-xs font-semibold px-2 py-1.5 rounded-lg transition-all" title="ยกเลิกออเดอร์">
                                    ยกเลิก
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        if (isCompleted) {
            completedHTML += `
                <div class="bg-slate-50/50 hover:bg-slate-50 border p-3 rounded-xl text-xs space-y-1 relative">
                    <div class="flex justify-between font-semibold">
                        <span class="text-slate-700 font-mono">${o.orderId}</span>
                        <span class="text-green-600">${o.totalPrice}.-</span>
                    </div>
                    <p class="text-slate-500">${o.customerName} (${o.phone})</p>
                    <p class="text-slate-400 text-[10px]">ยำ${o.base} (${o.spiciness.split(' ')[0]})</p>
                    <div class="flex justify-between items-center pt-1 mt-1 border-t border-dashed">
                        <span class="text-[9px] text-slate-400">${new Date(o.createdAt).toLocaleDateString('th-TH')}</span>
                        ${getStatusBadge(o.status)}
                    </div>
                </div>
            `;
        } else {
            pendingHTML += cardHTML;
        }
    });

    // Handle UI banners visibility
    if (countPending === 0) {
        noOrders.classList.remove('hidden');
        ordersList.classList.add('hidden');
    } else {
        noOrders.classList.add('hidden');
        ordersList.classList.remove('hidden');
        ordersList.innerHTML = pendingHTML;
    }

    completedList.innerHTML = completedHTML || `<p class="text-xs text-slate-400 text-center py-4">ยังไม่มีรายการสำเร็จในวันนี้</p>`;

    // Update stats
    document.getElementById('merchant-stat-pending').innerText = countPending;
    document.getElementById('merchant-stat-completed').innerText = countCompleted;
    document.getElementById('merchant-stat-sales').innerText = sumSales.toLocaleString() + '.-';
    document.getElementById('completed-count').innerText = `${countCompleted} รายการ`;
}

// Custom high quality system toast notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const bgClass = type === 'success'
        ? 'bg-slate-900/95 border-l-4 border-emerald-500 text-emerald-400'
        : 'bg-red-950/95 border-l-4 border-red-500 text-red-400';

    toast.className = `p-4 rounded-xl shadow-xl flex items-center space-x-3 pointer-events-auto transition-all duration-300 transform translate-x-12 opacity-0 text-xs md:text-sm ${bgClass}`;
    toast.innerHTML = `
        <div>
            <span class="font-medium text-white">${message}</span>
        </div>
    `;

    container.appendChild(toast);

    // Trigger animation in
    setTimeout(() => {
        toast.classList.remove('translate-x-12', 'opacity-0');
    }, 10);

    // Trigger animation out and destroy
    setTimeout(() => {
        toast.classList.add('translate-x-12', 'opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// -------------------------
// Boot (สำคัญ: await initFirebase ก่อนผูก auth listener)
// -------------------------
window.addEventListener("load", async () => {
  await initFirebase();

  document.getElementById("loginBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    await loginStaff(email, password);
  });

  document.getElementById("logoutBtn")?.addEventListener("click", logoutStaff);

  let started = false;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showLogin();
      started = false;
      return;
    }

    const ok = await isStaff(user.uid);
    if (!ok) {
      await signOut(auth);
      showLogin();
      started = false;
      return;
    }

    showMerchantPanel();

    if (!started) {
      started = true;
      listenToOrders();
    }
  });
});


// -------------------------
// TODO: ฟังก์ชันที่พี่มีอยู่แล้ว (คงของเดิมได้)
// renderMerchantDashboard, showToast, getStatusTextTh, getStatusBadge, etc.
// -------------------------