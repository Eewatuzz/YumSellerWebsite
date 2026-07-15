import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Global state and references variables setup
const state = {
    currentStep: 1,
    promptPayNumber: '0812345678', // editable default (shop's PromptPay number)
    order: {
        base: 'ไหลบัว', // Default base
        addons: [],     // toppings selection, structure: { name: string, price: number, quantity: number }
        spiciness: 'เผ็ดกลาง',
        preference: 'รสเข้มข้นกลมกล่อม',
        custName: '',
        custPhone: '',
        type: 'delivery', // delivery or pickup
        address: '',
        time: '',
        note: '',
        slipBase64: '',
        totalPrice: 80, // Default base 40 + delivery 40
    }
};

// Standard Yam Custom Ingredients List definitions
const INGREDIENTS = {
    bases: [
        { id: 'lotus', name: 'ไหลบัว', icon: '🎋' },
        { id: 'glass-noodles', name: 'เส้นแก้ว', icon: '🍜' },
        { id: 'vermicelli', name: 'วุ้นเส้น', icon: '🍜' },
        { id: 'instant-noodles', name: 'เส้นมาม่า', icon: '🍜' }
    ],
    meats: [
        { id: 'pork-sausage', name: 'หมูยอ', price: 10, icon: '🍥' },
        { id: 'chinese-sausage', name: 'กุนเชียง', price: 10, icon: '🥓' },
        { id: 'crab-stick', name: 'ปูอัด', price: 10, icon: '🦀' },
        { id: 'minced-pork', name: 'หมูสับ', price: 10, icon: '🥩' },
        { id: 'chicken-feet', name: 'เล็บมือนาง', price: 10, icon: '🐓' }
    ],
    seafood: [
        { id: 'raw-shrimp', name: 'กุ้งสด', price: 10, icon: '🦐' },
        { id: 'cooked-shrimp', name: 'กุ้งสุก', price: 10, icon: '🍤' },
        { id: 'squid', name: 'ปลาหมึก', price: 10, icon: '🐙' },
        { id: 'cockles', name: 'หอยแครง', price: 10, icon: '🐚' },
        { id: 'pickled-crab', name: 'ปูดอง', price: 10, icon: '🦀' }
    ],
    veggies: [
        { id: 'tomato', name: 'มะเขือเทศ', price: 10, icon: '🍅' },
        { id: 'red-onion', name: 'หอมแขก', price: 10, icon: '🧅' },
        { id: 'culantro', name: 'ผักชีฝรั่ง', price: 10, icon: '🌱' },
        { id: 'corn', name: 'ข้าวโพด', price: 10, icon: '🌽' },
        { id: 'green-mango', name: 'มะม่วงเปรี้ยว', price: 10, icon: '🥭' }
    ],
    spicyLevels: [
        { label: 'ไม่เผ็ด (พริก 0 เม็ด)', class: 'bg-green-100 text-green-700 hover:bg-green-200' },
        { label: 'เผ็ดน้อย (พริก 2 เม็ด)', class: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
        { label: 'เผ็ดกลาง (พริก 5 เม็ด)', class: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
        { label: 'เผ็ดมาก (พริก 10 เม็ด)', class: 'bg-red-100 text-red-700 hover:bg-red-200' }
    ],
    sweetOptions: [
        { label: 'รสเข้มข้นกลมกล่อม', desc: 'เปรี้ยว/หวาน/เค็ม เท่าๆกัน' },
        { label: 'เปรี้ยวนำ (สายจี๊ดจ๊าด)', desc: 'เน้นมะนาวสดแท้สะใจ' }
    ]
};

// Firebase Initialization Setup based on Sandbox environment variables safely
let db, auth;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'spicy-salad-shop-default';
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


async function writeOrder(orderData) {
  const uid = auth.currentUser.uid;

  await addDoc(collection(db, "orders"), {
    ...orderData,
    customerUid: uid,
    status: "new",
    createdAt: serverTimestamp()
  });
}

// Helper function to build custom elements & attach listeners
function renderCustomizer() {
    // Render bases
    const baseContainer = document.getElementById('base-container');
    baseContainer.innerHTML = INGREDIENTS.bases.map(b => `
        <button onclick="selectBase('${b.name}')" id="btn-base-${b.name}" class="p-3.5 border-2 rounded-xl text-center font-medium transition-all duration-200 hover:border-orange-500 hover:bg-orange-50/20 text-slate-700 ${state.order.base === b.name ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold shadow-sm' : 'border-slate-200'}">
            <span class="block text-2xl mb-1">${b.icon}</span>
            <span class="text-xs md:text-sm">${b.name}</span>
        </button>
    `).join('');

    // Render toppings with plus/minus quantity selectors
    const renderAddons = (containerId, addonList) => {
        const container = document.getElementById(containerId);
        container.innerHTML = addonList.map(a => {
            const currentAddon = state.order.addons.find(item => item.name === a.name);
            const qty = currentAddon ? currentAddon.quantity : 0;
            const isActive = qty > 0;

            return `
                <div class="p-3.5 border rounded-xl flex items-center justify-between text-left transition-all duration-200 ${isActive ? 'border-orange-400 bg-orange-50/40 text-orange-700 font-bold' : 'border-slate-200 text-slate-700'}">
                    <div class="flex flex-col">
                        <span class="flex items-center space-x-2 text-xs md:text-sm">
                            <span class="text-xl">${a.icon}</span>
                            <span>${a.name}</span>
                        </span>
                        <span class="text-xs text-orange-600 pl-7">+${a.price}.-</span>
                    </div>

                    <!-- Plus/Minus Controls -->
                    <div class="flex items-center space-x-2.5">
                        ${qty > 0 ? `
                            <button onclick="changeAddonQuantity('${a.name}', ${a.price}, -1)" class="w-7 h-7 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-full flex items-center justify-center font-bold text-sm focus:outline-none shadow-sm">
                                -
                            </button>
                            <span class="text-sm font-bold text-slate-800 w-4 text-center">${qty}</span>
                        ` : ''}
                        <button onclick="changeAddonQuantity('${a.name}', ${a.price}, 1)" class="w-7 h-7 ${isActive ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'} rounded-full flex items-center justify-center font-bold text-sm focus:outline-none shadow-sm">
                            +
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    renderAddons('meats-container', INGREDIENTS.meats);
    renderAddons('seafood-container', INGREDIENTS.seafood);
    renderAddons('veggies-container', INGREDIENTS.veggies);

    // Render Spiciness Options
    const spicyContainer = document.getElementById('spicy-container');
    spicyContainer.innerHTML = INGREDIENTS.spicyLevels.map(s => `
        <button onclick="selectSpiciness('${s.label}')" class="p-3 rounded-xl border text-center transition-all ${state.order.spiciness === s.label ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold ring-2 ring-orange-500/20' : 'border-slate-200 text-slate-600 text-xs hover:bg-slate-50'}">
            <span class="text-xs md:text-sm font-medium block">${s.label.split(' ')[0]}</span>
            <span class="text-[10px] opacity-75">${s.label.split(' ')[1] || ''}</span>
        </button>
    `).join('');

    // Render Taste Sweet Choices
    const sweetContainer = document.getElementById('sweet-container');
    sweetContainer.innerHTML = INGREDIENTS.sweetOptions.map(sw => `
        <button onclick="selectSweetPreference('${sw.label}')" class="p-3 border rounded-xl text-center transition-all ${state.order.preference === sw.label ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold' : 'border-slate-200 text-slate-600 text-xs hover:bg-slate-50'}">
            <span class="text-xs md:text-sm font-medium block">${sw.label}</span>
            <span class="text-[10px] opacity-60 block">${sw.desc}</span>
        </button>
    `).join('');

    updateCheckoutSummaries();
}

window.selectBase = function(baseName) {
    state.order.base = baseName;
    renderCustomizer();
};

// Handle Addon quantity increments or decrements
window.changeAddonQuantity = function(addonName, price, change) {
    const index = state.order.addons.findIndex(a => a.name === addonName);
    if (index > -1) {
        const item = state.order.addons[index];
        item.quantity += change;
        if (item.quantity <= 0) {
            state.order.addons.splice(index, 1);
        }
    } else if (change > 0) {
        state.order.addons.push({ name: addonName, price: price, quantity: 1 });
    }
    renderCustomizer();
};

window.selectSpiciness = function(spicyLabel) {
    state.order.spiciness = spicyLabel;
    renderCustomizer();
};

window.selectSweetPreference = function(sweetLabel) {
    state.order.preference = sweetLabel;
    renderCustomizer();
};

window.resetSaladState = function() {
    state.order.base = 'ไหลบัว';
    state.order.addons = [];
    state.order.spiciness = 'เผ็ดกลาง';
    state.order.preference = 'รสเข้มข้นกลมกล่อม';
    renderCustomizer();
    showToast('🔄 ล้างข้อมูลปรุงยำเรียบร้อยแล้ว');
};

function updateCheckoutSummaries() {
    // Price formulation logic with quantities
    const basePrice = 40; // Flat fee for sauce and chosen base
    const addonsPrice = state.order.addons.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    const totalAddonsCount = state.order.addons.reduce((acc, curr) => acc + curr.quantity, 0);
    const deliveryPrice = state.order.type === 'delivery' ? 40 : 0;

    const total = basePrice + addonsPrice + deliveryPrice;
    state.order.totalPrice = total;

    // DOM updates
    document.getElementById('cart-summary-price').innerText = total;
    document.getElementById('cart-grand-total').innerText = total;
    document.getElementById('payment-price-display').innerText = total;

    // Labels on receipt panel
    document.getElementById('addon-count-label').innerText = `เครื่องยำเพิ่มเติม (${totalAddonsCount} ชิ้น)`;
    document.getElementById('addon-price-label').innerText = `${addonsPrice} บาท`;
    document.getElementById('delivery-price-label').innerText = `${deliveryPrice} บาท`;

    // Draw cart list dynamically on receipt panel
    const cartList = document.getElementById('cart-list');
    let cartHTML = `
        <div class="flex justify-between items-center bg-orange-50/50 p-2 rounded-lg mb-2">
            <span class="font-medium text-orange-800">🥗 ยำ${state.order.base}</span>
            <span class="text-slate-500 font-medium">40.-</span>
        </div>
    `;

    if (state.order.addons.length > 0) {
        cartHTML += state.order.addons.map(a => `
            <div class="flex justify-between items-center text-xs pl-3 py-1">
                <span class="text-slate-600">
                    <i class="fa-solid fa-plus text-orange-400 mr-1.5 text-[9px]"></i>
                    ${a.name} <span class="text-orange-600 font-bold">x${a.quantity}</span>
                </span>
                <span class="text-slate-400">+${a.price * a.quantity}.-</span>
            </div>
        `).join('');
    } else {
        cartHTML += `<p class="text-xs text-slate-400 pl-3 py-1">ไม่มีเครื่องเพิ่มเติม</p>`;
    }

    // Flavor tags representation (Removed Anchovy tag)
    cartHTML += `
        <div class="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1">
            <span class="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">🌶️ ${state.order.spiciness.split(' ')[0]}</span>
            <span class="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">🍋 ${state.order.preference.split(' ')[0]}</span>
        </div>
    `;
    cartList.innerHTML = cartHTML;
}

// Handle Delivery Delivery/Pickup Radio choices
window.toggleOrderType = function(type) {
    state.order.type = type;
    const deliveryLabel = document.getElementById('label-type-delivery');
    const pickupLabel = document.getElementById('label-type-pickup');
    const addressBox = document.getElementById('delivery-address-box');

    if (type === 'delivery') {
        deliveryLabel.className = "border-2 border-orange-500 bg-orange-50/50 rounded-xl p-3.5 flex items-center space-x-3 cursor-pointer text-orange-700 font-medium transition-all";
        pickupLabel.className = "border border-slate-200 rounded-xl p-3.5 flex items-center space-x-3 cursor-pointer text-slate-600 font-medium transition-all";
        addressBox.classList.remove('hidden');
    } else {
        pickupLabel.className = "border-2 border-orange-500 bg-orange-50/50 rounded-xl p-3.5 flex items-center space-x-3 cursor-pointer text-orange-700 font-medium transition-all";
        deliveryLabel.className = "border border-slate-200 rounded-xl p-3.5 flex items-center space-x-3 cursor-pointer text-slate-600 font-medium transition-all";
        addressBox.classList.add('hidden');
    }
    updateCheckoutSummaries();
};

window.goToStep = function(stepNum) {
    // Validation before moving to steps
    if (stepNum === 2) {
        // Moving from step 1 to 2
        document.getElementById('customer-step-1').classList.add('hidden');
        document.getElementById('customer-step-2').classList.remove('hidden');
        document.getElementById('customer-step-3').classList.add('hidden');
        updateStepIndicator(2, "ข้อมูลจัดส่งและการรับอาหาร");
        state.currentStep = 2;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (stepNum === 3) {
        // Moving from step 2 to 3 (Requires validation of inputs!)
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        const address = document.getElementById('cust-address').value.trim();
        const time = document.getElementById('cust-time').value.trim();

        if (!name) {
            showToast('⚠️ กรุณากรอกชื่อผู้สั่งอาหาร', 'error');
            return;
        }
        if (!phone || phone.length < 9) {
            showToast('⚠️ กรุณากรอกเบอร์โทรศัพท์ที่ติดต่อได้จริง', 'error');
            return;
        }
        if (state.order.type === 'delivery' && !address) {
            showToast('⚠️ กรุณากรอกที่อยู่จัดส่ง', 'error');
            return;
        }
        if (!time) {
            showToast('⚠️ กรุณาระบุเวลาที่สะดวกรับอาหาร', 'error');
            return;
        }

        // Save to state
        state.order.custName = name;
        state.order.custPhone = phone;
        state.order.address = state.order.type === 'delivery' ? address : 'รับเองที่หน้าร้าน';
        state.order.time = time;
        state.order.note = document.getElementById('cust-note').value.trim();

        // Move to Step 3
        document.getElementById('customer-step-1').classList.add('hidden');
        document.getElementById('customer-step-2').classList.add('hidden');
        document.getElementById('customer-step-3').classList.remove('hidden');
        updateStepIndicator(3, "ชำระเงินและส่งหลักฐานโอน");
        state.currentStep = 3;

        // Load Dynamic PromptPay QR Code
        generatePromptPayQR();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        // Going back to step 1
        document.getElementById('customer-step-1').classList.remove('hidden');
        document.getElementById('customer-step-2').classList.add('hidden');
        document.getElementById('customer-step-3').classList.add('hidden');
        updateStepIndicator(1, "เลือกวัตถุดิบและสไตล์ยำ");
        state.currentStep = 1;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

function updateStepIndicator(num, text) {
    const ind = document.getElementById('step-indicator');
    ind.innerHTML = `
        <span class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold animate-bounce">${num}</span>
        <span>${text}</span>
    `;
}

function generatePromptPayQR() {
    const qrImg = document.getElementById('qr-code-img');
    const qrLoading = document.getElementById('qr-loading');

    qrLoading.classList.remove('hidden');

    // Format phone number or taxId for PromptPay
    // promptpay.io API consumes string amounts perfectly
    const formattedPP = state.promptPayNumber.replace(/-/g, '').trim();
    const amount = state.order.totalPrice;

    // Set source with loading wrapper fallback
    qrImg.src = `https://promptpay.io/${formattedPP}/${amount}.png`;

    qrImg.onload = () => {
        qrLoading.classList.add('hidden');
    };

    qrImg.onerror = () => {
        qrLoading.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation text-red-500 text-xl"></i>
            <span class="text-[10px] text-red-500">โหลด QR ผิดพลาด</span>
        `;
    };
}

// Dedicated helper function to trigger the hidden file selector
window.triggerFileInput = function() {
    document.getElementById('slip-input').click();
};

window.handleSlipUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Filter image types
    if (!file.type.startsWith('image/')) {
        showToast('⚠️ รองรับเฉพาะไฟล์รูปภาพหลักฐานสลิปเท่านั้น', 'error');
        return;
    }

    // Client side image compression using Canvas to fit Firestore limits (Strict doc limits)
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Constrain maximum image boundaries to minimize payload sizes
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

            // Export image quality compressed Base64
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            state.order.slipBase64 = dataUrl;

            // Render upload container UI changes
            document.getElementById('upload-placeholder').classList.add('hidden');
            document.getElementById('upload-preview-container').classList.remove('hidden');
            document.getElementById('upload-preview-img').src = dataUrl;
            document.getElementById('btn-clear-slip').classList.remove('hidden'); // Show separate clear button

            showToast('✅ แนบหลักฐานสลิปโอนเงินสำเร็จ!');
        };
    };
};

window.clearUploadedSlip = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    state.order.slipBase64 = '';
    document.getElementById('slip-input').value = '';
    document.getElementById('upload-placeholder').classList.remove('hidden');
    document.getElementById('upload-preview-container').classList.add('hidden');
    document.getElementById('upload-preview-img').src = '';
    document.getElementById('btn-clear-slip').classList.add('hidden'); // Hide separate clear button
    showToast('🗑️ ลบสลิปออกเรียบร้อย');
};

window.submitFinalOrder = async function() {
    // Validation slip attached check
    if (!state.order.slipBase64) {
        showToast('⚠️ กรุณาอัปโหลดรูปสลิปหลักฐานโอนเงินก่อนส่งออเดอร์', 'error');
        return;
    }

    const btn = document.getElementById('btn-submit-order');
    const btnText = document.getElementById('btn-submit-text');
    btn.disabled = true;
    btnText.innerText = "กำลังส่งออเดอร์...";

    const uniqueId = 'YUM-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 100);

    const orderPayload = {
        orderId: uniqueId,
        customerName: state.order.custName,
        phone: state.order.custPhone,
        type: state.order.type,
        address: state.order.address,
        pickupTime: state.order.time,
        note: state.order.note || 'ไม่มี',
        base: state.order.base,
        // Include quantity info inside the addons list
        addons: state.order.addons.map(a => `${a.name} (x${a.quantity})`),
        spiciness: state.order.spiciness,
        preference: state.order.preference,
        totalPrice: state.order.totalPrice,
        slipBase64: state.order.slipBase64,
        status: 'pending', // pending, preparing, ready, completed, cancelled
        createdAt: new Date().toISOString(),
        customerUid: auth.currentUser.uid
    };

    try {
        if (db) {
            // Firebase Firestore Write logic (Strict Rule 1 paths)
            const documentRef = doc(db, collectionPath, uniqueId);
            await setDoc(documentRef, orderPayload);
        } else {
            // Fallback storage if running purely offline
            const offlineCollection = JSON.parse(localStorage.getItem('yum_mock_orders') || '[]');
            offlineCollection.push(orderPayload);
            localStorage.setItem('yum_mock_orders', JSON.stringify(offlineCollection));
        }

        // Render success confirmation dialog overlay
        showOrderSuccessModal(uniqueId);

        // Clear state
        state.order.addons = [];
        state.order.slipBase64 = '';
        document.getElementById('slip-input').value = '';
        document.getElementById('cust-name').value = '';
        document.getElementById('cust-phone').value = '';
        document.getElementById('cust-address').value = '';
        document.getElementById('cust-time').value = '';
        document.getElementById('cust-note').value = '';
        document.getElementById('upload-placeholder').classList.remove('hidden');
        document.getElementById('upload-preview-container').classList.add('hidden');
        document.getElementById('btn-clear-slip').classList.add('hidden'); // Reset separate button status

        goToStep(1); // Back to first step
    } catch (err) {
        console.error("Failed writing order to DB", err);
        showToast('❌ มีบางอย่างผิดพลาด กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
        btn.disabled = false;
        btnText.innerText = "ยืนยันการสั่งซื้อ";
    }
};

function showOrderSuccessModal(orderId) {
    // Beautiful full-screen receipt overlays instead of standard window.alerts (Strict restriction)
    const overlay = document.createElement('div');
    overlay.className = "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4";
    overlay.innerHTML = `
        <div class="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-orange-100 transform transition-all duration-300 scale-100 animate-[fadeIn_0.2s_ease-out]">
            <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                <i class="fa-solid fa-circle-check"></i>
            </div>
            <h3 class="text-xl font-bold text-slate-800 font-brand">สั่งยำรสจัดจ้านสำเร็จแล้ว!</h3>
            <p class="text-xs text-slate-400 mt-1 mb-4">รหัสออเดอร์: <span class="font-bold text-slate-700 font-mono">${orderId}</span></p>

            <div class="bg-orange-50/50 rounded-xl p-3 text-left text-xs text-slate-600 space-y-2 mb-4">
                <p class="font-medium text-slate-700">📌 ขั้นตอนถัดไปสำหรับร้าน:</p>
                <p>1. ทางร้านกำลังตรวจสอบสลิปยอดชำระของคุณ</p>
                <p>2. ครัวเริ่มสลัดยำสดๆ เมื่อตรวจสอบครบถ้วน</p>
                <p>3. เมนูแซ่บจัดส่งหรือรอให้ท่านมารับตามเวลาที่นัดหมาย</p>
            </div>

            <button onclick="this.closest('.fixed').remove()" class="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold py-2.5 rounded-xl shadow-md hover:from-orange-600 hover:to-red-600 transition-colors">
                รับทราบ ปิดหน้านี้
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
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

// Window Onload Trigger (Strict requirement)
window.onload = async function() {
    await initFirebase();
    renderCustomizer();
};
