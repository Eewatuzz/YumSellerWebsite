import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Application Master Configuration & State
const state = {
    currentStep: 1,
    promptPayNumber: '0812345678', // Shop's PromptPay Phone Number
    order: {
        sauce: 'น้ำยำออริจินัล', // Default selected sauce
        addons: [],            // List of selected ingredients { name: string, price: number, quantity: number }
        spiciness: 'เผ็ดกลาง', // Spicy level default
        custName: '',          // Customer name
        custPhone: '',         // Customer phone number
        dormLocation: '',      // Selectable location (หอหญิง 1 or หอชาย 4 or รับหน้าร้าน)
        note: '',              // Cooking notes
        slipBase64: '',        // Encoded proof slip image
        totalPrice: 0,         // Calculated dynamically
    }
};

// Define updated menu structures requested by user
const SAUCE_OPTIONS = [
    { id: 'sauce-original', name: 'น้ำยำออริจินัล', desc: 'ครบรส หอมเปรี้ยวมะนาวสด' },
    { id: 'sauce-plara', name: 'น้ำยำปลาร้าเลิฟเวอร์', desc: 'นัวขั้นสุด หอมกลิ่นปลาร้าเกรดพรีเมียม' },
    { id: 'sauce-seafood', name: 'น้ำยำซีฟู้ดจี๊ดๆ', desc: 'รสแซ่บจี๊ดจ๊าด สะใจสายเผ็ดเปรี้ยว' },
    { id: 'sauce-not-accepted', name: 'ไม่รับน้ำยำ', desc: 'ตัวแม่จะแคร์เพื่อ?!?' }
];

const INGREDIENTS_LIST = [
    { id: 'lookchin-moo', name: 'ลูกชิ้นหมู', price: 7, icon: '🍢' },
    { id: 'crab-stick', name: 'ปูอัด', price: 7, icon: '🦀' },
    { id: 'shrimp', name: 'กุ้ง', price: 15, icon: '🦐' },
    { id: 'moo-yor', name: 'หมูยอ', price: 10, icon: '🍥' },
    { id: 'fish-tofu', name: 'เต้าหู้ปลา', price: 10, icon: '⏹️' },
    { id: 'wakame-mushroom', name: 'สาหร่ายวากาเมะพันเห็ดเข็มทอง', price: 15, icon: '🍄' },
    { id: 'sausage-normal', name: 'ไส้กรอกปกติ', price: 7, icon: '🌭' },
    { id: 'cheese-tofu', name: 'เต้าหู้ชีส', price: 10, icon: '🧀' },
    { id: 'salted-egg', name: 'ไข่แดงเค็ม', price: 15, icon: '🍳' },
    { id: 'wonton', name: 'เกี๊ยว', price: 10, icon: '🥟' },
    { id: 'cheese-sausage', name: 'ไส้กรอกชีส', price: 10, icon: '🌭' },
    { id: 'sausage-red', name: 'ไส้กรอกแดง(ทอด)', price: 10, icon: '🌭' },
    { id: 'nuggets', name: 'นักเก็ต', price: 10, icon: '🍗' },
    { id: 'chicken-pop', name: 'ไก่ป๊อป', price: 10, icon: '🍿' },
    { id: 'pork-belly', name: 'หมูสามชั้น', price: 10, icon: '🥓' }
];

const SPICY_LEVELS = [
    { label: 'ไม่เผ็ด', desc: 'สำหรับคนไม่ทานเผ็ดเลย❌'},
    { label: 'เผ็ดน้อย', desc: 'เผ็ดเด็กน้อย👶' },
    { label: 'เผ็ดกลาง', desc: 'เผ็ดปานกลาง😘' },
    { label: 'เผ็ดมาก', desc: 'เผ็ดนรกแตก💔' }
];

let db, auth;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'yumsing-shop-v2';
const collectionPath = `artifacts/${appId}/public/data/orders`;

async function initFirebase() {
  try {
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

    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        connectAuthEmulator(auth, "http://127.0.0.1:9099");
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
        console.log("Connected to local Auth and Firestore Emulators");
    }
    await signInAnonymously(auth);

    console.log("Firebase & Auth initialized successfully");
  } catch (err) {
    console.error("Firebase init failed.", err);
  }
}

function renderInterface() {
    // 1. Render Sauce Options (น้ำยำ)
    const sauceContainer = document.getElementById('sauce-container');
    if (sauceContainer) {
        sauceContainer.innerHTML = SAUCE_OPTIONS.map(s => {
            const isSelected = state.order.sauce === s.name;
            return `
                <button onclick="selectSauce('${s.name}')" class="p-4 border-2 rounded-2xl text-left transition-all duration-200 flex flex-col justify-between ${isSelected ? 'border-orange-500 bg-orange-50/50 text-orange-800 font-bold ring-2 ring-orange-500/10' : 'border-slate-100 hover:border-slate-300 bg-slate-50 text-slate-700'}">
                    <div class="flex items-center space-x-2.5 mb-1">
                        <span class="w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'}">
                            ${isSelected ? '<span class="w-1.5 h-1.5 rounded-full bg-white"></span>' : ''}
                        </span>
                        <span class="text-sm font-semibold">${s.name}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 font-normal pl-6">${s.desc}</p>
                </button>
            `;
        }).join('');
    }

    // 2. Render Topping Ingredients (เครื่องยำ)
    const ingredientsContainer = document.getElementById('ingredients-container');
    if (ingredientsContainer) {
        ingredientsContainer.innerHTML = INGREDIENTS_LIST.map(item => {
            const currentSelected = state.order.addons.find(a => a.name === item.name);
            const qty = currentSelected ? currentSelected.quantity : 0;
            const hasSelection = qty > 0;

            return `
                <div class="p-3.5 border rounded-2xl flex items-center justify-between text-left transition-all duration-200 ${hasSelection ? 'border-orange-400 bg-orange-50/30 text-orange-800 font-bold' : 'border-slate-100 hover:border-slate-200 text-slate-700'}">
                    <div class="flex items-center space-x-3">
                        <span class="text-2xl">${item.icon}</span>
                        <div class="flex flex-col">
                            <span class="text-xs md:text-sm">${item.name}</span>
                            <span class="text-[10px] text-orange-600 font-semibold">${item.price} บาท/ไม้</span>
                        </div>
                    </div>

                    <!-- Increment Decrement Buttons -->
                    <div class="flex items-center space-x-2">
                        ${qty > 0 ? `
                            <button onclick="updateAddonQty('${item.name}', ${item.price}, -1)" class="w-7 h-7 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-full flex items-center justify-center font-bold text-sm focus:outline-none shadow-sm">
                                -
                            </button>
                            <span class="text-sm font-bold text-slate-800 w-4 text-center">${qty}</span>
                        ` : ''}
                        <button onclick="updateAddonQty('${item.name}', ${item.price}, 1)" class="w-7 h-7 ${hasSelection ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'} rounded-full flex items-center justify-center font-bold text-sm focus:outline-none shadow-sm">
                            +
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 3. Render Spicy levels selector
    const spicyContainer = document.getElementById('spicy-container');
    if (spicyContainer) {
        spicyContainer.innerHTML = SPICY_LEVELS.map(s => {
            const isSelected = state.order.spiciness === s.label;
            return `
                <button onclick="selectSpiciness('${s.label}')" class="p-3 rounded-2xl border text-center transition-all ${isSelected ? 'border-red-500 bg-red-50 text-red-700 font-bold ring-2 ring-red-500/10' : 'border-slate-100 hover:border-slate-200 bg-slate-50 text-slate-600'}">
                    <span class="text-xs md:text-sm block font-bold">${s.label}</span>
                    <span class="text-[9px] opacity-75">${s.desc}</span>
                </button>
            `;
        }).join('');
    }

    updatePricingCalculations();
}

window.selectSauce = function(sauceName) {
    state.order.sauce = sauceName;
    renderInterface();
};

window.updateAddonQty = function(addonName, price, delta) {
    const foundIndex = state.order.addons.findIndex(a => a.name === addonName);
    if (foundIndex > -1) {
        const addon = state.order.addons[foundIndex];
        addon.quantity += delta;
        if (addon.quantity <= 0) {
            state.order.addons.splice(foundIndex, 1);
        }
    } else if (delta > 0) {
        state.order.addons.push({ name: addonName, price: price, quantity: 1 });
    }
    renderInterface();
};

window.selectSpiciness = function(spicyLevel) {
    state.order.spiciness = spicyLevel;
    renderInterface();
};

window.resetSaladState = function() {
    state.order.addons = [];
    state.order.spiciness = 'เผ็ดกลาง';
    renderInterface();
    showToast('🔄 รีเซ็ตค่าเริ่มต้นเครื่องยำเรียบร้อยแล้ว');
};

window.selectDormLocation = function(locationName) {
    state.order.dormLocation = locationName;
    const btnFemale = document.getElementById('btn-dorm-female1');
    const btnMale = document.getElementById('btn-dorm-male4');
    const btnStore = document.getElementById('btn-dorm-store');

    if (locationName === 'หอหญิง 1') {
        if (btnFemale) btnFemale.className = "p-4 border-2 rounded-2xl text-center font-bold transition-all duration-200 border-orange-500 bg-orange-50 text-orange-800 ring-2 ring-orange-500/15";
        if (btnMale) btnMale.className = "p-4 border-2 rounded-2xl text-center font-bold transition-all duration-200 border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50";
        if (btnStore) btnStore.className = "p-4 border-2 rounded-2xl text-center font-bold transition-all duration-200 border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50";
    } 
    else if (locationName === 'หอชาย 4') {
        if (btnMale) btnMale.className = "p-4 border-2 rounded-2xl text-center font-bold transition-all duration-200 border-orange-500 bg-orange-50 text-orange-800 ring-2 ring-orange-500/15";
        if (btnFemale) btnFemale.className = "p-4 border-2 rounded-2xl text-center font-bold transition-all duration-200 border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50";
        if (btnStore) btnStore.className = "p-4 border-2 rounded-2xl text-center font-bold transition-all duration-200 border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50";
    }
    else if (locationName === 'รับหน้าร้าน') {
        if (btnMale) btnMale.className = "p-4 border-2 rounded-2xl text-center font-bold transition-all duration-200 border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50";
        if (btnFemale) btnFemale.className = "p-4 border-2 rounded-2xl text-center font-bold transition-all duration-200 border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50";
        if (btnStore) btnStore.className = "p-4 border-2 rounded-2xl text-center font-bold transition-all duration-200 border-orange-500 bg-orange-50 text-orange-800 ring-2 ring-orange-500/15";
    }

    // คำนวณราคาใหม่ทันทีเมื่อเปลี่ยนสถานที่รับอาหาร
    updatePricingCalculations();
};

function updatePricingCalculations() {
    // ผลรวมของเครื่องยำที่เลือกทั้งหมด
    const addonsSum = state.order.addons.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    
    // ตั้งค่าค่าจัดส่งเป็น 0 เมื่อเลือก "รับหน้าร้าน" และเป็น 5 บาทเมื่อเลือกส่งที่หอพัก
    let deliveryFee = 5;
    if (state.order.dormLocation === 'รับหน้าร้าน') {
        deliveryFee = 0;
    }

    const grandTotal = addonsSum + deliveryFee;
    state.order.totalPrice = grandTotal;

    // DOM Updates safely
    const cartSummaryPrice = document.getElementById('cart-summary-price');
    if (cartSummaryPrice) cartSummaryPrice.innerText = addonsSum;

    const cartGrandTotal = document.getElementById('cart-grand-total');
    if (cartGrandTotal) cartGrandTotal.innerText = grandTotal;

    const paymentPriceDisplay = document.getElementById('payment-price-display');
    if (paymentPriceDisplay) paymentPriceDisplay.innerText = grandTotal;

    const addonPriceLabel = document.getElementById('addon-price-label');
    if (addonPriceLabel) addonPriceLabel.innerText = `${addonsSum} บาท`;

    const deliveryPriceLabel = document.getElementById('delivery-price-label');
    if (deliveryPriceLabel) {
        deliveryPriceLabel.innerText = deliveryFee === 0 ? 'ฟรี (รับเองหน้าร้าน)' : `${deliveryFee} บาท`;
    }

    // Dynamic Receipt Render on step 2
    const receiptSauce = document.getElementById('receipt-sauce');
    if (receiptSauce) {
        receiptSauce.innerHTML = `
            <div class="flex justify-between items-center text-xs">
                <span class="font-bold text-orange-800">🍯 ${state.order.sauce}</span>
                <span class="text-green-600 font-extrabold text-[10px] bg-green-50 px-2 py-0.5 rounded-full">ฟรีค่าน้ำยำ</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-1">
                <span class="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded-md font-bold">🌶️ ความเผ็ด: ${state.order.spiciness}</span>
            </div>
        `;
    }

    const cartList = document.getElementById('cart-list');
    if (cartList) {
        if (state.order.addons.length > 0) {
            cartList.innerHTML = state.order.addons.map(a => `
                <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-600">
                        <i class="fa-solid fa-plus text-orange-400 mr-1.5 text-[8px]"></i>
                        ${a.name} <span class="text-orange-600 font-bold">x${a.quantity}</span>
                    </span>
                    <span class="text-slate-400 font-medium">${a.price * a.quantity}.-</span>
                </div>
            `).join('');
        } else {
            cartList.innerHTML = `<p class="text-[11px] text-slate-400 italic text-center py-2">ยังไม่ได้เลือกเครื่องยำเพิ่มเติม</p>`;
        }
    }
}

window.goToStep = function(targetStep) {
    if (targetStep === 2) {
        // Validation: Must select at least one ingredient to proceed
        if (state.order.addons.length === 0) {
            showToast('⚠️ กรุณาเลือกเครื่องยำอย่างน้อย 1 รายการก่อนดำเนินการต่อค่ะ', 'error');
            return;
        }

        // Display Step 2
        document.getElementById('customer-step-1').classList.add('hidden');
        document.getElementById('customer-step-2').classList.remove('hidden');
        document.getElementById('customer-step-3').classList.add('hidden');
        
        // Update Indicator
        const indicator = document.getElementById('step-indicator');
        if (indicator) {
            indicator.innerHTML = `
                <span class="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold animate-pulse">2</span>
                <span>ข้อมูลจัดส่งและการรับอาหาร</span>
            `;
        }
        
        state.currentStep = 2;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (targetStep === 3) {
        // Validation: Verify details
        const nameVal = document.getElementById('cust-name').value.trim();
        const phoneVal = document.getElementById('cust-phone').value.trim();

        if (!state.order.dormLocation) {
            showToast('⚠️ กรุณาเลือกสถานที่จัดส่ง/รับอาหาร (หอหญิง 1, หอชาย 4 หรือ รับหน้าร้าน)', 'error');
            return;
        }
        if (!nameVal) {
            showToast('⚠️ กรุณาระบุชื่อผู้สั่งซื้ออาหาร', 'error');
            return;
        }
        if (!phoneVal || phoneVal.length < 9) {
            showToast('⚠️ กรุณาระบุเบอร์โทรศัพท์ที่ติดต่อได้ถูกต้อง', 'error');
            return;
        }

        // Commit fields to state
        state.order.custName = nameVal;
        state.order.custPhone = phoneVal;
        state.order.note = document.getElementById('cust-note').value.trim();

        // Render Step 3
        document.getElementById('customer-step-1').classList.add('hidden');
        document.getElementById('customer-step-2').classList.add('hidden');
        document.getElementById('customer-step-3').classList.remove('hidden');

        const indicator = document.getElementById('step-indicator');
        if (indicator) {
            indicator.innerHTML = `
                <span class="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold animate-pulse">3</span>
                <span>ชำระเงินและแจ้งโอน</span>
            `;
        }

        state.currentStep = 3;
        generatePromptPayQR();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        // Back to Step 1
        document.getElementById('customer-step-1').classList.remove('hidden');
        document.getElementById('customer-step-2').classList.add('hidden');
        document.getElementById('customer-step-3').classList.add('hidden');

        const indicator = document.getElementById('step-indicator');
        if (indicator) {
            indicator.innerHTML = `
                <span class="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold animate-pulse">1</span>
                <span>เลือกวัตถุดิบและสไตล์ยำ</span>
            `;
        }

        state.currentStep = 1;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

function generatePromptPayQR() {
    const qrImg = document.getElementById('qr-code-img');
    const qrLoading = document.getElementById('qr-loading');

    if (qrLoading) qrLoading.classList.remove('hidden');

    const formattedPP = state.promptPayNumber.replace(/-/g, '').trim();
    const amount = state.order.totalPrice;

    if (qrImg) {
        qrImg.src = `/img/QRCODE.jpg`;

        qrImg.onload = () => {
            if (qrLoading) qrLoading.classList.add('hidden');
        };
        qrImg.onerror = () => {
            if (qrLoading) {
                qrLoading.innerHTML = `
                    <i class="fa-solid fa-triangle-exclamation text-rose-500 text-xl"></i>
                    <span class="text-[9px] text-rose-500">คิวอาร์โหลดล้มเหลว</span>
                `;
            }
        };
    }
}

window.triggerFileInput = function() {
    const slipInput = document.getElementById('slip-input');
    if (slipInput) slipInput.click();
};

window.handleSlipUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('⚠️ รองรับเฉพาะรูปถ่ายสลิปโอนเงินเท่านั้นค่ะ', 'error');
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            // Compress image file to preserve fast Firestore payloads limit
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            state.order.slipBase64 = dataUrl;

            // UI adjustments
            const placeholder = document.getElementById('upload-placeholder');
            if (placeholder) placeholder.classList.add('hidden');

            const previewContainer = document.getElementById('upload-preview-container');
            if (previewContainer) previewContainer.classList.remove('hidden');

            const previewImg = document.getElementById('upload-preview-img');
            if (previewImg) previewImg.src = dataUrl;

            const clearBtn = document.getElementById('btn-clear-slip');
            if (clearBtn) clearBtn.classList.remove('hidden');

            showToast('✅ แนบหลักฐานสลิปโอนเงินสำเร็จแล้วค่ะ!');
        };
    };
};

window.clearUploadedSlip = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    state.order.slipBase64 = '';
    const slipInput = document.getElementById('slip-input');
    if (slipInput) slipInput.value = '';

    const placeholder = document.getElementById('upload-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');

    const previewContainer = document.getElementById('upload-preview-container');
    if (previewContainer) previewContainer.classList.add('hidden');

    const previewImg = document.getElementById('upload-preview-img');
    if (previewImg) previewImg.src = '';

    const clearBtn = document.getElementById('btn-clear-slip');
    if (clearBtn) clearBtn.classList.add('hidden');

    showToast('🗑️ นำไฟล์สลิปออกเรียบร้อย');
};

window.submitFinalOrder = async function() {
    if (!state.order.slipBase64) {
        showToast('⚠️ กรุณาอัปโหลดรูปภาพสลิปแจ้งโอนเงินเพื่อยืนยันออเดอร์ค่ะ', 'error');
        return;
    }

    const btn = document.getElementById('btn-submit-order');
    const btnText = document.getElementById('btn-submit-text');
    if (btn) btn.disabled = true;
    if (btnText) btnText.innerText = "กำลังส่งออเดอร์...";

    const uniqueId = 'YUM-' + Date.now().toString().slice(-5) + '-' + Math.floor(Math.random() * 100);

    const orderPayload = {
        orderId: uniqueId,
        customerName: state.order.custName,
        phone: state.order.custPhone,
        dormLocation: state.order.dormLocation,
        note: state.order.note || 'ไม่มี',
        sauce: state.order.sauce,
        addons: state.order.addons.map(a => `${a.name} (x${a.quantity})`),
        spiciness: state.order.spiciness,
        totalPrice: state.order.totalPrice,
        slipBase64: state.order.slipBase64,
        status: 'pending',
        createdAt: new Date().toISOString(),
        customerUid: auth?.currentUser?.uid || 'anonymous-user'
    };

    try {
        if (db) {
            // Write to Firebase following Rule 1 strict paths
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', uniqueId);
            await setDoc(docRef, orderPayload);
        } else {
            // Offline simulation fallback
            const offlineDB = JSON.parse(localStorage.getItem('yumsing_orders_fallback') || '[]');
            offlineDB.push(orderPayload);
            localStorage.setItem('yumsing_orders_fallback', JSON.stringify(offlineDB));
        }

        renderReceiptModal(uniqueId);

        // State Resetting
        state.order.addons = [];
        state.order.slipBase64 = '';
        state.order.dormLocation = ''; // Reset location as well
        
        const slipInput = document.getElementById('slip-input');
        if (slipInput) slipInput.value = '';

        const custName = document.getElementById('cust-name');
        if (custName) custName.value = '';

        const custPhone = document.getElementById('cust-phone');
        if (custPhone) custPhone.value = '';

        const custNote = document.getElementById('cust-note');
        if (custNote) custNote.value = '';

        const placeholder = document.getElementById('upload-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');

        const previewContainer = document.getElementById('upload-preview-container');
        if (previewContainer) previewContainer.classList.add('hidden');

        const clearBtn = document.getElementById('btn-clear-slip');
        if (clearBtn) clearBtn.classList.add('hidden');

        goToStep(1);
    } catch (err) {
        console.error("Order writing transaction failed", err);
        showToast('❌ ส่งออเดอร์ล้มเหลว กรุณาลองตรวจสอบสลิปแล้วกดส่งใหม่อีกครั้ง', 'error');
    } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.innerText = "ส่งรายการออเดอร์อาหาร";
    }
};

function renderReceiptModal(orderId) {
    const isPickup = state.order.dormLocation === 'รับหน้าร้าน';
    const locationText = isPickup 
        ? 'รับของที่หน้าร้านได้เลยค่ะ' 
        : 'รอรับยำแสนอร่อยได้ที่ใต้หอพักในช่วงเวลา 17.00 - 17.30 น.';

    const overlay = document.createElement('div');
    overlay.className = "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4";
    overlay.innerHTML = `
        <div class="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-orange-100 transform transition-all duration-300 scale-100 animate-[fadeIn_0.2s_ease-out]">
            <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                <i class="fa-solid fa-check-double animate-bounce"></i>
            </div>
            
            <h3 class="text-xl font-bold text-slate-800">ส่งรายการออเดอร์เสร็จสิ้น!</h3>
            <p class="text-xs text-slate-400 mt-1 mb-4">รหัสของคุณ: <span class="font-extrabold text-orange-600 font-mono">${orderId}</span></p>

            <div class="bg-gradient-to-r from-orange-50/50 to-amber-50/50 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2.5 mb-5 border border-orange-100/30">
                <p class="font-bold text-slate-800 flex items-center"><i class="fa-solid fa-circle-info text-orange-500 mr-1.5"></i> ขั้นตอนต่อไปสำหรับคุณ:</p>
                <p>1. ทางร้านกำลังตรวจสอบรายการสลิปชำระเงินของคุณ</p>
                <p>2. จัดทำยำสดๆ เตรียมส่งตรงเวลา</p>
                <p class="font-bold text-rose-600">3. ${locationText}</p>
                <div class="pt-2 border-t border-slate-200 flex flex-col space-y-1">
                    <span>📢 อย่าลืมกดติดตาม Story IG ร้าน เพื่อดูแจ้งเตือนสถานะเมื่อยำพร้อมส่ง!</span>
                    <a href="https://www.instagram.com/yumsing.mhosab/" target="_blank" class="text-orange-600 font-bold underline hover:text-orange-700 flex items-center">
                        <i class="fa-brands fa-instagram mr-1"></i> @yumsing.mhosab
                    </a>
                </div>
            </div>

            <button onclick="this.closest('.fixed').remove()" class="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-3.5 rounded-2xl shadow-md hover:from-orange-600 hover:to-red-600 transition-colors">
                รับทราบและตกลง
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    const bgClass = type === 'success'
        ? 'bg-slate-900 border-l-4 border-emerald-500 text-emerald-400'
        : 'bg-rose-950 border-l-4 border-rose-500 text-rose-400';

    toast.className = `p-4 rounded-2xl shadow-2xl flex items-center space-x-3 pointer-events-auto transition-all duration-300 transform translate-x-12 opacity-0 text-xs md:text-sm ${bgClass}`;
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

// Window Loading Event
window.onload = async function() {
    await initFirebase();
    renderInterface();
};