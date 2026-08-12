// Mon Khule Bolo - Web Client Controller (Simplified Random Chat Only)

// Paste your Firebase configuration keys here for instant WebSocket real-time chat
const firebaseConfig = {
    apiKey: "AIzaSyCFx3AzOCrcjuih9-TO9HThCYsHWFA3iDE",
    authDomain: "mon-khule-bolo-6f05d.firebaseapp.com",
    databaseURL: "https://mon-khule-bolo-6f05d-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mon-khule-bolo-6f05d",
    storageBucket: "mon-khule-bolo-6f05d.firebasestorage.app",
    messagingSenderId: "181043131130",
    appId: "1:181043131130:web:c0881781f7333dcd4c0f43",
    measurementId: "G-93FREQJ94N"
};

let useFirebase = false;
let database = null;

if (typeof firebase !== "undefined" && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("REPLACE_")) {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    useFirebase = true;
    console.log("Firebase Realtime Database initialized successfully!");
} else {
    console.log("Using Google Sheets database sync engine (Firebase credentials not configured).");
}

// Paste your deployed Google Apps Script Web App URL here
const API_URL = "https://script.google.com/macros/s/AKfycbzkO2uEkYR3WJLG_eAEkPTcvE0m06C0N7Bovuk1rm-DkNUPaZJHHDw9oLaqJVFLWdVu/exec"; 

// Local/Offline Fallback State (seeded with the same mock data structure)
let db = {
    users: [],
    messages: [],
    sessions: [],
    notifications: [],
    blacklist: ["badword", "spam", "abuse"]
};

// Current Session State
let currentUser = null;
let currentLanguage = "en"; // "bn" or "en"
let activeAdminAnonTarget = null; // Stores target girl's session for admin reply dialog
let activeLightboxMsg = null;
let activeSession = null; // Stores current active session object for the user
let isSearchingPartner = false;

// ==========================================
// 1. DATABASE & INITIALIZATION LOGIC
// ==========================================

window.onload = function() {
    loadLocalSession();
    initializeDatabase();
    syncFromRemote();
    setupEventListeners();
    disableUserMediaSaving();
    updateUI();
    runTypewriter();
};

function runTypewriter() {
    const tagline = document.getElementById("logo-tagline");
    if (!tagline) return;
    const text = "Speak Your Heart Out. Anonymously.";
    tagline.innerText = "";
    let i = 0;
    function type() {
        if (i < text.length) {
            tagline.innerText += text.charAt(i);
            i++;
            setTimeout(type, 80);
        }
    }
    type();
}

function ensureAdminInUsers(usersList) {
    const adminUser = {
        uid: "admin_uid_7001646363",
        phoneNumber: "+917001646363",
        fullName: "Admin Mod (Admin)",
        username: "admin_mkhb",
        password: "7001646363",
        age: 30,
        gender: "Male",
        city: "Kolkata City",
        role: "admin",
        isVerified: true,
        verificationSelfie: "",
        isBanned: false
    };
    
    const list = [...(usersList || [])];
    const existingAdminIdx = list.findIndex(u => u.uid === adminUser.uid || String(u.phoneNumber).replace(/\D/g, "").slice(-10) === "7001646363");
    if (existingAdminIdx >= 0) {
        list[existingAdminIdx] = { ...list[existingAdminIdx], ...adminUser };
    } else {
        list.unshift(adminUser);
    }
    return list;
}

function initializeDatabase() {
    // Generate mock seed users if local storage empty
    if (!localStorage.getItem("mon_khule_bolo_db")) {
        const dummyUsers = [
            {
                uid: "user_female_0",
                phoneNumber: "+919999999999",
                fullName: "Pooja Banerjee",
                username: "pooja_b",
                password: "password123",
                age: 21,
                gender: "Female",
                city: "Kolkata",
                role: "user",
                isVerified: true,
                verificationSelfie: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=60",
                isBanned: false,
                activeAnonName: "BlueFairy"
            },
            {
                uid: "user_male_0",
                phoneNumber: "+918888888888",
                fullName: "Rahul Das",
                username: "rahul_d",
                password: "password123",
                age: 23,
                gender: "Male",
                city: "Siliguri",
                role: "user",
                isVerified: true,
                verificationSelfie: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=60",
                isBanned: false,
                activeAnonName: "LoneWolf"
            }
        ];
        
        db.users = dummyUsers;
        saveLocalDB();
    } else {
        db = JSON.parse(localStorage.getItem("mon_khule_bolo_db"));
        if (!db.sessions) db.sessions = [];
    }
    
    db.users = ensureAdminInUsers(db.users);
    saveLocalDB();
}

function saveLocalDB() {
    localStorage.setItem("mon_khule_bolo_db", JSON.stringify(db));
}

function loadLocalSession() {
    const sessionUser = localStorage.getItem("mon_khule_bolo_session");
    if (sessionUser) {
        currentUser = JSON.parse(sessionUser);
        document.body.classList.add("logged-in");
        
        const isAdmin = currentUser.role === "admin";
        document.getElementById("btn-admin-panel").style.display = isAdmin ? "flex" : "none";
        
        if (isAdmin) {
            document.body.classList.add("admin-mode");
        } else {
            document.body.classList.remove("admin-mode");
        }
        
        startSyncPolling();
        showScreen("screen-main");
    } else {
        showScreen("screen-splash");
    }
}

// Remote DB Apps Script Synchronization
let isSyncing = false;
async function syncFromRemote() {
    if (!API_URL) return;
    if (isSyncing) return;
    isSyncing = true;
    try {
        const response = await fetch(API_URL);
        const remoteData = await response.json();
        if (remoteData) {
            const remoteUsers = remoteData.users || [];
            db.users = ensureAdminInUsers(remoteUsers);
            
            const adminUser = db.users.find(u => u.uid === "admin_uid_7001646363");
            if (adminUser) {
                syncToRemote("save_user", adminUser);
            }
            
            db.messages = remoteData.messages || [];
            db.sessions = remoteData.sessions || [];
            saveLocalDB();
            
            if (currentUser) {
                const updatedMe = db.users.find(u => u.uid === currentUser.uid);
                if (updatedMe) {
                    currentUser = updatedMe;
                    localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
                }
            }
            updateUI();
        }
    } catch (err) {
        console.error("Failed to sync from remote DB:", err);
    } finally {
        isSyncing = false;
    }
}

let syncPollingInterval = null;
let chatSyncPollingInterval = null;
let isChatSyncing = false;

let firebaseUsersListener = null;
let firebaseMessagesListener = null;
let firebaseSessionsListener = null;

function startSyncPolling() {
    if (!syncPollingInterval) {
        syncPollingInterval = setInterval(async () => {
            await syncFromRemote();
        }, 15000);
    }
    
    if (useFirebase) {
        if (!firebaseUsersListener) {
            firebaseUsersListener = database.ref('users').on('value', (snapshot) => {
                const data = snapshot.val();
                const list = [];
                if (data) {
                    for (let key in data) {
                        list.push(data[key]);
                    }
                }
                db.users = ensureAdminInUsers(list);
                saveLocalDB();
                
                const adminUser = db.users.find(u => u.uid === "admin_uid_7001646363");
                if (adminUser && useFirebase) {
                    database.ref('users/' + adminUser.uid).set(adminUser);
                }
                
                if (currentUser && currentUser.role === "admin") {
                    loadAdminUsersList();
                }
            });
        }
        if (!firebaseMessagesListener) {
            firebaseMessagesListener = database.ref('messages').on('value', (snapshot) => {
                const data = snapshot.val();
                const list = [];
                if (data) {
                    for (let key in data) {
                        list.push(data[key]);
                    }
                }
                db.messages = list;
                saveLocalDB();
                if (currentUser) {
                    if (activeSession) {
                        renderRandomChatHistory();
                    }
                    if (currentUser.role === "admin" && activeAdminAnonTarget) {
                        renderAdminAnonChatHistory();
                    }
                }
            });
        }
        if (!firebaseSessionsListener) {
            firebaseSessionsListener = database.ref('sessions').on('value', (snapshot) => {
                const data = snapshot.val();
                const list = [];
                if (data) {
                    for (let key in data) {
                        list.push(data[key]);
                    }
                }
                db.sessions = list;
                saveLocalDB();
                if (currentUser) {
                    if (currentUser.gender === "Female") {
                        renderGirlChatsList();
                    }
                    if (currentUser.role === "admin") {
                        loadAdminAnonChats();
                    }
                }
            });
        }
    } else {
        if (!chatSyncPollingInterval) {
            chatSyncPollingInterval = setInterval(async () => {
                await syncChatFromRemote();
            }, 1500);
        }
    }
}

async function syncChatFromRemote() {
    if (!API_URL) return;
    if (isChatSyncing) return;
    isChatSyncing = true;
    try {
        const response = await fetch(API_URL + "?action=sync_chat");
        const remoteData = await response.json();
        if (remoteData) {
            db.messages = remoteData.messages || [];
            db.sessions = remoteData.sessions || [];
            saveLocalDB();
            
            if (currentUser) {
                if (activeSession) {
                    renderRandomChatHistory();
                }
                if (currentUser.role === "admin" && activeAdminAnonTarget) {
                    renderAdminAnonChatHistory();
                }
                if (currentUser.gender === "Female") {
                    renderGirlChatsList();
                }
                if (currentUser.role === "admin") {
                    loadAdminAnonChats();
                }
            }
        }
    } catch (err) {
        console.error("Failed to sync chat:", err);
    } finally {
        isChatSyncing = false;
    }
}

function stopSyncPolling() {
    if (syncPollingInterval) {
        clearInterval(syncPollingInterval);
        syncPollingInterval = null;
    }
    if (chatSyncPollingInterval) {
        clearInterval(chatSyncPollingInterval);
        chatSyncPollingInterval = null;
    }
    if (useFirebase) {
        if (firebaseUsersListener) database.ref('users').off('value', firebaseUsersListener);
        if (firebaseMessagesListener) database.ref('messages').off('value', firebaseMessagesListener);
        if (firebaseSessionsListener) database.ref('sessions').off('value', firebaseSessionsListener);
        firebaseUsersListener = null;
        firebaseMessagesListener = null;
        firebaseSessionsListener = null;
    }
}

function syncToRemote(action, payload) {
    if (!API_URL) return;
    try {
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: action, payload: payload })
        });
    } catch (err) {
        console.error("Failed to send remote sync payload:", err);
    }
}

// ==========================================
// 2. VIEW NAVIGATION & SCREENS LOGIC
// ==========================================

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add("active");
        if (screenId === "screen-splash") {
            initNebulaCanvas();
        }
    }
}

function switchTab(tabId) {
    // Kept as simple stub since only random-chat is used
    updateUI();
}

function updateUI() {
    if (currentUser) {
        const isAdmin = currentUser.role === "admin";
        document.getElementById("btn-admin-panel").style.display = isAdmin ? "flex" : "none";
        
        if (isAdmin) {
            document.body.classList.add("admin-mode");
        } else {
            document.body.classList.remove("admin-mode");
        }
        
        if (currentUser.gender === "Female") {
            renderGirlChatsList();
        }
    }
}

// ==========================================
// 3. REGISTRATION & WEBCAM LOGIC
// ==========================================

let webcamStream = null;
let mockSelfieBase64 = null;

async function startWebcam() {
    const video = document.getElementById("webcam-preview");
    const container = document.getElementById("webcam-container");
    if (!video || !container) return;
    
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        video.srcObject = webcamStream;
        container.style.display = "flex";
        document.getElementById("btn-selfie").style.display = "none";
    } catch (err) {
        alert("Could not access camera: " + err.message);
    }
}

function captureSelfieFromWebcam() {
    const video = document.getElementById("webcam-preview");
    if (!video || !webcamStream) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    mockSelfieBase64 = canvas.toDataURL("image/jpeg");
    
    // Show preview
    const previewImg = document.getElementById("selfie-preview-img");
    const previewContainer = document.getElementById("selfie-preview-container");
    if (previewImg && previewContainer) {
        previewImg.src = mockSelfieBase64;
        previewContainer.style.display = "block";
    }
    
    const status = document.getElementById("selfie-status");
    if (status) {
        status.className = "status-badge green";
        status.innerText = "Selfie Captured ✅";
    }
    
    stopWebcam();
}

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    const container = document.getElementById("webcam-container");
    if (container) container.style.display = "none";
    
    const btn = document.getElementById("btn-selfie");
    if (btn) btn.style.display = "inline-block";
}

function handleRegister(e) {
    e.preventDefault();
    
    if (!mockSelfieBase64) {
        alert("Please turn on the selfie camera and take a selfie for safety verification! / অনুগ্রহ করে সেলফি তুলে ভেরিফিকেশন সম্পন্ন করুন!");
        return;
    }
    
    const phone = document.getElementById("reg-phone").value.trim();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
        alert("Please enter a valid 10-digit phone number. / অনুগ্রহ করে সঠিক ১০-সংখ্যার মোবাইল নম্বর দিন।");
        return;
    }
    
    const targetLast10 = cleanPhone.slice(-10);
    const isDuplicate = db.users.some(u => {
        if (!u.phoneNumber) return false;
        const dbPhone = String(u.phoneNumber).replace(/\D/g, "");
        return dbPhone.slice(-10) === targetLast10;
    });
    
    if (isDuplicate) {
        alert("This phone number is already registered. / এই মোবাইল নম্বরটি ইতিমধ্যে নিবন্ধিত রয়েছে।");
        return;
    }
    
    const fullName = document.getElementById("reg-name").value.trim();
    const alias = document.getElementById("reg-alias").value.trim();
    const gender = document.getElementById("reg-gender").value.trim();
    const age = parseInt(document.getElementById("reg-age").value);
    const city = document.getElementById("reg-city").value.trim();
    const password = document.getElementById("reg-password").value.trim();
    
    const newUser = {
        uid: "user_" + Date.now(),
        phoneNumber: phone.startsWith("+91") ? phone : "+91" + phone,
        fullName: fullName,
        username: alias.toLowerCase().replace(/[^a-z0-9]/g, "") + "_" + Math.floor(100+Math.random()*900),
        password: password,
        age: age,
        gender: gender,
        city: city,
        role: "user",
        isVerified: true,
        verificationSelfie: mockSelfieBase64,
        isBanned: false,
        activeAnonName: alias,
        activeAnonPartnerName: ""
    };
    
    db.users.push(newUser);
    saveLocalDB();
    
    if (useFirebase) {
        database.ref('users/' + newUser.uid).set(newUser);
    } else {
        syncToRemote("save_user", newUser);
    }
    
    // Reset form
    document.getElementById("form-register").reset();
    mockSelfieBase64 = null;
    document.getElementById("selfie-status").className = "status-badge red";
    document.getElementById("selfie-status").innerText = "Selfie Pending ❌";
    document.getElementById("selfie-preview-container").style.display = "none";
    
    // Autofill login and redirect
    document.getElementById("login-phone").value = phone;
    document.getElementById("login-password").value = password;
    showScreen("screen-login");
    showToast("Registration successful! Please login.");
}

// ==========================================
// 4. AUTHENTICATION & LOGIN LOGIC
// ==========================================

function handleLogin(e) {
    e.preventDefault();
    
    const phone = document.getElementById("login-phone").value.trim();
    const password = document.getElementById("login-password").value.trim();
    
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    
    const matchedUser = db.users.find(u => {
        const uPhone = String(u.phoneNumber).replace(/\D/g, "").slice(-10);
        return uPhone === cleanPhone && String(u.password) === String(password);
    });
    
    if (!matchedUser) {
        alert("Invalid phone number or password! / মোবাইল নম্বর অথবা পাসওয়ার্ড ভুল!");
        return;
    }
    
    if (matchedUser.isBanned) {
        alert("Your account has been permanently banned by the Admin. / আপনার অ্যাকাউন্টটি অ্যাডমিন দ্বারা নিষ্ক্রিয় করা হয়েছে।");
        return;
    }
    
    currentUser = matchedUser;
    localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
    document.body.classList.add("logged-in");
    
    const isAdmin = currentUser.role === "admin";
    document.getElementById("btn-admin-panel").style.display = isAdmin ? "flex" : "none";
    if (isAdmin) {
        document.body.classList.add("admin-mode");
    } else {
        document.body.classList.remove("admin-mode");
    }
    
    // Clear login form
    document.getElementById("form-login").reset();
    
    startSyncPolling();
    showScreen("screen-main");
    showToast(`Welcome, ${currentUser.fullName}!`);
}

function logout() {
    stopSyncPolling();
    currentUser = null;
    activeSession = null;
    localStorage.removeItem("mon_khule_bolo_session");
    document.body.classList.remove("logged-in");
    document.body.classList.remove("admin-mode");
    document.getElementById("btn-admin-panel").style.display = "none";
    
    document.getElementById("random-chat-room").style.display = "none";
    document.getElementById("random-chat-welcome").style.display = "block";
    
    showScreen("screen-splash");
    showToast("Logged out successfully.");
}

// ==========================================
// 5. RANDOM CHAT & MATCHMAKING
// ==========================================

function startRandomChat() {
    const selectedGender = document.querySelector('input[name="search-gender"]:checked').value;
    
    document.getElementById("btn-start-random-chat").style.display = "none";
    const loader = document.getElementById("search-partner-loading");
    loader.style.display = "block";
    
    const loadingText = document.getElementById("search-partner-text");
    const loadingTextSub = document.getElementById("search-partner-text-sub");
    
    loadingText.innerText = "Searching for a companion / সঙ্গী খোঁজা হচ্ছে...";
    loadingTextSub.innerText = "Connecting to secure network... / নিরাপদ নেটওয়ার্ক সংযোগ হচ্ছে...";
    
    setTimeout(() => {
        loader.style.display = "none";
        document.getElementById("btn-start-random-chat").style.display = "inline-block";
        
        const isUserAdmin = currentUser.role === "admin";
        const isUserMale = currentUser.gender === "Male";
        const isUserFemale = currentUser.gender === "Female";
        
        if (isUserAdmin) {
            // ADMIN MATCHING LOGIC
            let targetUser = null;
            if (selectedGender === "Female") {
                const females = db.users.filter(u => u.role !== "admin" && u.gender === "Female");
                targetUser = females.length > 0 ? females[Math.floor(Math.random() * females.length)] : db.users.find(u => u.uid === "user_female_0");
            } else {
                const males = db.users.filter(u => u.role !== "admin" && u.gender === "Male");
                targetUser = males.length > 0 ? males[Math.floor(Math.random() * males.length)] : db.users.find(u => u.uid === "user_male_0");
            }
            
            if (!targetUser) {
                alert("No users registered in system yet. / সিস্টেমে কোনো ব্যবহারকারী পাওয়া যায়নি।");
                return;
            }
            
            const sessionId = "session_anon_" + Date.now();
            const newSession = {
                id: sessionId,
                userUid: targetUser.uid,
                userAlias: targetUser.activeAnonName,
                partnerAlias: "Admin Mod",
                createdAt: new Date().toISOString(),
                isBlocked: false,
                isDeleted: false
            };
            
            db.sessions.push(newSession);
            saveLocalDB();
            if (useFirebase) {
                database.ref('sessions/' + sessionId).set(newSession);
            } else {
                syncToRemote("save_session", newSession);
            }
            
            const initMsg = {
                id: "msg_init_" + Date.now(),
                senderId: "system",
                receiverId: targetUser.uid,
                content: `Admin Audit Session started with ${targetUser.activeAnonName} / অ্যাডমিন অডিট সেশন শুরু হয়েছে।`,
                createdAt: new Date().toISOString(),
                isRead: true,
                isAnonymous: true,
                anonSessionId: sessionId,
                anonName: targetUser.activeAnonName
            };
            db.messages.push(initMsg);
            saveLocalDB();
            if (useFirebase) {
                database.ref('messages/' + initMsg.id).set(initMsg);
            } else {
                syncToRemote("save_message", initMsg);
            }
            
            showToast("Connected to user for auditing!");
            openAdminAnonChatDialog(sessionId);
            
        } else if (isUserMale) {
            // MALE USER MATCHING LOGIC (ONLY FINDS MALE)
            const maleAliases = ["Rohan", "Kabir", "Vikram", "Joy", "Aman", "Raju", "Sayan", "Nil", "Pritam", "Subhadip"];
            const partnerAlias = maleAliases[Math.floor(Math.random() * maleAliases.length)];
            const sessionId = "session_anon_" + Date.now();
            
            const newSession = {
                id: sessionId,
                userUid: currentUser.uid,
                userAlias: currentUser.activeAnonName,
                partnerAlias: partnerAlias,
                createdAt: new Date().toISOString(),
                isBlocked: false,
                isDeleted: false
            };
            
            db.sessions.push(newSession);
            saveLocalDB();
            
            if (useFirebase) {
                database.ref('sessions/' + sessionId).set(newSession);
            } else {
                syncToRemote("save_session", newSession);
            }
            
            const initMsg = {
                id: "msg_init_" + Date.now(),
                senderId: "system",
                receiverId: currentUser.uid,
                content: "Chat session started securely. Privacy is our top priority. / চ্যাট সেশন শুরু হয়েছে। গোপনীয়তা আমাদের প্রধান অগ্রাধিকার।",
                createdAt: new Date().toISOString(),
                isRead: true,
                isAnonymous: true,
                anonSessionId: sessionId,
                anonName: currentUser.activeAnonName
            };
            db.messages.push(initMsg);
            saveLocalDB();
            if (useFirebase) {
                database.ref('messages/' + initMsg.id).set(initMsg);
            } else {
                syncToRemote("save_message", initMsg);
            }
            
            showToast("Partner matched! / সঙ্গী পাওয়া গেছে!");
            loadChatSession(sessionId);
            
        } else if (isUserFemale) {
            // FEMALE USER MATCHING LOGIC (ONLY FINDS ADMIN)
            const companionAliases = ["SilentGhost", "LoneWolf", "NightOwl", "DarkHorse", "SilverFox", "AlphaWolf", "DeepMind", "BrightStar", "RiverFlow", "ForestDweller"];
            const partnerAlias = companionAliases[Math.floor(Math.random() * companionAliases.length)];
            const sessionId = "session_anon_" + Date.now();
            
            const newSession = {
                id: sessionId,
                userUid: currentUser.uid,
                userAlias: currentUser.activeAnonName,
                partnerAlias: partnerAlias,
                createdAt: new Date().toISOString(),
                isBlocked: false,
                isDeleted: false
            };
            
            db.sessions.push(newSession);
            saveLocalDB();
            
            if (useFirebase) {
                database.ref('sessions/' + sessionId).set(newSession);
            } else {
                syncToRemote("save_session", newSession);
            }
            
            const initMsg = {
                id: "msg_init_" + Date.now(),
                senderId: "system",
                receiverId: currentUser.uid,
                content: "Chat session started securely. Privacy is our top priority. / চ্যাট সেশন শুরু হয়েছে। গোপনীয়তা আমাদের প্রধান অগ্রাধিকার।",
                createdAt: new Date().toISOString(),
                isRead: true,
                isAnonymous: true,
                anonSessionId: sessionId,
                anonName: currentUser.activeAnonName
            };
            db.messages.push(initMsg);
            saveLocalDB();
            if (useFirebase) {
                database.ref('messages/' + initMsg.id).set(initMsg);
            } else {
                syncToRemote("save_message", initMsg);
            }
            
            showToast("Partner matched! / সঙ্গী পাওয়া গেছে!");
            loadChatSession(sessionId);
        }
    }, 2500);
}

function loadChatSession(sessionId) {
    const session = db.sessions.find(s => s.id === sessionId);
    if (!session || session.isDeleted) return;
    
    activeSession = session;
    
    document.getElementById("random-chat-welcome").style.display = "none";
    const room = document.getElementById("random-chat-room");
    room.style.display = "flex";
    
    // Set headers
    document.getElementById("partner-alias-header").innerText = session.partnerAlias;
    document.getElementById("my-alias-badge").innerText = `Your Alias: ${session.userAlias}`;
    
    // Update block button text
    const blockBtn = document.getElementById("btn-block-partner");
    blockBtn.innerText = session.isBlocked ? "Unblock / আনব্লক" : "Block / ব্লক";
    
    // Set sidebar active
    if (currentUser.gender === "Female") {
        document.getElementById("girl-chat-sidebar").style.display = "flex";
        renderGirlChatsList();
    } else {
        document.getElementById("girl-chat-sidebar").style.display = "none";
    }
    
    renderRandomChatHistory(true);
}

function renderGirlChatsList() {
    const sidebarList = document.getElementById("girl-chats-list");
    if (!sidebarList) return;
    sidebarList.innerHTML = "";
    
    const mySessions = db.sessions.filter(s => s.userUid === currentUser.uid && !s.isDeleted);
    if (mySessions.length === 0) {
        sidebarList.innerHTML = `<p class="text-center text-dim text-small py-2">No active chats. / কোনো সক্রিয় চ্যাট নেই।</p>`;
        return;
    }
    
    mySessions.forEach(session => {
        const item = document.createElement("div");
        item.className = `girl-chat-item ${activeSession && activeSession.id === session.id ? 'active' : ''}`;
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "chat-name";
        nameSpan.innerText = `${session.partnerAlias} ${session.isBlocked ? '🚫' : ''}`;
        nameSpan.onclick = () => loadChatSession(session.id);
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn-icon-small";
        deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm("Delete this chat session permanently? / এই চ্যাটটি পুরোপুরি ডিলিট করবেন?")) {
                deleteChatSession(session.id);
            }
        };
        
        item.appendChild(nameSpan);
        item.appendChild(deleteBtn);
        sidebarList.appendChild(item);
    });
}

function toggleBlockPartner() {
    if (!activeSession) return;
    
    activeSession.isBlocked = !activeSession.isBlocked;
    
    // Save locally
    const idx = db.sessions.findIndex(s => s.id === activeSession.id);
    if (idx >= 0) db.sessions[idx] = activeSession;
    saveLocalDB();
    
    // Sync remote
    if (useFirebase) {
        database.ref('sessions/' + activeSession.id).update({ isBlocked: activeSession.isBlocked });
    } else {
        syncToRemote("save_session", activeSession);
    }
    
    showToast(activeSession.isBlocked ? "Partner blocked successfully." : "Partner unblocked.");
    
    // Reload UI
    loadChatSession(activeSession.id);
}

function deleteActiveChat() {
    if (!activeSession) return;
    if (confirm("Delete this chat session permanently? / এই চ্যাটটি পুরোপুরি ডিলিট করবেন?")) {
        deleteChatSession(activeSession.id);
    }
}

function deleteChatSession(sessionId) {
    const session = db.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    session.isDeleted = true;
    
    // Save locally
    const idx = db.sessions.findIndex(s => s.id === sessionId);
    if (idx >= 0) db.sessions[idx] = session;
    saveLocalDB();
    
    // Sync remote
    if (useFirebase) {
        database.ref('sessions/' + sessionId).update({ isDeleted: true });
    } else {
        syncToRemote("save_session", session);
    }
    
    // If it was the active chat, close it
    if (activeSession && activeSession.id === sessionId) {
        activeSession = null;
        document.getElementById("random-chat-room").style.display = "none";
        document.getElementById("random-chat-welcome").style.display = "block";
    }
    
    showToast("Chat session deleted.");
    updateUI();
}

let lastRandomMsgCount = 0;
function renderRandomChatHistory(forceScroll = false) {
    const list = document.getElementById("random-chat-history");
    if (!list || !activeSession) return;
    
    const anonMessages = db.messages.filter(m => 
        m.isAnonymous && 
        m.anonSessionId === activeSession.id
    );
    
    const isNearBottom = list.scrollHeight - list.clientHeight - list.scrollTop < 60;
    const msgCountChanged = anonMessages.length !== lastRandomMsgCount;
    lastRandomMsgCount = anonMessages.length;
    
    let html = "";
    anonMessages.forEach(msg => {
        const isMe = msg.senderId === currentUser.uid;
        const isSystem = msg.senderId === "system";
        
        if (isSystem) {
            html += `
                <div class="chat-system-message" style="text-align: center; margin: 0.6rem 0; font-size: 0.8rem; color: var(--text-dim);">
                    <span>${msg.content}</span>
                </div>
            `;
        } else {
            html += `
                <div class="chat-bubble-row ${isMe ? 'me' : 'other'}">
                    <div class="chat-bubble">
                        ${msg.imageUrl ? `<img src="${msg.imageUrl}" class="bubble-image">` : ""}
                        ${msg.content ? `<span>${msg.content}</span>` : ""}
                        <span class="bubble-time">${msg.createdAt.substring(11, 16)}</span>
                    </div>
                </div>
            `;
        }
    });
    
    if (list.innerHTML !== html) {
        list.innerHTML = html;
        if (forceScroll || isNearBottom || msgCountChanged) {
            list.scrollTop = list.scrollHeight;
        }
    }
}

let anonAttachedImageBase64 = null;

function triggerAnonImageUpload() {
    document.getElementById("anon-image-input").click();
}

function previewAnonImage(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            anonAttachedImageBase64 = event.target.result;
            document.getElementById("anon-preview-tag").src = anonAttachedImageBase64;
            document.getElementById("anon-chat-img-attach-preview").style.display = "flex";
        };
        reader.readAsDataURL(file);
    }
}

function clearAnonAttachedImage() {
    anonAttachedImageBase64 = null;
    document.getElementById("anon-image-input").value = "";
    document.getElementById("anon-chat-img-attach-preview").style.display = "none";
}

function handleAnonChatKeyPress(e) {
    if (e.key === "Enter") {
        sendRandomChatMessage();
    }
}

function sendRandomChatMessage() {
    const input = document.getElementById("random-chat-input");
    const text = input.value.trim();
    if (!text && !anonAttachedImageBase64) return;
    
    if (!activeSession) return;
    
    if (activeSession.isBlocked) {
        alert("You cannot send messages to a blocked chat session.");
        return;
    }
    
    const censored = censorText(text);
    
    const newMsg = {
        id: "msg_" + Date.now(),
        senderId: currentUser.uid,
        receiverId: "admin_uid_7001646363",
        content: censored,
        imageUrl: anonAttachedImageBase64 || null,
        createdAt: new Date().toISOString(),
        isRead: false,
        isAnonymous: true,
        anonSessionId: activeSession.id,
        anonName: activeSession.userAlias
    };
    
    db.messages.push(newMsg);
    saveLocalDB();
    
    if (useFirebase) {
        database.ref('messages/' + newMsg.id).set(newMsg);
    } else {
        syncToRemote("save_message", newMsg);
    }
    
    input.value = "";
    clearAnonAttachedImage();
    renderRandomChatHistory(true);
    
    // Male user mock companion auto-reply simulation
    if (currentUser.gender === "Male" && currentUser.role !== "admin") {
        const maleReplies = [
            "Hi bro, details share koro. / হাই ব্রো, ডিটেইলস শেয়ার করো।",
            "Kemon acho? Valo? / কেমন আছো? ভালো?",
            "Ki korcho akhon? Ami toh just boshe achi. / কি করছো এখন? আমি তো জাস্ট বসে আছি।",
            "Ha ha, right. Amader privacy top priority ekhane. / হা হা, ঠিক। আমাদের প্রাইভেসী টপ প্রাইভেসী এখানে।",
            "Kothay thako tumi? / কোথায় থাকো তুমি?",
            "Ami Kolkata rain enjoy korchi. / আমি কলকাতা বৃষ্টি এনজয় করছি।",
            "Acha, ok bro. / আচ্ছা, ওকে ব্রো।"
        ];
        setTimeout(() => {
            if (!activeSession || activeSession.id !== newMsg.anonSessionId) return;
            const replyText = maleReplies[Math.floor(Math.random() * maleReplies.length)];
            const mockReply = {
                id: "msg_" + Date.now(),
                senderId: "mock_male",
                receiverId: currentUser.uid,
                content: replyText,
                createdAt: new Date().toISOString(),
                isRead: true,
                isAnonymous: true,
                anonSessionId: activeSession.id,
                anonName: activeSession.partnerAlias
            };
            db.messages.push(mockReply);
            saveLocalDB();
            if (activeSession && activeSession.id === mockReply.anonSessionId) {
                renderRandomChatHistory();
            }
        }, 1500 + Math.random() * 2000);
    }
}

// ==========================================
// 6. ADMIN PANEL LOGIC
// ==========================================

function showAdminPanel() {
    if (currentUser.role !== "admin") return;
    const screenMain = document.getElementById("screen-main");
    if (screenMain) screenMain.style.display = "none";
    const screenAdmin = document.getElementById("screen-admin-panel");
    if (screenAdmin) screenAdmin.style.display = "block";
    switchAdminTab("users");
}

function closeAdminPanel() {
    const screenAdmin = document.getElementById("screen-admin-panel");
    if (screenAdmin) screenAdmin.style.display = "none";
    const screenMain = document.getElementById("screen-main");
    if (screenMain) screenMain.style.display = "flex";
    syncFromRemote();
}

function switchAdminTab(tabId) {
    document.querySelectorAll(".btn-admin-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".admin-tab-view").forEach(v => v.classList.remove("active"));
    
    const activeBtn = document.querySelector(`.btn-admin-tab[data-atab="${tabId}"]`);
    const activeView = document.getElementById(`atab-${tabId}`);
    
    if (activeBtn) activeBtn.classList.add("active");
    if (activeView) activeView.classList.add("active");
    
    if (tabId === "users") loadAdminUsersList();
    if (tabId === "anon_chats") loadAdminAnonChats();
}

function loadAdminUsersList() {
    const list = document.getElementById("admin-users-list");
    list.innerHTML = "";
    
    // Omit admin users
    const users = db.users.filter(u => u.role !== "admin");
    if (users.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">No users registered yet. / কোনো নিবন্ধিত ব্যবহারকারী নেই।</p>`;
        return;
    }
    
    users.forEach(user => {
        const item = document.createElement("div");
        item.className = "admin-item-card glass-inner mb-05";
        item.style.display = "flex";
        item.style.gap = "1rem";
        item.style.alignItems = "center";
        item.style.padding = "1rem";
        
        const selfieSrc = user.verificationSelfie || "";
        const imageHtml = selfieSrc 
            ? `<img src="${selfieSrc}" style="width:70px; height:70px; border-radius:8px; object-fit:cover; border:1px solid var(--border-glass);" />` 
            : `<div style="width:70px; height:70px; border-radius:8px; background:var(--bg-glass-inner); display:flex; align-items:center; justify-content:center; font-size:2rem; border:1px solid var(--border-glass);">👤</div>`;
            
        item.innerHTML = `
            ${imageHtml}
            <div class="admin-item-info" style="flex:1;">
                <h4 style="margin:0; font-size:1.05rem;">Name: ${user.fullName} (${user.gender})</h4>
                <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-gray);">
                    <strong>Phone:</strong> ${user.phoneNumber} | <strong>Fake Name:</strong> <span class="text-cyan">${user.activeAnonName}</span>
                </p>
                <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-gray);">
                    <strong>Age:</strong> ${user.age} | <strong>City:</strong> ${user.city}
                </p>
            </div>
            <button class="btn btn-secondary btn-small" onclick="inspectUser('${user.uid}')">Inspect</button>
        `;
        list.appendChild(item);
    });
}

function inspectUser(uid) {
    const user = db.users.find(u => u.uid === uid);
    if (!user) return;
    
    inspectedUserUid = user.uid;
    
    document.getElementById("ins-name").innerText = user.fullName;
    document.getElementById("ins-phone").innerText = user.phoneNumber;
    document.getElementById("ins-password").innerText = user.password;
    document.getElementById("ins-age-gender").innerText = `Age: ${user.age} | ${user.gender} | Alias: ${user.activeAnonName}`;
    document.getElementById("ins-location").innerText = user.city;
    
    const insSelfieImg = document.getElementById("ins-selfie-img");
    if (insSelfieImg) {
        if (user.verificationSelfie) {
            insSelfieImg.src = user.verificationSelfie;
            insSelfieImg.style.display = "block";
        } else {
            insSelfieImg.src = "";
            insSelfieImg.style.display = "none";
        }
    }
    
    document.getElementById("dialog-user-inspect").style.display = "flex";
}

let inspectedUserUid = null;
function closeInspectDialog() {
    document.getElementById("dialog-user-inspect").style.display = "none";
    inspectedUserUid = null;
}

function deleteInspectedUser() {
    if (!inspectedUserUid) return;
    
    if (confirm("Delete this user permanently from the system?")) {
        db.users = db.users.filter(u => u.uid !== inspectedUserUid);
        saveLocalDB();
        
        if (useFirebase) {
            database.ref('users/' + inspectedUserUid).remove();
        } else {
            syncToRemote("delete_user", inspectedUserUid);
        }
        
        showToast("User deleted successfully.");
        closeInspectDialog();
        loadAdminUsersList();
    }
}

// Active anonymous chat list monitor
function loadAdminAnonChats() {
    const list = document.getElementById("admin-anon-chats-list");
    list.innerHTML = "";
    
    // Get all sessions created by girls (user role is female)
    const girlSessions = db.sessions.filter(s => {
        if (s.isDeleted) return false;
        const creator = db.users.find(u => u.uid === s.userUid);
        return creator && creator.gender === "Female";
    });
    
    if (girlSessions.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">No active anonymous chat sessions. / কোনো সক্রিয় চ্যাট নেই।</p>`;
        return;
    }
    
    girlSessions.forEach(session => {
        const girl = db.users.find(u => u.uid === session.userUid);
        if (!girl) return;
        
        const item = document.createElement("div");
        item.className = "admin-item-card glass-inner mb-05";
        item.style.display = "flex";
        item.style.gap = "1rem";
        item.style.alignItems = "center";
        item.style.padding = "1rem";
        
        const selfieSrc = girl.verificationSelfie || "";
        const imageHtml = selfieSrc 
            ? `<img src="${selfieSrc}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; border:1px solid var(--border-glass);" />` 
            : `<div style="width:50px; height:50px; border-radius:50%; background:var(--bg-glass-inner); display:flex; align-items:center; justify-content:center; font-size:1.5rem; border:1px solid var(--border-glass);">👤</div>`;
            
        item.innerHTML = `
            ${imageHtml}
            <div class="admin-item-info" style="flex:1;">
                <h4>Alias: ${session.userAlias} ⇆ Admin (as ${session.partnerAlias})</h4>
                <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-gray);">
                    <strong>Real Name:</strong> ${girl.fullName} | <strong>Phone:</strong> ${girl.phoneNumber}
                </p>
                <p style="margin:2px 0 0 0; font-size:0.85rem; color:var(--text-gray);">
                    <strong>City:</strong> ${girl.city} | <strong>Status:</strong> <span class="${session.isBlocked ? 'text-red' : 'text-green'}">${session.isBlocked ? 'Blocked' : 'Active'}</span>
                </p>
            </div>
            <button class="btn btn-secondary btn-small" onclick="openAdminAnonChatDialog('${session.id}')">Chat</button>
        `;
        list.appendChild(item);
    });
}

function openAdminAnonChatDialog(sessionId) {
    const session = db.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    activeAdminAnonTarget = session;
    
    const girl = db.users.find(u => u.uid === session.userUid);
    
    document.getElementById("admin-chat-partner-alias").innerText = `Chatting with ${session.userAlias} (as ${session.partnerAlias})`;
    document.getElementById("admin-chat-partner-real").innerText = `Real: ${girl ? girl.fullName : 'Unknown'} (${girl ? girl.phoneNumber : 'N/A'}) | City: ${girl ? girl.city : 'N/A'}`;
    
    const selfieSrc = girl ? girl.verificationSelfie : "";
    const avatarEl = document.getElementById("admin-chat-partner-avatar");
    if (avatarEl) {
        if (selfieSrc) {
            avatarEl.innerHTML = `<img src="${selfieSrc}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" />`;
        } else {
            avatarEl.innerText = "👩🏻";
        }
    }
    
    // Disable inputs if admin is blocked
    const textInput = document.getElementById("admin-anon-chat-input");
    const sendBtn = document.getElementById("btn-admin-send");
    if (session.isBlocked) {
        textInput.disabled = true;
        textInput.placeholder = "You are blocked by this user / আপনি ব্লকড আছেন";
        sendBtn.disabled = true;
    } else {
        textInput.disabled = false;
        textInput.placeholder = "Type a reply...";
        sendBtn.disabled = false;
    }
    
    document.getElementById("dialog-admin-anon-chat").style.display = "flex";
    renderAdminAnonChatHistory(true);
}

function closeAdminAnonChatDialog() {
    document.getElementById("dialog-admin-anon-chat").style.display = "none";
    activeAdminAnonTarget = null;
    clearAdminAttachedImage();
}

let lastAdminAnonMsgCount = 0;
function renderAdminAnonChatHistory(forceScroll = false) {
    const list = document.getElementById("admin-anon-chat-history");
    if (!list || !activeAdminAnonTarget) return;
    
    const anonMessages = db.messages.filter(m => 
        m.isAnonymous && 
        m.anonSessionId === activeAdminAnonTarget.id
    );
    
    const isNearBottom = list.scrollHeight - list.clientHeight - list.scrollTop < 60;
    const msgCountChanged = anonMessages.length !== lastAdminAnonMsgCount;
    lastAdminAnonMsgCount = anonMessages.length;
    
    let html = "";
    anonMessages.forEach(msg => {
        const isMe = msg.senderId === "admin_uid_7001646363";
        const isSystem = msg.senderId === "system";
        
        if (isSystem) {
            html += `
                <div class="chat-system-message" style="text-align: center; margin: 0.6rem 0; font-size: 0.8rem; color: var(--text-dim);">
                    <span>${msg.content}</span>
                </div>
            `;
        } else {
            let actionsRow = "";
            if (msg.imageUrl) {
                actionsRow = `
                    <div class="lightbox-actions-row mt-05" style="gap:10px">
                        <span style="font-size:0.75rem; color:#00f0ff; cursor:pointer; font-weight:bold" onclick="saveAdminImage('${msg.imageUrl}')">Save</span>
                    </div>
                `;
            }
            const msgEscaped = JSON.stringify(msg).replace(/'/g, "\\'").replace(/"/g, "&quot;");
            
            html += `
                <div class="chat-bubble-row ${isMe ? 'me' : 'other'}">
                    <div class="chat-bubble">
                        ${msg.imageUrl ? `<img src="${msg.imageUrl}" class="bubble-image" onclick="openLightbox('${msg.imageUrl}', ${msgEscaped})">` : ""}
                        ${actionsRow}
                        ${msg.content ? `<span>${msg.content}</span>` : ""}
                        <span class="bubble-time">${msg.createdAt.substring(11, 16)}</span>
                    </div>
                </div>
            `;
        }
    });
    
    if (list.innerHTML !== html) {
        list.innerHTML = html;
        if (forceScroll || isNearBottom || msgCountChanged) {
            list.scrollTop = list.scrollHeight;
        }
    }
}

function saveAdminImage(url) {
    const link = document.createElement("a");
    link.href = url;
    link.download = `mon_khule_bolo_admin_image_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Selfie/Image saved successfully!");
}

let adminSelectedImageBase64 = null;

function triggerAdminImageUpload() {
    document.getElementById("admin-image-input").click();
}

function previewAdminImage(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            adminSelectedImageBase64 = event.target.result;
            document.getElementById("admin-preview-tag").src = adminSelectedImageBase64;
            document.getElementById("admin-chat-img-attach-preview").style.display = "flex";
        };
        reader.readAsDataURL(file);
    }
}

function clearAdminAttachedImage() {
    adminSelectedImageBase64 = null;
    document.getElementById("admin-image-input").value = "";
    document.getElementById("admin-chat-img-attach-preview").style.display = "none";
}

function handleAdminChatKeyPress(e) {
    if (e.key === "Enter") {
        sendAdminAnonChatMessage();
    }
}

function sendAdminAnonChatMessage() {
    const input = document.getElementById("admin-anon-chat-input");
    const text = input.value.trim();
    if (!text && !adminSelectedImageBase64) return;
    
    if (!activeAdminAnonTarget) return;
    
    if (activeAdminAnonTarget.isBlocked) {
        alert("You are blocked by this user.");
        return;
    }
    
    const censored = censorText(text);
    
    const newMsg = {
        id: "msg_" + Date.now(),
        senderId: "admin_uid_7001646363",
        receiverId: activeAdminAnonTarget.userUid,
        content: censored,
        imageUrl: adminSelectedImageBase64 || null,
        createdAt: new Date().toISOString(),
        isRead: false,
        isAnonymous: true,
        anonSessionId: activeAdminAnonTarget.id,
        anonName: activeAdminAnonTarget.userAlias
    };
    
    db.messages.push(newMsg);
    saveLocalDB();
    
    if (useFirebase) {
        database.ref('messages/' + newMsg.id).set(newMsg);
    } else {
        syncToRemote("save_message", newMsg);
    }
    
    input.value = "";
    clearAdminAttachedImage();
    renderAdminAnonChatHistory(true);
}

// ==========================================
// 7. LIGHTBOX & SAVING BLOCKERS
// ==========================================

function openLightbox(url, msgObj = null) {
    const lb = document.getElementById("lightbox");
    const img = document.getElementById("lightbox-img");
    if (!lb || !img) return;
    
    img.src = url;
    activeLightboxMsg = msgObj;
    
    // Display admin actions if user is Admin
    const actions = document.getElementById("lightbox-admin-actions");
    if (actions) {
        actions.style.display = (currentUser && currentUser.role === "admin") ? "flex" : "none";
    }
    
    lb.style.display = "flex";
}

function closeLightbox() {
    const lb = document.getElementById("lightbox");
    if (lb) lb.style.display = "none";
    activeLightboxMsg = null;
}

function saveLightboxImage() {
    if (activeLightboxMsg && activeLightboxMsg.imageUrl) {
        saveAdminImage(activeLightboxMsg.imageUrl);
    }
}

function deleteLightboxImage() {
    if (activeLightboxMsg) {
        if (confirm("Delete this message and image from the database?")) {
            db.messages = db.messages.filter(m => m.id !== activeLightboxMsg.id);
            saveLocalDB();
            
            if (useFirebase) {
                database.ref('messages/' + activeLightboxMsg.id).remove();
            } else {
                syncToRemote("delete_message", activeLightboxMsg.id);
            }
            
            closeLightbox();
            if (activeAdminAnonTarget) renderAdminAnonChatHistory();
            showToast("Message deleted successfully.");
        }
    }
}

function disableUserMediaSaving() {
    // Disable context menu for users
    document.addEventListener("contextmenu", function(e) {
        if (currentUser && currentUser.role === "admin") return;
        
        if (e.target.tagName === "IMG" || e.target.closest(".chat-history") || e.target.closest(".lightbox-content")) {
            e.preventDefault();
            showToast("Saving / Screenshotting is disabled for safety! / সুরক্ষার স্বার্থে ছবি সেভ করা বন্ধ রয়েছে।");
        }
    });

    // Disable dragging on images
    document.addEventListener("dragstart", function(e) {
        if (currentUser && currentUser.role === "admin") return;
        if (e.target.tagName === "IMG") {
            e.preventDefault();
        }
    });

    // Disable text selection on chat history window
    document.addEventListener("selectstart", function(e) {
        if (currentUser && currentUser.role === "admin") return;
        if (e.target.closest(".chat-history") || e.target.closest(".lightbox-content")) {
            e.preventDefault();
        }
    });

    // Block keyboard combinations (Ctrl+S, Ctrl+P, Ctrl+C)
    document.addEventListener("keydown", function(e) {
        if (currentUser && currentUser.role === "admin") return;
        
        if (e.ctrlKey && (e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P" || e.key === "c" || e.key === "C")) {
            e.preventDefault();
            showToast("Saving / Printing is disabled for safety! / সুরক্ষার স্বার্থে ছবি সেভ করা বন্ধ রয়েছে।");
        }
    });
}

// ==========================================
// 8. HELPERS & GENERAL EVENT LISTENERS
// ==========================================

function setupEventListeners() {
    document.querySelectorAll(".dialog-overlay, .lightbox-overlay").forEach(overlay => {
        overlay.addEventListener("click", function(e) {
            if (e.target === this) {
                this.style.display = "none";
                activeLightboxMsg = null;
            }
        });
    });
}

function showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<i class="fas fa-info-circle text-magenta"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function toggleTheme() {
    const isDark = document.body.classList.toggle("dark-theme");
    const themeIcon = document.getElementById("theme-icon");
    if (themeIcon) {
        themeIcon.className = isDark ? "fas fa-sun" : "fas fa-moon";
    }
}

function censorText(text) {
    if (!text) return "";
    let censored = text;
    db.blacklist.forEach(word => {
        const regex = new RegExp("\\b" + word + "\\b", "gi");
        censored = censored.replace(regex, "***");
    });
    return censored;
}
