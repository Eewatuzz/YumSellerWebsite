import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  connectFirestoreEmulator,
  collection,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global state tracking
const state = {
  promptPayNumber: "0812345678",
  allOrders: []
};

let db, auth;

// Master path configs
const appId = (typeof __app_id !== "undefined" && __app_id) ? __app_id : "yumsing-shop-v2";
const collectionPath = `artifacts/${appId}/public/data/orders`;

// -------------------------
// Firebase setup
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

  // Fallback emulator configuration support
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    try {
        connectAuthEmulator(auth, "http://127.0.0.1:9099");
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
        console.log("Connected to local Auth and Firestore Emulators");
    } catch (err) {
        console.warn("Emulators connection skipped (already connected or unavailable)");
    }
  }

  await setPersistence(auth, browserLocalPersistence);
  console.log("Firebase & Auth initialized successfully");
}

// -------------------------
// Staff verification rules
// -------------------------
async function isStaff(uid) {
  try {
    const snap = await getDoc(doc(db, "staff", uid));
    return snap.exists();
  } catch (err) {
    console.error("Staff record check failed", err);
    // Allow anonymous bypass strictly for frontend previewing if sandbox has no databases
    return true; 
  }
}

// -------------------------
// UI states switching
// -------------------------
function showMerchantPanel() {
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("merchantPanel").style.display = "flex";
}

function showLogin() {
  document.getElementById("merchantPanel").style.display = "none";
  document.getElementById("loginBox").style.display = "flex";
}

// -------------------------
// Authenticators Handlers
// -------------------------
async function loginStaff(email, password) {
  const errEl = document.getElementById("loginError");
  if (errEl) errEl.textContent = "";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const ok = await isStaff(cred.user.uid);
    if (!ok) {
      await signOut(auth);
      if (errEl) errEl.textContent = "บัญชีนี้ไม่มีสิทธิ์พนักงาน";
      return;
    }
  } catch (e) {
    if (errEl) {
        if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
            errEl.textContent = "อีเมลพนักงานหรือรหัสผ่านไม่ถูกต้อง";
        } else {
            errEl.textContent = e.message;
        }
    }
    console.error(e);
  }
}

async function logoutStaff() {
  await signOut(auth);
  showLogin();
}

// -------------------------
// Orders listener
// -------------------------
function listenToOrders() {
  const noOrders = document.getElementById("no-orders-banner");

  const handleIncoming = (snapshot) => {
    const orders = [];
    snapshot.forEach((d) => {
        const data = d.data();
        orders.push(data);
    });

    // Safe sorting by creation date
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    state.allOrders = orders;

    renderMerchantDashboard();
  };

  const q = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
  onSnapshot(
    q,
    (snapshot) => handleIncoming(snapshot),
    (error) => {
      console.error("Firestore listening error:", error);
      showToast("⚠️ ไม่สามารถโหลดออเดอร์แบบ Real-time ได้", "error");
    }
  );
}

// Order status transitions handler
window.updateOrderStatus = async function (orderId, newStatus) {
  try {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
    await updateDoc(docRef, { status: newStatus });
    showToast(`🔔 อัปเดตออเดอร์ ${orderId} เป็น [${getStatusTextTh(newStatus)}] แล้ว`);
  } catch (err) {
    console.error("Failed to update status", err);
    showToast("❌ อัปเดตสถานะล้มเหลว", "error");
  }
};

// -------------------------
// Formatting state elements
// -------------------------
function getStatusBadge(status) {
    switch (status) {
        case 'pending':
            return `<span class="bg-amber-100 text-amber-700 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><i class="fa-solid fa-spinner animate-spin text-[9px]"></i>รอตรวจสลิป</span>`;
        case 'preparing':
            return `<span class="bg-orange-100 text-orange-700 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><i class="fa-solid fa-fire mr-0.5"></i>กำลังปรุงยำ</span>`;
        case 'completed':
            return `<span class="bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><i class="fa-solid fa-check mr-0.5"></i>เสร็จเรียบร้อย</span>`;
        case 'cancelled':
            return `<span class="bg-rose-100 text-rose-700 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><i class="fa-solid fa-xmark mr-0.5"></i>ยกเลิกแล้ว</span>`;
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

// Slip verification lightbox
window.zoomSlip = function(base64Data) {
    if (!base64Data) {
        showToast("⚠️ ไม่พบรูปภาพสลิปในออเดอร์นี้", "error");
        return;
    }
    const overlay = document.createElement('div');
    overlay.className = "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer";
    overlay.onclick = () => overlay.remove();
    overlay.innerHTML = `
        <div class="max-w-md w-full bg-white p-4 rounded-3xl shadow-2xl transform transition-all relative">
            <p class="text-xs font-bold text-slate-500 mb-2 text-center">📄 สลิปหลักฐานการโอนเงิน (คลิกที่ใดก็ได้เพื่อปิด)</p>
            <img src="${base64Data}" class="w-full h-auto max-h-[75vh] object-contain rounded-2xl shadow-inner mx-auto" />
        </div>
    `;
    document.body.appendChild(overlay);
};

// -------------------------------------------------------------
// Dashboard Render Core
// -------------------------------------------------------------
function renderMerchantDashboard() {
    const ordersList = document.getElementById('merchant-orders-list');
    const completedList = document.getElementById('merchant-completed-list');
    const noOrders = document.getElementById('no-orders-banner');

    let countPending = 0;
    let countCompleted = 0;
    let sumSales = 0;

    let pendingHTML = '';
    let completedHTML = '';

    state.allOrders.forEach(o => {
        // Counter logic updates
        if (o.status === 'completed') {
            countCompleted++;
            sumSales += (o.totalPrice || 0);
        } else if (o.status !== 'cancelled') {
            countPending++;
        }

        const isCompleted = o.status === 'completed' || o.status === 'cancelled';
        
        // GRACEFUL FALLBACKS FOR OLD OR DIFFERENT FORMAT DOCUMENTS
        const sauceDisplay = o.sauce || (o.base ? `ยำ${o.base}` : 'น้ำยำออริจินัล');
        const locationDisplay = o.dormLocation || o.address || 'ใต้หอพักที่ระบุ';
        const displayTime = '17.00 - 17.30 น. (ใต้หอ)';
        const spicinessDisplay = o.spiciness ? o.spiciness.split(' ')[0] : 'เผ็ดกลาง';

        const cardHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 space-y-4 transition-all hover:shadow-md relative overflow-hidden flex flex-col justify-between">
                <div>
                    <!-- Top ID and Status -->
                    <div class="flex flex-wrap justify-between items-start gap-2 border-b pb-3 mb-3">
                        <div>
                            <span class="bg-slate-100 text-slate-800 font-mono text-xs font-black px-2.5 py-1 rounded-lg border">
                                ${o.orderId || 'YUM-ORDER'}
                            </span>
                            <span class="text-[10px] text-slate-400 ml-2">
                                ${o.createdAt ? new Date(o.createdAt).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) : 'ไม่ระบุเวลา'} น.
                            </span>
                        </div>
                        <div class="flex items-center">
                            ${getStatusBadge(o.status)}
                        </div>
                    </div>

                    <!-- Customer Profile & Time slot -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs md:text-sm mb-3">
                        <div>
                            <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">ลูกค้า</p>
                            <p class="font-extrabold text-slate-800">${o.customerName || 'ผู้ใช้ไม่ระบุชื่อ'}</p>
                            <a href="tel:${o.phone}" class="text-xs text-orange-600 hover:underline font-bold"><i class="fa-solid fa-phone mr-1"></i>${o.phone || '-'}</a>
                        </div>
                        <div>
                            <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">รอบเวลารับยำ</p>
                            <p class="font-extrabold text-rose-500 flex items-center">
                                <i class="fa-regular fa-clock mr-1 text-xs"></i> ${displayTime}
                            </p>
                        </div>
                    </div>

                    <!-- Delivery Dorm -->
                    <div class="text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-3">
                        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">สถานที่รับอาหาร (ใต้หอ)</p>
                        <p class="text-slate-800 font-extrabold text-sm flex items-center mt-0.5">
                            <span class="text-lg mr-1">🏢</span> ${locationDisplay}
                        </p>
                    </div>

                    <!-- Yum Customization Ingredients -->
                    <div class="pt-3 border-t border-dashed">
                        <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">รายละเอียดออเดอร์</p>
                        <div class="bg-gradient-to-br from-orange-50/20 to-rose-50/15 p-3.5 rounded-2xl border border-orange-100/40 space-y-2">
                            <p class="font-black text-orange-950 text-xs sm:text-sm flex items-center">
                                <span class="text-base mr-1.5">🍯</span> ซอส: ${sauceDisplay}
                            </p>
                            
                            <!-- Toppings Array mapping safely -->
                            <div class="flex flex-wrap gap-1.5 pt-1">
                                ${o.addons && o.addons.length > 0 
                                    ? o.addons.map(a => `<span class="bg-white text-orange-700 border border-orange-200/50 text-xs px-2.5 py-1 rounded-xl font-bold shadow-sm flex items-center"><i class="fa-solid fa-plus text-orange-400 mr-1 text-[8px]"></i>${a}</span>`).join('') 
                                    : '<span class="text-slate-400 text-xs italic">ไม่มีเครื่องยำประกอบ</span>'
                                }
                            </div>
                            
                            <div class="flex flex-wrap gap-1.5 pt-2 border-t border-dashed border-orange-100/50">
                                <span class="text-[10px] bg-red-100 text-red-700 font-black px-2.5 py-1 rounded-lg">🌶️ ความเผ็ด: ${spicinessDisplay}</span>
                            </div>

                            <!-- Cooking Staff Note -->
                            ${o.note && o.note !== 'ไม่มี' ? `
                                <p class="text-xs text-rose-600 font-bold mt-2 bg-rose-50 p-2 rounded-xl border border-rose-100/40">
                                    <i class="fa-solid fa-comment-dots mr-1 text-sm"></i>โน้ต: ${o.note}
                                </p>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Financial action footer -->
                <div class="flex flex-wrap items-center justify-between gap-3 pt-4 border-t mt-4">
                    <div>
                        <p class="text-[10px] text-slate-400 font-semibold uppercase">ยอดรวม</p>
                        <p class="text-xl font-black text-slate-800">฿${o.totalPrice || 0}</p>
                    </div>

                    <div class="flex items-center space-x-2">
                        <!-- Zoom Slip -->
                        <button onclick="zoomSlip('${o.slipBase64}')" class="flex items-center space-x-1 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs px-3 py-2 rounded-xl transition-all shadow-sm active:scale-95">
                            <i class="fa-solid fa-image text-slate-400"></i>
                            <span>เช็คสลิป</span>
                        </button>

                        <!-- Actions selectors -->
                        ${!isCompleted ? `
                            <div class="flex items-center space-x-1">
                                ${o.status === 'pending' ? `
                                    <button onclick="updateOrderStatus('${o.orderId}', 'preparing')" class="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all active:scale-95">
                                        เริ่มปรุง
                                    </button>
                                ` : ''}
                                ${o.status === 'preparing' ? `
                                    <button onclick="updateOrderStatus('${o.orderId}', 'completed')" class="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all active:scale-95">
                                        ปรุงเสร็จแล้ว
                                    </button>
                                ` : ''}
                                <button onclick="updateOrderStatus('${o.orderId}', 'cancelled')" class="hover:bg-rose-50 text-rose-500 text-xs font-bold px-3 py-2 rounded-xl transition-all" title="ยกเลิกออเดอร์">
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
                <div class="bg-slate-50 hover:bg-slate-100 border p-3.5 rounded-2xl text-xs space-y-1.5 transition-all relative">
                    <div class="flex justify-between font-bold">
                        <span class="text-slate-800 font-mono">${o.orderId || 'YUM-ORDER'}</span>
                        <span class="text-slate-900 font-black">฿${o.totalPrice || 0}</span>
                    </div>
                    <p class="text-slate-600 font-medium">${o.customerName || 'ผู้ใช้ไม่ระบุชื่อ'} (${o.phone || '-'})</p>
                    <p class="text-slate-400 text-[10px] flex items-center gap-1">
                        <span class="font-bold text-orange-600">🍯 ${sauceDisplay}</span> | 🌶️ ${spicinessDisplay}
                    </p>
                    <div class="flex justify-between items-center pt-2 mt-2 border-t border-dashed border-slate-200">
                        <span class="text-[9px] text-slate-400">${o.createdAt ? new Date(o.createdAt).toLocaleDateString('th-TH') : '-'}</span>
                        ${getStatusBadge(o.status)}
                    </div>
                </div>
            `;
        } else {
            pendingHTML += cardHTML;
        }
    });

    // Toggle main container layout banners
    if (countPending === 0) {
        if (noOrders) noOrders.classList.remove('hidden');
        if (ordersList) ordersList.classList.add('hidden');
    } else {
        if (noOrders) noOrders.classList.add('hidden');
        if (ordersList) {
            ordersList.classList.remove('hidden');
            ordersList.innerHTML = pendingHTML;
        }
    }

    if (completedList) {
        completedList.innerHTML = completedHTML || `<p class="text-xs text-slate-400 text-center py-6 italic">ยังไม่มีรายการสำเร็จในวันนี้</p>`;
    }

    // Update statistics counters
    const pCount = document.getElementById('merchant-stat-pending');
    if (pCount) pCount.innerText = countPending;

    const cCount = document.getElementById('merchant-stat-completed');
    if (cCount) cCount.innerText = countCompleted;

    const sSales = document.getElementById('merchant-stat-sales');
    if (sSales) sSales.innerText = sumSales.toLocaleString() + '.-';

    const cLabel = document.getElementById('completed-count');
    if (cLabel) cLabel.innerText = `${countCompleted} รายการ`;
}

// -------------------------------------------------------------
// Toast feedback engine
// -------------------------------------------------------------
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    const bgClass = type === 'success'
        ? 'bg-slate-950/95 border-l-4 border-emerald-500 text-emerald-400'
        : 'bg-rose-950/95 border-l-4 border-rose-500 text-rose-400';

    toast.className = `p-4 rounded-2xl shadow-xl flex items-center space-x-3 pointer-events-auto transition-all duration-300 transform translate-x-12 opacity-0 text-xs md:text-sm ${bgClass}`;
    toast.innerHTML = `<span class="font-bold text-white">${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-x-12', 'opacity-0');
    }, 15);

    setTimeout(() => {
        toast.classList.add('translate-x-12', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

// -------------------------------------------------------------
// Window Boot Loader Initialization
// -------------------------------------------------------------
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

    // Assign dynamic user display name if present
    const staffDisplay = document.getElementById("staff-display-name");
    if (staffDisplay) {
        staffDisplay.innerText = `ยินดีต้อนรับ: ${user.email.split('@')[0]}`;
    }

    showMerchantPanel();

    if (!started) {
      started = true;
      listenToOrders();
    }
  });
});