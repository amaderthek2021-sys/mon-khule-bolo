// Mon Khule Bolo - Web Client Controller
// Shared Google Apps Script Database Sync Logic

// Paste your deployed Google Apps Script Web App URL here to sync the website and APK databases!
const API_URL = "https://script.google.com/macros/s/AKfycbzDJLrL3DyaanXajhO9mPx9MY3F6WV698l8vy02ElmoDXTG7asJz2vdZG_evhHvlSEnpw/exec"; 

// Local/Offline Fallback State (seeded with the same mock data as the Android App)
let db = {
    users: [],
    posts: [],
    comments: [],
    messages: [],
    notifications: [],
    chatRequests: [],
    blacklist: ["badword", "spam", "abuse"]
};

// Current Session State
let currentUser = null;
let currentLanguage = "bn"; // "bn" or "en"
let selectedCategory = "";
let currentMatchedPartner = null;
let isSearchingPartner = false;
let activeAdminAnonTarget = null;
let activeLightboxMsg = null;

// Translation resources
const translations = {
    bn: {
        chat_anonymous: "র‍্যান্ডম চ্যাট",
        home: "হোম ফিড",
        explore: "অনুসন্ধান",
        categories: "ক্যাটাগরি",
        notifications: "নোটিফিকেশন",
        messages: "মেসেজ",
        profile: "প্রোফাইল",
        download_app: "অ্যাপ ডাউনলোড"
    },
    en: {
        chat_anonymous: "Random Chat",
        home: "Home Feed",
        explore: "Explore",
        categories: "Categories",
        notifications: "Notifications",
        messages: "Messages",
        profile: "Profile",
        download_app: "Download App"
    }
};

// ==========================================
// 1. DATABASE & INITIALIZATION LOGIC
// ==========================================

window.onload = function() {
    loadLocalSession();
    initializeDatabase();
    syncFromRemote();
    setupEventListeners();
    updateUI();
    initNebulaCanvas();
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

function initNebulaCanvas() {
    const canvas = document.getElementById('nebula-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let particles = [];
    const particleCount = 60;
    const maxDistance = 120;
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    let mouse = { x: null, y: null };
    
    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });
    
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    
    window.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });
    
    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.radius = Math.random() * 2 + 1;
            this.color = Math.random() > 0.5 ? '#ff007f' : '#00f0ff';
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 6;
            ctx.shadowColor = this.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
    
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            p1.update();
            p1.draw();
            
            if (mouse.x !== null && mouse.y !== null) {
                const dx = p1.x - mouse.x;
                const dy = p1.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < maxDistance) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.strokeStyle = `rgba(0, 240, 255, ${1 - dist / maxDistance})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
            
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < maxDistance) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * (1 - dist / maxDistance)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
}

function activateZeroGravity(event) {
    if (event) event.stopPropagation();
    const app = document.getElementById('app');
    if (!app) return;
    
    if (app.classList.contains('zero-gravity')) {
        app.classList.remove('zero-gravity');
        showToast('Normal Gravity Restored! 🌍', 'info');
    } else {
        app.classList.add('zero-gravity');
        showToast('Zero-Gravity Mode Activated! Let your mind float freely. 🧑‍🚀🌌', 'success');
        
        const ripple = document.createElement('div');
        ripple.className = 'cosmic-ripple';
        ripple.style.left = `${event.clientX}px`;
        ripple.style.top = `${event.clientY}px`;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 1000);
    }
}

function initializeDatabase() {
    // Seed initial users matching Android seed data if database is empty
    if (!localStorage.getItem("mon_khule_bolo_db")) {
        db.users = [
            {
                uid: "admin_uid_7001646363",
                phoneNumber: "7001646363",
                fullName: "Admin Mod (অ্যাডমিন)",
                username: "admin_mkhb",
                password: "7001646363",
                age: 30,
                gender: "Other",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Kolkata (কলকাতা)",
                city: "Kolkata City (কলকাতা শহর)",
                role: "admin",
                isVerified: true,
                profilePicUrl: "👽",
                bio: "নিরাপত্তা নিরীক্ষক।"
            },
            // Males (5)
            {
                uid: "user_rohan_1",
                phoneNumber: "+919000011111",
                fullName: "Rohan Sen",
                username: "rohan_sen",
                password: "password",
                age: 22,
                gender: "Male (পুরুষ)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Kolkata (কলকাতা)",
                city: "Kolkata City (কলকাতা শহর)",
                isVerified: true,
                nickname: "Pathik (পথিক)",
                bio: "আমি গল্প পড়তে আর নতুন মানুষের সাথে আড্ডা দিতে ভালোবাসি।",
                role: "user",
                profilePicUrl: "👨🏻"
            },
            {
                uid: "user_joy_3",
                phoneNumber: "+919000033333",
                fullName: "Joydeb Tripura",
                username: "joy_tripura",
                password: "password",
                age: 24,
                gender: "Male (পুরুষ)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Howrah (হাওড়া)",
                city: "Howrah City (হাওড়া শহর)",
                isVerified: true,
                nickname: "Howrah-r Chhele (হাওড়ার ছেলে)",
                bio: "চাকরির পরীক্ষার প্রস্তুতি নিচ্ছি।",
                role: "user",
                profilePicUrl: "🧔"
            },
            {
                uid: "user_subrata_4",
                phoneNumber: "+919000033334",
                fullName: "Subrata Paul",
                username: "subrata_p",
                password: "password",
                age: 26,
                gender: "Male (পুরুষ)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Hooghly (হুগলি)",
                city: "Chinsurah (চুঁচুড়া)",
                isVerified: true,
                nickname: "Hooghly Wanderer",
                bio: "ফটোগ্রাফি আমার নেশা।",
                role: "user",
                profilePicUrl: "👨🏽‍💻"
            },
            {
                uid: "user_sourav_5",
                phoneNumber: "+919000033335",
                fullName: "Sourav Ganguly",
                username: "sourav_g",
                password: "password",
                age: 28,
                gender: "Male (পুরুষ)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Kolkata (কলকাতা)",
                city: "Behala (বেহালা)",
                isVerified: true,
                nickname: "Dada",
                bio: "খেলার মাঠ আর বইয়ের জগৎ আমার খুব পছন্দের।",
                role: "user",
                profilePicUrl: "👨🏻"
            },
            {
                uid: "user_avik_6",
                phoneNumber: "+919000033336",
                fullName: "Avik Sarkar",
                username: "avik_s",
                password: "password",
                age: 23,
                gender: "Male (পুরুষ)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Nadia (নদীয়া)",
                city: "Kalyani (কল্যাণী)",
                isVerified: true,
                nickname: "Midnight Thinker",
                bio: "রাত জেগে কোডিং করা আর গান শোনা আমার অভ্যাস।",
                role: "user",
                profilePicUrl: "🧔"
            },
            // Females (10)
            {
                uid: "user_sneha_2",
                phoneNumber: "+919000022222",
                fullName: "Sneha Das",
                username: "sneha_das",
                password: "password",
                age: 20,
                gender: "Female (মহিলা)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "North 24 Parganas (উত্তর ২৪ পরগনা)",
                city: "Salt Lake (সল্টলেক)",
                isVerified: true,
                nickname: "Meghe Dhaka Tara (মেঘে ঢাকা তারা)",
                bio: "মন খুলে কথা বলতে আমি এখানে এসেছি।",
                role: "user",
                profilePicUrl: "👩🏻"
            },
            {
                uid: "user_riya_7",
                phoneNumber: "+919000022223",
                fullName: "Riya Sen",
                username: "riya_sen",
                password: "password",
                age: 24,
                gender: "Female (মহিলা)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Kolkata (কলকাতা)",
                city: "Gariahat (গড়িয়াহাট)",
                isVerified: true,
                nickname: "Naughty Cat",
                bio: "সবাইকে ভালো বন্ধু মনে করি।",
                role: "user",
                profilePicUrl: "👧🏽"
            },
            {
                uid: "user_payel_8",
                phoneNumber: "+919000022224",
                fullName: "Payel Dey",
                username: "payel_dey",
                password: "password",
                age: 25,
                gender: "Female (মহিলা)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Howrah (হাওড়া)",
                city: "Bally (বালি)",
                isVerified: true,
                nickname: "Ochena Pakhi",
                bio: "পাহাড় ভালোবাসে এমন মানুষ খুঁজছি।",
                role: "user",
                profilePicUrl: "👩🏼‍💼"
            },
            {
                uid: "user_anjali_9",
                phoneNumber: "+919000022225",
                fullName: "Anjali Roy",
                username: "anjali_roy",
                password: "password",
                age: 21,
                gender: "Female (মহিলা)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Paschim Bardhaman (পশ্চিম বর্ধমান)",
                city: "Durgapur (দুর্গাপুর)",
                isVerified: true,
                nickname: "Mishti Meye",
                bio: "মিউজিক থেরাপি আমার ভীষণ পছন্দের।",
                role: "user",
                profilePicUrl: "👩🏻"
            },
            {
                uid: "user_tanushree_10",
                phoneNumber: "+919000022226",
                fullName: "Tanushree Bose",
                username: "tanushree_b",
                password: "password",
                age: 22,
                gender: "Female (মহিলা)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Kolkata (কলকাতা)",
                city: "Jadavpur (যাদবপুর)",
                isVerified: true,
                nickname: "Nil Pori",
                bio: "কবিতা ও উপন্যাসে আমার বাস।",
                role: "user",
                profilePicUrl: "👧🏽"
            },
            {
                uid: "user_moumita_11",
                phoneNumber: "+919000022227",
                fullName: "Moumita Saha",
                username: "moumita_s",
                password: "password",
                age: 23,
                gender: "Female (মহিলা)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Hooghly (হুগলি)",
                city: "Serampore (শ্রীরামপুর)",
                isVerified: true,
                nickname: "Brishti",
                bio: "বৃষ্টির দিনে কফি আর ভালো মুভি খুবই প্রিয়।",
                role: "user",
                profilePicUrl: "👩🏼‍💼"
            },
            {
                uid: "user_priya_12",
                phoneNumber: "+919000022228",
                fullName: "Priya Chakraborty",
                username: "priya_c",
                password: "password",
                age: 24,
                gender: "Female (মহিলা)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "North 24 Parganas (উত্তর ২৪ পরগনা)",
                city: "Dum Dum (দমদম)",
                isVerified: true,
                nickname: "Rupkotha",
                bio: "মিষ্টি চ্যাটিং এবং নতুন মানুষের অভিজ্ঞতা শুনতে ভালোবাসি।",
                role: "user",
                profilePicUrl: "👩🏻"
            },
            {
                uid: "user_deboleena_13",
                phoneNumber: "+919000022229",
                fullName: "Deboleena Dutt",
                username: "deboleena_d",
                password: "password",
                age: 26,
                gender: "Female (মহিলা)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "South 24 Parganas (দক্ষিণ ২৪ পরগনা)",
                city: "Baruipur (বারুইপুর)",
                isVerified: true,
                nickname: "Boba Kanna",
                bio: "খুব সাধারণ মানুষ আমি।",
                role: "user",
                profilePicUrl: "👧🏽"
            },
            {
                uid: "user_keya_14",
                phoneNumber: "+919000022230",
                fullName: "Keya Ghosal",
                username: "keya_g",
                password: "password",
                age: 27,
                gender: "Female (মহিলা)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Birbhum (বীরভূম)",
                city: "Bolpur (বোলপুর)",
                isVerified: true,
                nickname: "Sonajhuri",
                bio: "শান্তিনিকেতনের লাল মাটির দেশ আমার ঠিকানা।",
                role: "user",
                profilePicUrl: "👩🏼‍💼"
            },
            {
                uid: "user_shreya_15",
                phoneNumber: "+919000022231",
                fullName: "Shreya Ghoshal",
                username: "shreya_g",
                password: "password",
                age: 21,
                gender: "Female (মহিলা)",
                state: "West Bengal (পশ্চিমবঙ্গ)",
                district: "Murshidabad (মুর্শিদাবাদ)",
                city: "Baharampur (বহরমপুর)",
                isVerified: true,
                nickname: "Lal Pori",
                bio: "গান গেয়ে নতুন দিন শুরু করতে ভালো লাগে।",
                role: "user",
                profilePicUrl: "👩🏻"
            }
        ];
        
        db.posts = [
            {
                id: "post_1",
                userId: "user_riya_7",
                authorName: "Riya Sen",
                authorUsername: "riya_sen",
                postMode: "anonymous",
                type: "text",
                category: "Naughty Thoughts",
                content: "আমার বয়স ২৪। কখনো কখনো মনে হয় একটা থ্রি-সাম (threesome) ট্রাই করলে কেমন হতো? কিন্তু আমাদের সমাজে তো এসব বললে সবাই খারাপ ভাববে। এখানে কি আর কেউ এমন চিন্তা করেন? 🫣",
                createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
                userLocationState: "West Bengal (পশ্চিমবঙ্গ)",
                userLocationDistrict: "Kolkata (কলকাতা)",
                reactions: { "Like": ["user_rohan_1", "user_joy_3"], "Dislike": [] },
                commentsCount: 2,
                isApproved: true
            },
            {
                id: "post_2",
                userId: "user_sourav_5",
                authorName: "Sourav Ganguly",
                authorUsername: "sourav_g",
                postMode: "nickname",
                nickname: "Moner Kotha",
                type: "text",
                category: "Confession",
                content: "বিয়ের ৩ বছর পর মনে হচ্ছে আমি আসলে অন্য কারো প্রেমে পড়েছি। আমার স্ত্রীর সাথে সম্পর্ক ভালো, কিন্তু কোনো রোমান্স নেই। এটা কি ভুল করছি? 😔",
                createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
                userLocationState: "West Bengal (পশ্চিমবঙ্গ)",
                userLocationDistrict: "Kolkata (কলকাতা)",
                reactions: { "Like": ["user_payel_8"], "Dislike": ["user_rohan_1"] },
                commentsCount: 1,
                isApproved: true
            },
            {
                id: "post_3",
                userId: "user_payel_8",
                authorName: "Payel Dey",
                authorUsername: "payel_dey",
                postMode: "anonymous",
                type: "text",
                category: "Dark Secret",
                content: "মাঝে মাঝে অফিসের কলিগের দিকে এমনভাবে তাকাই যা ঠিক নয়। সে বিবাহিত এবং আমিও রিলেশনে আছি। কিন্তু ওর প্রতি একটা অদ্ভুত আকর্ষণ ফিল করি। এটা কীভাবে থামাবো?",
                createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
                userLocationState: "West Bengal (পশ্চিমবঙ্গ)",
                userLocationDistrict: "Howrah (হাওড়া)",
                reactions: { "Like": ["user_sourav_5"], "Dislike": [] },
                commentsCount: 1,
                isApproved: true
            },
            {
                id: "post_4",
                userId: "user_moumita_11",
                authorName: "Moumita Saha",
                authorUsername: "moumita_s",
                postMode: "anonymous",
                type: "text",
                category: "Secret Crush",
                content: "আমাদের পাড়ার মোড়ের চা দোকানের ছেলেটিকে আমার খুব ভালো লাগে। ও যখন মুচকি হেসে চা দেয়, আমার দিনটা ভালো হয়ে যায়। ☺️ কিন্তু বলতে সাহস পাই না।",
                createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
                userLocationState: "West Bengal (পশ্চিমবঙ্গ)",
                userLocationDistrict: "Hooghly (হুগলি)",
                reactions: { "Like": ["user_rohan_1", "user_subrata_4"], "Dislike": [] },
                commentsCount: 1,
                isApproved: true
            },
            {
                id: "post_5",
                userId: "user_keya_14",
                authorName: "Keya Ghosal",
                authorUsername: "keya_g",
                postMode: "nickname",
                nickname: "Sonajhuri",
                type: "text",
                category: "Confession",
                content: "কলেজ লাইফে এক বান্ধবীর বয়ফ্রেন্ডকে আমি মনে মনে পছন্দ করতাম। তারা যখন ঝগড়া করত, আমি মনে মনে খুশি হতাম। এই নোংরা মানসিকতার জন্য আমি নিজেকে ক্ষমা করতে পারি না।",
                createdAt: new Date(Date.now() - 10 * 3600000).toISOString(),
                userLocationState: "West Bengal (পশ্চিমবঙ্গ)",
                userLocationDistrict: "Birbhum (বীরভূম)",
                reactions: { "Like": [], "Dislike": ["user_joy_3"] },
                commentsCount: 1,
                isApproved: true
            },
            {
                id: "post_6",
                userId: "user_sneha_2",
                authorName: "Sneha Das",
                authorUsername: "sneha_das",
                postMode: "anonymous",
                type: "text",
                category: "Confession",
                content: "কলেজ লাইফে আমার ডিপার্টমেন্টের এক সিনিয়রকে খুব ভালোবাসতাম। কিন্তু কখনো বলার সাহস পাইনি। সে এখন অন্য শহরে চাকরি করে চলে গেছে। আজও তার কথা মনে পড়লে বুকটা ভারী হয়ে যায়। 😢",
                createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
                userLocationState: "West Bengal (পশ্চিমবঙ্গ)",
                userLocationDistrict: "North 24 Parganas (উত্তর ২৪ পরগনা)",
                reactions: { "Like": ["user_rohan_1"], "Dislike": [] },
                commentsCount: 2,
                isApproved: true
            }
        ];

        db.comments = [
            {
                id: "comment_1",
                postId: "post_1",
                userId: "user_rohan_1",
                authorName: "Rohan Sen",
                authorUsername: "rohan_sen",
                postMode: "nickname",
                nickname: "Pathik (পথিক)",
                content: "এখানে অনেকেই নিজের মনের ফ্যান্টাসি শেয়ার করেন। আপনি দ্বিধাহীনভাবে কথা বলতে পারেন!",
                createdAt: new Date(Date.now() - 1 * 3600000).toISOString()
            },
            {
                id: "comment_2",
                postId: "post_1",
                userId: "user_joy_3",
                authorName: "Joydeb Tripura",
                authorUsername: "joy_tripura",
                postMode: "anonymous",
                content: "স্বীকারোক্তি করার জন্য ধন্যবাদ। বেনামী চ্যাট ট্রাই করে দেখতে পারেন নতুন কাউকে জানার জন্য।",
                createdAt: new Date(Date.now() - 30 * 60000).toISOString()
            },
            {
                id: "comment_3",
                postId: "post_2",
                userId: "user_payel_8",
                authorName: "Payel Dey",
                authorUsername: "payel_dey",
                postMode: "nickname",
                nickname: "Ochena Pakhi",
                content: "আগে স্ত্রীর সাথে খোলাখুলি কথা বলুন। ভুল বুঝাবুঝি মিটিয়ে নেওয়ার চেষ্টা করুন।",
                createdAt: new Date(Date.now() - 3 * 3600000).toISOString()
            },
            {
                id: "comment_4",
                postId: "post_3",
                userId: "user_sourav_5",
                authorName: "Sourav Ganguly",
                authorUsername: "sourav_g",
                postMode: "real_name",
                content: "একটু দূরত্ব বজায় রাখাই ভালো হবে। আকর্ষণ স্বাভাবিক কিন্তু নিজেকে কন্ট্রোল করা দরকার।",
                createdAt: new Date(Date.now() - 5 * 3600000).toISOString()
            }
        ];

        db.notifications = [
            {
                id: "noti_1",
                userId: "user_sneha_2",
                title: "আপনার স্বীকারোক্তিতে নতুন মন্তব্য এসেছে",
                body: "আপনার বেনামী পোস্টে একজন মন্তব্য করেছেন: 'খুব সুন্দর লিখেছেন...'",
                createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
                type: "comment",
                isRead: false
            }
        ];
        
        saveLocalDB();
    } else {
        db = JSON.parse(localStorage.getItem("mon_khule_bolo_db"));
    }
}

function saveLocalDB() {
    localStorage.setItem("mon_khule_bolo_db", JSON.stringify(db));
}

function loadLocalSession() {
    const sessionUser = localStorage.getItem("mon_khule_bolo_session");
    if (sessionUser) {
        currentUser = JSON.parse(sessionUser);
        document.body.classList.add("logged-in");
        if (currentUser.role === "admin") {
            document.getElementById("btn-admin-panel").style.display = "flex";
        }
    }
}

// Remote DB Apps Script Synchronization
async function syncFromRemote() {
    if (!API_URL) return;
    try {
        const response = await fetch(API_URL);
        const remoteData = await response.json();
        if (remoteData && remoteData.users) {
            db.users = remoteData.users || [];
            db.posts = remoteData.posts || [];
            db.comments = remoteData.comments || [];
            db.messages = remoteData.messages || [];
            db.notifications = remoteData.notifications || [];
            db.chatRequests = remoteData.chatRequests || [];
            db.blacklist = remoteData.blacklist || [];
            saveLocalDB();
            
            // Refresh currentUser session if details changed remotely
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
    }
}

async function syncToRemote(action, payload) {
    if (!API_URL) return;
    try {
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: action, payload: payload }),
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        console.error("Failed to push sync to remote DB:", err);
    }
}

// ==========================================
// 2. SCREEN ROUTING & TAB NAVIGATION
// ==========================================

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add("active");
    
    // Auto reset verify badges when leaving registration
    if (screenId !== "screen-register") {
        mockSelfieBase64 = null;
        mockGalleryBase64 = [];
        document.getElementById("selfie-status").className = "status-badge red";
        document.getElementById("selfie-status").innerText = "সেলফি বাকি ❌";
        document.getElementById("gallery-status").className = "status-badge red";
        document.getElementById("gallery-status").innerText = "গ্যালারি বাকি ❌";
    }
}

function switchTab(tabId) {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".tab-view").forEach(view => view.classList.remove("active"));
    
    const activeItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    const activeView = document.getElementById(`tab-${tabId}`);
    
    if (activeItem) activeItem.classList.add("active");
    if (activeView) activeView.classList.add("active");
    
    // Dynamic titles
    const indicator = currentLanguage.toUpperCase();
    document.getElementById("header-title").innerText = translations[currentLanguage][tabId.replace("-", "_")] || tabId;
    
    if (tabId === "home") renderFeed();
    if (tabId === "explore") renderExplore();
    if (tabId === "notifications") renderNotifications();
    if (tabId === "messages") renderInbox();
    if (tabId === "random-chat") renderRandomChatWelcome();
    if (tabId === "profile") renderProfile();
}

function toggleLanguage() {
    currentLanguage = currentLanguage === "bn" ? "en" : "bn";
    document.getElementById("lang-indicator").innerText = currentLanguage.toUpperCase();
    
    // Redraw active tab
    const activeTab = document.querySelector(".nav-item.active").getAttribute("data-tab");
    switchTab(activeTab);
}

function toggleTheme() {
    const isLight = document.body.classList.toggle("light-theme");
    const themeIcon = document.getElementById("theme-icon");
    if (isLight) {
        themeIcon.className = "fas fa-sun";
    } else {
        themeIcon.className = "fas fa-moon";
    }
}

// ==========================================
// 3. REGISTRATION & VERIFICATION SIMULATION
// ==========================================

let mockSelfieBase64 = null;
let mockGalleryBase64 = [];
let customProfilePicBase64 = null;

function triggerRealSelfie() {
    document.getElementById("real-selfie-input").click();
}

function handleRealSelfie(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        mockSelfieBase64 = e.target.result;
        document.getElementById("selfie-status").className = "status-badge green";
        document.getElementById("selfie-status").innerText = "সেলফি সম্পূর্ণ ✅";
        showToast("Selfie loaded successfully!");
    };
    reader.readAsDataURL(file);
}

function triggerRealGallery() {
    document.getElementById("real-gallery-input").click();
}

function handleRealGallery(event) {
    const files = Array.from(event.target.files);
    if (files.length < 3) {
        alert("দয়া করে অন্তত ৩টি ছবি নির্বাচন করুন। (Please select at least 3 photos)");
        return;
    }
    
    mockGalleryBase64 = [];
    let loaded = 0;
    
    // Read first 3 files
    for (let i = 0; i < 3; i++) {
        const reader = new FileReader();
        reader.onload = function(e) {
            mockGalleryBase64.push(e.target.result);
            loaded++;
            if (loaded === 3) {
                document.getElementById("gallery-status").className = "status-badge green";
                document.getElementById("gallery-status").innerText = "৩টি ছবি আপলোড সম্পূর্ণ ✅";
                showToast("3 Gallery photos loaded successfully!");
            }
        };
        reader.readAsDataURL(files[i]);
    }
}

function triggerProfilePicUpload() {
    document.getElementById("real-profile-pic-input").click();
}

function handleRealProfilePic(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        customProfilePicBase64 = e.target.result;
        
        // Show circular image preview inside trigger button
        const trigger = document.getElementById("avatar-upload-trigger");
        trigger.innerHTML = `<img src="${customProfilePicBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
        
        // Select custom avatar
        selectAvatar("avatar_custom");
        showToast("Profile Picture uploaded!");
    };
    reader.readAsDataURL(file);
}

function handleRegister(e) {
    e.preventDefault();
    
    if (!mockSelfieBase64 || mockGalleryBase64.length < 3) {
        alert("দয়া করে সেলফি এবং ৩টি গ্যালারি ছবি আপলোড করুন! (Selfie and 3 verification images required)");
        return;
    }
    
    const phone = document.getElementById("reg-phone").value.trim();
    
    // Check duplication
    if (db.users.some(u => u.phoneNumber === phone || u.phoneNumber === "+91" + phone)) {
        alert("এই ফোন নম্বরটি দিয়ে ইতিমধ্যে রেজিস্ট্রেশন করা আছে।");
        return;
    }
    
    // Determine profile avatar: either custom uploaded Base64 or selected Emoji
    const selectedOption = document.querySelector(".avatar-option.selected");
    let selectedAvatar = "👨🏻";
    if (selectedOption) {
        const avatarType = selectedOption.getAttribute("data-avatar");
        if (avatarType === "avatar_custom") {
            if (!customProfilePicBase64) {
                alert("দয়া করে প্রথমে একটি প্রোফাইল ছবি আপলোড করুন।");
                return;
            }
            selectedAvatar = customProfilePicBase64;
        } else {
            selectedAvatar = selectedOption.innerText;
        }
    }
    
    const newUser = {
        uid: "user_" + Date.now(),
        phoneNumber: phone.startsWith("+91") ? phone : "+91" + phone,
        fullName: document.getElementById("reg-name").value.trim(),
        username: document.getElementById("reg-username").value.trim(),
        email: document.getElementById("reg-email").value.trim() || null,
        password: document.getElementById("reg-password").value.trim(),
        age: parseInt(document.getElementById("reg-age").value),
        gender: document.getElementById("reg-gender").value,
        state: document.getElementById("reg-state").value,
        district: document.getElementById("reg-district").value,
        city: document.getElementById("reg-city").value.trim(),
        nickname: document.getElementById("reg-nickname").value.trim(),
        profilePicUrl: selectedAvatar,
        bio: "আমি মন খুলে বলো অ্যাপ ব্যবহার করছি!",
        role: "user",
        isVerified: true, // Auto-verified by default as requested!
        verificationSelfie: mockSelfieBase64,
        verificationGalleryImages: mockGalleryBase64,
        registrationIp: "127.0.0.1",
        isBanned: false,
        isSuspended: false,
        suspendedUntil: null
    };
    
    db.users.push(newUser);
    saveLocalDB();
    syncToRemote("save_user", newUser);
    
    // Auto-login the newly registered user immediately!
    currentUser = newUser;
    localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
    document.body.classList.add("logged-in");
    
    document.getElementById("form-register").reset();
    
    // Clear registration state flags
    mockSelfieBase64 = null;
    mockGalleryBase64 = [];
    customProfilePicBase64 = null;
    const trigger = document.getElementById("avatar-upload-trigger");
    if (trigger) trigger.innerHTML = `<i class="fas fa-image"></i>`;
    document.getElementById("selfie-status").className = "status-badge red";
    document.getElementById("selfie-status").innerText = "সেলফি বাকি ❌";
    document.getElementById("gallery-status").className = "status-badge red";
    document.getElementById("gallery-status").innerText = "গ্যালারি বাকি ❌";
    
    if (currentUser.role === "admin") {
        document.getElementById("btn-admin-panel").style.display = "flex";
    } else {
        document.getElementById("btn-admin-panel").style.display = "none";
    }
    
    switchTab("home");
    showToast(`স্বাগতম, ${currentUser.fullName}! আপনার অ্যাকাউন্ট ভেরিফাই করা হয়েছে।`);
}

function selectAvatar(avatarId) {
    document.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
    const option = document.querySelector(`.avatar-option[data-avatar="${avatarId}"]`);
    if (option) option.classList.add("selected");
}

// ==========================================
// 4. AUTHENTICATION (LOGIN / LOGOUT)
// ==========================================

function handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById("login-phone").value.trim();
    const pass = document.getElementById("login-password").value.trim();
    
    const user = db.users.find(u => u.phoneNumber === phone || u.phoneNumber === "+91" + phone);
    
    if (!user || user.password !== pass) {
        alert("ভুল ফোন নম্বর বা পাসওয়ার্ড দেওয়া হয়েছে।");
        return;
    }
    
    if (!user.isVerified) {
        showScreen("screen-pending");
        return;
    }
    
    if (user.isBanned) {
        alert("দুঃখিত, আমাদের নির্দেশনাবলী ভঙ্গ করার অপরাধে আপনার অ্যাকাউন্টটি স্থায়ীভাবে নিষিদ্ধ (Banned) করা হয়েছে।");
        return;
    }
    
    currentUser = user;
    localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
    
    document.body.classList.add("logged-in");
    document.getElementById("form-login").reset();
    
    if (currentUser.role === "admin") {
        document.getElementById("btn-admin-panel").style.display = "flex";
    } else {
        document.getElementById("btn-admin-panel").style.display = "none";
    }
    
    switchTab("home");
    showToast(`স্বাগতম, ${currentUser.fullName}!`);
}

function logout() {
    currentUser = null;
    localStorage.removeItem("mon_khule_bolo_session");
    document.body.classList.remove("logged-in");
    showScreen("screen-splash");
}

// ==========================================
// 5. POST FEED SYSTEM & REACTIONS
// ==========================================

let attachedPostImageBase64 = null;

function triggerPostImageUpload() {
    document.getElementById("post-image-input").click();
}

function previewPostImage(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            attachedPostImageBase64 = event.target.result;
            document.getElementById("img-preview-tag").src = attachedPostImageBase64;
            document.getElementById("attached-post-image-preview").style.display = "flex";
        };
        reader.readAsDataURL(file);
    }
}

function clearPostImage() {
    attachedPostImageBase64 = null;
    document.getElementById("post-image-input").value = "";
    document.getElementById("attached-post-image-preview").style.display = "none";
}

function censorText(text) {
    let result = text;
    for (const keyword of db.blacklist) {
        if (!keyword.trim()) continue;
        const pattern = new RegExp("\\b" + escapeRegExp(keyword) + "\\b", "gi");
        result = result.replace(pattern, "*".repeat(keyword.length));
    }
    return result;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createPost() {
    const text = document.getElementById("post-textarea").value.trim();
    if (!text && !attachedPostImageBase64) return;
    
    const mode = document.querySelector('input[name="post-identity"]:checked').value;
    const category = document.getElementById("post-category").value;
    
    const censoredContent = censorText(text);
    
    const newPost = {
        id: "post_" + Date.now(),
        userId: currentUser.uid,
        authorName: currentUser.fullName,
        authorUsername: currentUser.username,
        postMode: mode,
        nickname: mode === "nickname" ? currentUser.nickname : null,
        type: attachedPostImageBase64 ? "image" : "text",
        content: censoredContent,
        imageUrl: attachedPostImageBase64 || null,
        category: category,
        createdAt: new Date().toISOString(),
        userLocationState: currentUser.state,
        userLocationDistrict: currentUser.district,
        reactions: { "Like": [], "Dislike": [] },
        commentsCount: 0,
        isApproved: currentUser.role === "admin" // auto-approve admin posts
    };
    
    db.posts.unshift(newPost);
    saveLocalDB();
    syncToRemote("save_post", newPost);
    
    document.getElementById("post-textarea").value = "";
    clearPostImage();
    renderFeed();
    showToast(currentUser.role === "admin" ? "পোস্ট শেয়ার করা হয়েছে!" : "পোস্টটি অ্যাডমিন পর্যালোচনার জন্য পাঠানো হয়েছে।");
}

function renderFeed() {
    const list = document.getElementById("feed-list");
    list.innerHTML = "";
    
    // Filter by category if selected
    let filtered = db.posts.filter(p => p.isApproved);
    if (selectedCategory) {
        filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">কোনো পোস্ট খুঁজে পাওয়া যায়নি।</p>`;
        return;
    }
    
    filtered.forEach(post => {
        const isLiked = post.reactions && post.reactions["Like"] && post.reactions["Like"].includes(currentUser.uid);
        const isDisliked = post.reactions && post.reactions["Dislike"] && post.reactions["Dislike"].includes(currentUser.uid);
        
        let authorName = post.authorName;
        let avatar = "👨🏻";
        
        if (post.postMode === "anonymous") {
            authorName = currentLanguage === "bn" ? "বেনামী ব্যবহারকারী" : "Anonymous User";
            avatar = "🤫";
        } else if (post.postMode === "nickname") {
            authorName = post.nickname || "Benami";
            avatar = "👤";
        }
        
        const likes = (post.reactions && post.reactions["Like"] ? post.reactions["Like"].length : 0);
        const dislikes = (post.reactions && post.reactions["Dislike"] ? post.reactions["Dislike"].length : 0);
        
        const card = document.createElement("div");
        card.className = "post-card glass mb-1";
        card.innerHTML = `
            <div class="post-card-header">
                <div class="author-area">
                    <div class="author-avatar">${avatar}</div>
                    <div class="author-details">
                        <h4>${authorName}</h4>
                        <span>${post.createdAt.substring(0, 10)} | 📍 ${post.userLocationDistrict}</span>
                    </div>
                </div>
                <div class="post-meta-badge">${post.category}</div>
            </div>
            
            <div class="post-content">${post.content}</div>
            
            ${post.imageUrl ? `
            <div class="post-image-box" onclick="openLightbox('${post.imageUrl}')">
                <img src="${post.imageUrl}" alt="Post Image">
            </div>` : ""}
            
            <div class="post-actions">
                <div class="reaction-btn-group">
                    <button class="btn-react ${isLiked ? 'active' : ''}" onclick="toggleReaction('${post.id}', 'Like')">
                        <i class="fas fa-thumbs-up"></i> Like (${likes})
                    </button>
                    <button class="btn-react ${isDisliked ? 'active' : ''}" onclick="toggleReaction('${post.id}', 'Dislike')">
                        <i class="fas fa-thumbs-down"></i> Dislike (${dislikes})
                    </button>
                </div>
                <button class="btn-react" onclick="toggleCommentsSection('${post.id}')">
                    <i class="fas fa-comment-alt"></i> মন্তব্য (${post.commentsCount})
                </button>
            </div>
            
            <!-- Comment Section Drawer -->
            <div id="comment-drawer-${post.id}" class="comments-section glass-inner" style="display:none;">
                <div class="comment-input-row">
                    <input type="text" id="comment-input-${post.id}" placeholder="একটি মন্তব্য লিখুন..." onkeypress="handleCommentKeyPress(event, '${post.id}')">
                    <button class="btn btn-primary btn-small" onclick="addComment('${post.id}')">পাঠান</button>
                </div>
                <div id="comments-list-${post.id}">
                    <!-- Loaded dynamically -->
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function selectCategory(cat) {
    selectedCategory = cat;
    switchTab("home");
}

function toggleReaction(postId, type) {
    const post = db.posts.find(p => p.id === postId);
    if (!post) return;
    
    if (!post.reactions) post.reactions = { "Like": [], "Dislike": [] };
    if (!post.reactions["Like"]) post.reactions["Like"] = [];
    if (!post.reactions["Dislike"]) post.reactions["Dislike"] = [];
    
    const oppositeType = type === "Like" ? "Dislike" : "Like";
    
    // Toggle active type
    const index = post.reactions[type].indexOf(currentUser.uid);
    if (index >= 0) {
        post.reactions[type].splice(index, 1);
    } else {
        post.reactions[type].push(currentUser.uid);
        // remove opposite
        const oppIndex = post.reactions[oppositeType].indexOf(currentUser.uid);
        if (oppIndex >= 0) post.reactions[oppositeType].splice(oppIndex, 1);
        
        // Push notification trigger
        if (post.userId !== currentUser.uid) {
            const actorName = post.postMode === "anonymous" ? "একজন বেনামী ব্যবহারকারী" : (currentUser.nickname || currentUser.fullName);
            const title = "পোস্টে লাইক পেয়েছেন";
            const body = `${actorName} আপনার পোস্টে লাইক দিয়েছেন।`;
            
            const newNoti = {
                id: "noti_" + Date.now(),
                userId: post.userId,
                title: title,
                body: body,
                createdAt: new Date().toISOString(),
                type: "reaction",
                isRead: false
            };
            db.notifications.unshift(newNoti);
            syncToRemote("save_notification", newNoti);
        }
    }
    
    saveLocalDB();
    syncToRemote("save_post", post);
    renderFeed();
}

// ==========================================
// 6. COMMENTS IMPLEMENTATION
// ==========================================

function toggleCommentsSection(postId) {
    const drawer = document.getElementById(`comment-drawer-${postId}`);
    if (drawer.style.display === "none") {
        drawer.style.display = "block";
        renderComments(postId);
    } else {
        drawer.style.display = "none";
    }
}

function handleCommentKeyPress(e, postId) {
    if (e.key === "Enter") {
        addComment(postId);
    }
}

function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;
    
    const post = db.posts.find(p => p.id === postId);
    if (!post) return;
    
    const censored = censorText(text);
    
    const newComment = {
        id: "comment_" + Date.now(),
        postId: postId,
        userId: currentUser.uid,
        authorName: currentUser.fullName,
        authorUsername: currentUser.username,
        postMode: "nickname", // default comment Mode
        nickname: currentUser.nickname || "Benami",
        content: censored,
        createdAt: new Date().toISOString()
    };
    
    db.comments.push(newComment);
    post.commentsCount++;
    saveLocalDB();
    syncToRemote("save_comment", newComment);
    syncToRemote("save_post", post);
    
    input.value = "";
    renderComments(postId);
    renderFeed();
    
    // Notifications trigger
    if (post.userId !== currentUser.uid) {
        const author = currentUser.nickname || currentUser.fullName;
        const newNoti = {
            id: "noti_" + Date.now(),
            userId: post.userId,
            title: "নতুন মন্তব্য (New Comment)",
            body: `${author} আপনার পোস্টে মন্তব্য করেছেন (Someone commented on your post)`,
            createdAt: new Date().toISOString(),
            type: "comment",
            isRead: false
        };
        db.notifications.unshift(newNoti);
        syncToRemote("save_notification", newNoti);
    }
}

function renderComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    list.innerHTML = "";
    
    const filtered = db.comments.filter(c => c.postId === postId);
    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-dim text-small py-1">কোনো মন্তব্য নেই।</p>`;
        return;
    }
    
    filtered.forEach(comment => {
        const item = document.createElement("div");
        item.className = "comment-item";
        item.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${comment.nickname || comment.authorName}</span>
                <span class="comment-time">${comment.createdAt.substring(11, 16)}</span>
            </div>
            <div class="comment-text">${comment.content}</div>
        `;
        list.appendChild(item);
    });
}

// ==========================================
// 7. EXPLORE SCREEN & SEARCH
// ==========================================

function renderExplore() {
    handleSearch();
}

function handleSearch() {
    const query = document.getElementById("search-input").value.trim().toLowerCase();
    const list = document.getElementById("search-results-list");
    list.innerHTML = "";
    
    // Search profiles (omit admin)
    let filtered = db.users.filter(u => u.role !== "admin" && u.isVerified);
    if (query) {
        filtered = filtered.filter(u => u.fullName.toLowerCase().includes(query) || u.nickname.toLowerCase().includes(query));
    }
    
    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">কোনো প্রোফাইল খুঁজে পাওয়া যায়নি।</p>`;
        return;
    }
    
    filtered.forEach(user => {
        const card = document.createElement("div");
        card.className = "user-search-card glass-inner hover-glow mb-05";
        card.innerHTML = `
            <div class="user-search-info">
                <div class="author-avatar">${user.profilePicUrl || "👩🏻"}</div>
                <div class="user-search-name">
                    <h4>${user.nickname}</h4>
                    <p>Age: ${user.age} | ${user.gender} | District: ${user.district}</p>
                </div>
            </div>
            <button class="btn btn-secondary btn-small" onclick="inspectUserProfile('${user.uid}')">প্রোফাইল দেখুন</button>
        `;
        list.appendChild(card);
    });
}

function inspectUserProfile(userId) {
    const user = db.users.find(u => u.uid === userId);
    if (!user) return;
    
    switchTab("profile");
    
    // Fill Profile Screen info with inspected user
    document.getElementById("profile-display-avatar").innerText = user.profilePicUrl || "👩🏻";
    document.getElementById("profile-display-name").innerText = user.nickname || "Benami";
    document.getElementById("profile-display-age-gender").innerText = `Age: ${user.age} | ${user.gender}`;
    document.getElementById("profile-display-location").innerText = `📍 ${user.city}, ${user.district}, ${user.state}`;
    document.getElementById("profile-display-bio").innerText = user.bio || "কোনো বায়ো সেট করা নেই।";
    
    // Hide own profile edit triggers
    document.getElementById("profile-edit-section").style.display = "none";
    
    // If logged-in user is admin, show the Auditing Security Vault!
    if (currentUser.role === "admin") {
        document.getElementById("profile-admin-vault").style.display = "block";
        document.getElementById("vault-real-name").innerText = user.fullName;
        document.getElementById("vault-phone").innerText = user.phoneNumber;
        document.getElementById("vault-password").innerText = user.password;
        document.getElementById("vault-email").innerText = user.email || "N/A";
        document.getElementById("vault-ip").innerText = user.registrationIp || "127.0.0.1";
        document.getElementById("vault-selfie-img").src = user.verificationSelfie || "";
    } else {
        document.getElementById("profile-admin-vault").style.display = "none";
    }
}

// ==========================================
// 8. NOTIFICATIONS SCREEN
// ==========================================

function renderNotifications() {
    const list = document.getElementById("notifications-list");
    list.innerHTML = "";
    
    const myNotifs = db.notifications.filter(n => n.userId === currentUser.uid);
    if (myNotifs.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">কোনো নোটিফিকেশন নেই।</p>`;
        return;
    }
    
    myNotifs.forEach(n => {
        const card = document.createElement("div");
        card.className = `notif-card glass-inner ${n.isRead ? '' : 'unread'}`;
        card.innerHTML = `
            <span class="notif-icon">${n.type === 'comment' ? '💬' : '👍'}</span>
            <div class="notif-info">
                <h4>${n.title}</h4>
                <p>${n.body}</p>
                <span>${n.createdAt.substring(0, 16).replace("T", " ")}</span>
            </div>
        `;
        list.appendChild(card);
    });
    
    // Update menu badge count
    const unreadCount = myNotifs.filter(n => !n.isRead).length;
    const badge = document.getElementById("badge-notif");
    if (unreadCount > 0) {
        badge.style.display = "inline-block";
        badge.innerText = unreadCount;
    } else {
        badge.style.display = "none";
    }
}

function markAllNotificationsRead() {
    db.notifications.forEach(n => {
        if (n.userId === currentUser.uid) {
            n.isRead = true;
            syncToRemote("save_notification", n);
        }
    });
    saveLocalDB();
    renderNotifications();
}

// ==========================================
// 9. MESSAGES & PRIVATE INBOX
// ==========================================

function renderInbox() {
    renderChatRequests();
    renderActiveChats();
}

function renderChatRequests() {
    const list = document.getElementById("chat-requests-list");
    list.innerHTML = "";
    
    const requests = db.chatRequests.filter(r => r.receiverId === currentUser.uid && r.status === "pending");
    if (requests.length === 0) {
        list.innerHTML = `<p class="text-dim text-small py-1">কোনো চ্যাট অনুরোধ নেই।</p>`;
        return;
    }
    
    requests.forEach(req => {
        const sender = db.users.find(u => u.uid === req.senderId);
        if (!sender) return;
        
        const card = document.createElement("div");
        card.className = "chat-card glass-inner mb-05";
        card.innerHTML = `
            <div class="user-search-info">
                <div class="chat-partner-avatar">👩🏻</div>
                <div class="user-search-name">
                    <h4>${sender.nickname}</h4>
                    <p>ফোন চ্যাট অনুরোধ পাঠিয়েছেন।</p>
                </div>
            </div>
            <div class="chat-request-actions">
                <button class="btn btn-success btn-small" onclick="handleChatRequest('${req.id}', 'accepted')">স্বীকার করুন</button>
                <button class="btn btn-danger btn-small" onclick="handleChatRequest('${req.id}', 'rejected')">বাতিল</button>
            </div>
        `;
        list.appendChild(card);
    });
}

function handleChatRequest(requestId, status) {
    const req = db.chatRequests.find(r => r.id === requestId);
    if (!req) return;
    
    req.status = status;
    saveLocalDB();
    syncToRemote("save_chat_request", req);
    
    // Notify sender
    if (status === "accepted") {
        const noti = {
            id: "noti_" + Date.now(),
            userId: req.senderId,
            title: "চ্যাট অনুরোধ গৃহীত হয়েছে",
            body: `${currentUser.nickname} আপনার চ্যাট অনুরোধ গ্রহণ করেছেন। এখন বার্তা পাঠাতে পারেন।`,
            createdAt: new Date().toISOString(),
            type: "system",
            isRead: false
        };
        db.notifications.unshift(noti);
        syncToRemote("save_notification", noti);
    }
    
    renderInbox();
    showToast(status === "accepted" ? "চ্যাট অনুরোধ গ্রহণ করা হয়েছে!" : "অনুরোধ বাতিল করা হয়েছে।");
}

function renderActiveChats() {
    const list = document.getElementById("active-chats-list");
    list.innerHTML = "";
    
    // Find accepted chat pairs
    const pairs = db.chatRequests.filter(r => (r.senderId === currentUser.uid || r.receiverId === currentUser.uid) && r.status === "accepted");
    
    if (pairs.length === 0) {
        list.innerHTML = `<p class="text-dim text-small py-1">কোনো সক্রিয় চ্যাট সেশন নেই।</p>`;
        return;
    }
    
    pairs.forEach(pair => {
        const partnerId = pair.senderId === currentUser.uid ? pair.receiverId : pair.senderId;
        const partner = db.users.find(u => u.uid === partnerId);
        if (!partner) return;
        
        const card = document.createElement("div");
        card.className = "chat-card glass-inner mb-05";
        card.innerHTML = `
            <div class="user-search-info">
                <div class="chat-partner-avatar">👩🏻</div>
                <div class="user-search-name">
                    <h4>${partner.nickname}</h4>
                    <p>${partner.city || partner.district}</p>
                </div>
            </div>
            <button class="btn btn-secondary btn-small" onclick="openPrivateChat('${partner.uid}')"><i class="fas fa-comment"></i> চ্যাট করুন</button>
        `;
        list.appendChild(card);
    });
}

function openPrivateChat(partnerId) {
    // Private chat in web version is mocked or we redirect to a placeholder private window.
    // Since the main focus is "Random Chat", we'll alert the user they can use Mobile APK for native features.
    alert("ব্যক্তিগত সরাসরি চ্যাট রুমটি অ্যান্ড্রয়েড মোবাইল অ্যাপের (APK) জন্য অপ্টিমাইজড করা হয়েছে। দয়া করে অ্যাপটি ডাউনলোড করুন!");
}

// ==========================================
// 10. RANDOM CHAT & MATCHMAKING
// ==========================================

let anonAttachedImageBase64 = null;

function renderRandomChatWelcome() {
    const welcome = document.getElementById("random-chat-welcome");
    const room = document.getElementById("random-chat-room");
    
    if (currentUser.activeAnonSessionId) {
        welcome.style.display = "none";
        room.style.display = "flex";
        
        // Set partner header
        document.getElementById("partner-alias-header").innerText = currentLanguage === "bn" ? "র‍্যান্ডম সহায়তাকারী" : "Random Companion";
        document.getElementById("my-alias-badge").innerText = `ছদ্মনাম (Your Alias): ${currentUser.activeAnonName}`;
        renderRandomChatHistory();
    } else {
        welcome.style.display = "block";
        room.style.display = "none";
        document.getElementById("search-partner-loading").style.display = "none";
        document.getElementById("btn-start-random-chat").style.display = "inline-block";
    }
}

function startRandomChat() {
    const isFemale = currentUser.gender.includes("Female") || currentUser.gender.includes("মহিলা");
    
    document.getElementById("btn-start-random-chat").style.display = "none";
    const loader = document.getElementById("search-partner-loading");
    loader.style.display = "block";
    
    const loadingText = document.getElementById("search-partner-text");
    
    setTimeout(() => {
        if (isFemale) {
            // Match instantly with Admin
            const femaleAliases = ["মেঘকন্যা", "নীলপরী", "আকাশনীলা", "রোজ", "ঝড়ো হাওয়া", "মায়াবতী", "স্বপ্নচারিণী"];
            const alias = femaleAliases[Math.floor(Math.random() * femaleAliases.length)];
            const sessionId = "anon_" + Date.now();
            
            currentUser.activeAnonSessionId = sessionId;
            currentUser.activeAnonName = alias;
            
            // update locally and remote
            const idx = db.users.findIndex(u => u.uid === currentUser.uid);
            if (idx >= 0) db.users[idx] = currentUser;
            saveLocalDB();
            localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
            syncToRemote("save_user", currentUser);
            
            // Notification to admin
            const adminNoti = {
                id: "noti_" + Date.now(),
                userId: "admin_uid_7001646363",
                title: "নতুন র‍্যান্ডম চ্যাট",
                body: `${alias} (${currentUser.fullName}) চ্যাট শুরু করেছেন।`,
                createdAt: new Date().toISOString(),
                type: "system",
                isRead: false
            };
            db.notifications.unshift(adminNoti);
            syncToRemote("save_notification", adminNoti);
            
            loader.style.display = "none";
            renderRandomChatWelcome();
            showToast("চ্যাট সঙ্গী পাওয়া গেছে! (Partner Found!)");
        } else {
            // Male companion -> No companion available
            loadingText.innerText = currentLanguage === "bn" ? "কোনো সঙ্গী পাওয়া যায়নি" : "No Companion Available";
            loader.innerHTML = `
                <span style="font-size:3rem">😢</span>
                <h3 class="text-red mt-1">${currentLanguage === "bn" ? 'কোনো সঙ্গী পাওয়া যায়নি' : 'No Companion Available'}</h3>
                <p class="text-small mt-05">দুঃখিত, এই মুহূর্তে চ্যাট করার জন্য অন্য কোনো ব্যবহারকারী উপলব্ধ নেই।</p>
                <button class="btn btn-secondary mt-1" onclick="renderRandomChatWelcome()">আবার চেষ্টা করুন</button>
            `;
        }
    }, 3000);
}

function stopRandomChat() {
    currentUser.activeAnonSessionId = null;
    currentUser.activeAnonName = null;
    
    const idx = db.users.findIndex(u => u.uid === currentUser.uid);
    if (idx >= 0) db.users[idx] = currentUser;
    saveLocalDB();
    localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
    syncToRemote("save_user", currentUser);
    
    renderRandomChatWelcome();
}

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
        anonSessionId: currentUser.activeAnonSessionId,
        anonName: currentUser.activeAnonName
    };
    
    db.messages.push(newMsg);
    saveLocalDB();
    syncToRemote("save_message", newMsg);
    
    // Notification for admin
    const adminNoti = {
        id: "noti_" + Date.now(),
        userId: "admin_uid_7001646363",
        title: "নতুন বেনামী চ্যাট বার্তা",
        body: `${currentUser.activeAnonName}: ${censored.take(20)}`,
        createdAt: new Date().toISOString(),
        type: "system",
        isRead: false
    };
    db.notifications.unshift(adminNoti);
    syncToRemote("save_notification", adminNoti);
    
    input.value = "";
    clearAnonAttachedImage();
    renderRandomChatHistory();
}

String.prototype.take = function(n) {
    return this.length > n ? this.substring(0, n) + "..." : this;
};

function renderRandomChatHistory() {
    const list = document.getElementById("random-chat-history");
    list.innerHTML = "";
    
    const anonMessages = db.messages.filter(m => 
        m.isAnonymous && 
        m.anonSessionId === currentUser.activeAnonSessionId &&
        ((m.senderId === currentUser.uid && m.receiverId === "admin_uid_7001646363") || 
         (m.senderId === "admin_uid_7001646363" && m.receiverId === currentUser.uid))
    );
    
    if (anonMessages.length === 0) {
        list.innerHTML = `<p class="text-center text-dim text-small py-2">হাই বলুন! নিরাপদে মেসেজ আদান প্রদান শুরু করুন।</p>`;
        return;
    }
    
    anonMessages.forEach(msg => {
        const isMe = msg.senderId === currentUser.uid;
        const bubble = document.createElement("div");
        bubble.className = `chat-bubble-row ${isMe ? 'me' : 'other'}`;
        bubble.innerHTML = `
            <div class="chat-bubble">
                ${msg.imageUrl ? `<img src="${msg.imageUrl}" class="bubble-image" onclick="openLightbox('${msg.imageUrl}')">` : ""}
                ${msg.content ? `<span>${msg.content}</span>` : ""}
                <span class="bubble-time">${msg.createdAt.substring(11, 16)}</span>
            </div>
        `;
        list.appendChild(bubble);
    });
    
    // Auto scroll bottom
    list.scrollTop = list.scrollHeight;
}

// ==========================================
// 11. PROFILE SCREEN
// ==========================================

function renderProfile() {
    // Render my own profile details
    document.getElementById("profile-display-avatar").innerText = currentUser.profilePicUrl || "👩🏻";
    document.getElementById("profile-display-name").innerText = currentUser.fullName;
    document.getElementById("profile-display-age-gender").innerText = `Age: ${currentUser.age} | ${currentUser.gender}`;
    document.getElementById("profile-display-location").innerText = `📍 ${currentUser.city}, ${currentUser.district}, ${currentUser.state}`;
    document.getElementById("profile-display-bio").innerText = currentUser.bio || "কোনো বায়ো সেট করা নেই।";
    
    document.getElementById("profile-edit-section").style.display = "block";
    document.getElementById("edit-nickname").value = currentUser.nickname || "";
    document.getElementById("edit-bio").value = currentUser.bio || "";
    
    // Admin privacy vault is hidden on personal view
    document.getElementById("profile-admin-vault").style.display = "none";
}

function saveProfileChanges() {
    const nick = document.getElementById("edit-nickname").value.trim();
    const bio = document.getElementById("edit-bio").value.trim();
    
    currentUser.nickname = nick;
    currentUser.bio = bio;
    
    const idx = db.users.findIndex(u => u.uid === currentUser.uid);
    if (idx >= 0) db.users[idx] = currentUser;
    
    saveLocalDB();
    localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
    syncToRemote("save_user", currentUser);
    
    renderProfile();
    showToast("প্রোফাইল আপডেট করা হয়েছে!");
}

// ==========================================
// 12. FLOATING LIGHTBOX & MOCK ACTIONS
// ==========================================

function openLightbox(imgUrl, msg = null) {
    activeLightboxMsg = msg;
    document.getElementById("lightbox-img").src = imgUrl;
    document.getElementById("lightbox").style.display = "flex";
    
    // If Admin and image message detail is attached, show save/delete inside lightbox
    const actions = document.getElementById("lightbox-admin-actions");
    if (currentUser.role === "admin" && msg) {
        actions.style.display = "flex";
    } else {
        actions.style.display = "none";
    }
}

function closeLightbox() {
    document.getElementById("lightbox").style.display = "none";
    activeLightboxMsg = null;
}

function saveLightboxImage() {
    showToast("Image Saved to gallery successfully! (ছবি গ্যালারিতে সেভ হয়েছে)");
    closeLightbox();
}

function deleteLightboxImage() {
    if (activeLightboxMsg) {
        db.messages = db.messages.filter(m => m.id !== activeLightboxMsg.id);
        saveLocalDB();
        syncToRemote("delete_message", activeLightboxMsg.id);
        
        // Reload screens
        if (activeAdminAnonTarget) {
            renderAdminAnonChatHistory();
        }
        closeLightbox();
        showToast("Message image deleted successfully!");
    }
}

// ==========================================
// 13. HIDDEN ADMIN PANEL ENGINE
// ==========================================

function showAdminPanel() {
    if (currentUser.role !== "admin") return;
    document.getElementById("screen-admin-panel").style.display = "block";
    switchAdminTab("dashboard");
}

function closeAdminPanel() {
    document.getElementById("screen-admin-panel").style.display = "none";
    // Sync local DB when returning
    syncFromRemote();
}

function switchAdminTab(tabId) {
    document.querySelectorAll(".btn-admin-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".admin-tab-view").forEach(v => v.classList.remove("active"));
    
    const activeBtn = document.querySelector(`.btn-admin-tab[data-atab="${tabId}"]`);
    const activeView = document.getElementById(`atab-${tabId}`);
    
    if (activeBtn) activeBtn.classList.add("active");
    if (activeView) activeView.classList.add("active");
    
    if (tabId === "dashboard") loadAdminStats();
    if (tabId === "verify") loadAdminVerifyList();
    if (tabId === "pending_posts") loadAdminPendingPosts();
    if (tabId === "users") loadAdminUsersList();
    if (tabId === "reports") loadAdminReportsList();
    if (tabId === "blacklist") loadAdminBlacklist();
    if (tabId === "anon_chats") loadAdminAnonChats();
    if (tabId === "all_chats") loadAdminAllChatsHistory();
}

function loadAdminStats() {
    document.getElementById("stat-total-users").innerText = db.users.filter(u => u.role !== "admin").length;
    document.getElementById("stat-pending-verify").innerText = db.users.filter(u => !u.isVerified && u.role !== "admin").length;
    document.getElementById("stat-total-posts").innerText = db.posts.length;
    // mock active reports
    document.getElementById("stat-active-reports").innerText = "1";
}

function loadAdminVerifyList() {
    const list = document.getElementById("admin-verify-list");
    list.innerHTML = "";
    
    const pending = db.users.filter(u => !u.isVerified && u.role !== "admin");
    if (pending.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">যাচাইকরণের জন্য কোনো আবেদন জমা নেই।</p>`;
        return;
    }
    
    pending.forEach(user => {
        const item = document.createElement("div");
        item.className = "admin-item-card glass-inner mb-05";
        item.innerHTML = `
            <div class="admin-item-info">
                <h4>${user.fullName}</h4>
                <p>Phone: ${user.phoneNumber} | Pass: ${user.password}</p>
                <p class="text-small text-gray">Age: ${user.age} | City: ${user.city}</p>
            </div>
            <button class="btn btn-secondary btn-small" onclick="openInspectDialog('${user.uid}')">Inspect</button>
        `;
        list.appendChild(item);
    });
}

// Inspect Dialogue
let inspectedUserUid = null;

function openInspectDialog(uid) {
    const user = db.users.find(u => u.uid === uid);
    if (!user) return;
    
    inspectedUserUid = uid;
    document.getElementById("ins-name").innerText = user.fullName;
    document.getElementById("ins-phone").innerText = user.phoneNumber;
    document.getElementById("ins-password").innerText = user.password;
    document.getElementById("ins-age-gender").innerText = `Age: ${user.age} | ${user.gender}`;
    document.getElementById("ins-location").innerText = `${user.city}, ${user.district}, ${user.state}`;
    
    document.getElementById("ins-selfie-img").src = user.verificationSelfie || "";
    document.getElementById("ins-gal-1").src = user.verificationGalleryImages[0] || "";
    document.getElementById("ins-gal-2").src = user.verificationGalleryImages[1] || "";
    document.getElementById("ins-gal-3").src = user.verificationGalleryImages[2] || "";
    
    document.getElementById("dialog-user-inspect").style.display = "flex";
}

function closeInspectDialog() {
    document.getElementById("dialog-user-inspect").style.display = "none";
    inspectedUserUid = null;
}

function approveInspectedUser() {
    if (!inspectedUserUid) return;
    
    const user = db.users.find(u => u.uid === inspectedUserUid);
    if (user) {
        user.isVerified = true;
        saveLocalDB();
        syncToRemote("save_user", user);
        
        showToast(`${user.fullName} Approved!`);
        closeInspectDialog();
        loadAdminVerifyList();
    }
}

function deleteInspectedUser() {
    if (!inspectedUserUid) return;
    
    db.users = db.users.filter(u => u.uid !== inspectedUserUid);
    saveLocalDB();
    syncToRemote("delete_user", inspectedUserUid);
    
    showToast("User deleted from system.");
    closeInspectDialog();
    loadAdminVerifyList();
}

function loadAdminPendingPosts() {
    const list = document.getElementById("admin-pending-posts-list");
    list.innerHTML = "";
    
    const pending = db.posts.filter(p => !p.isApproved);
    if (pending.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">অনুমোদনের জন্য কোনো পোস্ট জমা নেই।</p>`;
        return;
    }
    
    pending.forEach(post => {
        const item = document.createElement("div");
        item.className = "admin-item-card glass-inner mb-05";
        item.innerHTML = `
            <div class="admin-item-info">
                <h4>Author: ${post.authorName} (${post.postMode})</h4>
                <p>Content: ${post.content}</p>
                ${post.imageUrl ? `<img src="${post.imageUrl}" style="height:60px; border-radius:4px" onclick="openLightbox('${post.imageUrl}')">` : ""}
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-success btn-small" onclick="approvePost('${post.id}')">Approve</button>
                <button class="btn btn-danger btn-small" onclick="deletePost('${post.id}')">Decline</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function approvePost(postId) {
    const post = db.posts.find(p => p.id === postId);
    if (post) {
        post.isApproved = true;
        saveLocalDB();
        syncToRemote("save_post", post);
        showToast("Post approved on feed!");
        loadAdminPendingPosts();
    }
}

function deletePost(postId) {
    db.posts = db.posts.filter(p => p.id !== postId);
    saveLocalDB();
    syncToRemote("delete_post", postId);
    showToast("Post declined and deleted.");
    loadAdminPendingPosts();
}

function loadAdminUsersList() {
    const list = document.getElementById("admin-users-list");
    list.innerHTML = "";
    
    const users = db.users.filter(u => u.role !== "admin");
    users.forEach(user => {
        const item = document.createElement("div");
        item.className = "admin-item-card glass-inner mb-05";
        item.innerHTML = `
            <div class="admin-item-info">
                <h4>Name: ${user.fullName} (${user.username})</h4>
                <p>Phone: ${user.phoneNumber} | Pass: ${user.password}</p>
                <p class="text-small text-gray">Status: ${user.isBanned ? 'Banned' : 'Active'} | City: ${user.city}</p>
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-secondary btn-small" onclick="inspectUserProfile('${user.uid}'); closeAdminPanel();">Inspect</button>
                ${user.isBanned ? '' : `<button class="btn btn-danger btn-small" onclick="banUser('${user.uid}')">Ban</button>`}
                <button class="btn btn-danger btn-small" onclick="deleteUser('${user.uid}')">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function banUser(uid) {
    const user = db.users.find(u => u.uid === uid);
    if (user) {
        user.isBanned = true;
        saveLocalDB();
        syncToRemote("save_user", user);
        showToast(`${user.fullName} Banned!`);
        loadAdminUsersList();
    }
}

// Delete user
function deleteUser(uid) {
    db.users = db.users.filter(u => u.uid !== uid);
    saveLocalDB();
    syncToRemote("delete_user", uid);
    showToast("User deleted successfully.");
    loadAdminUsersList();
}

function loadAdminReportsList() {
    const list = document.getElementById("admin-reports-list");
    // Mock reports list (since it's a client demo)
    list.innerHTML = `
        <div class="admin-item-card glass-inner mb-05">
            <div class="admin-item-info">
                <h4 class="text-red">Reason: HARASSMENT</h4>
                <p>Post content: 'কলেজ লাইফে আমার ডিপার্টমেন্টের...'</p>
                <p class="text-small text-gray">Reporter: Joydeb Tripura</p>
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-danger btn-small" onclick="alert('Post deleted!')">Delete Post</button>
                <button class="btn btn-secondary btn-small" onclick="alert('Report dismissed!')">Dismiss Report</button>
            </div>
        </div>
    `;
}

function loadAdminBlacklist() {
    const list = document.getElementById("admin-blacklist-list");
    list.innerHTML = "";
    
    db.blacklist.forEach(word => {
        const badge = document.createElement("div");
        badge.className = "blacklist-badge";
        badge.innerHTML = `
            <span>${word}</span>
            <i class="fas fa-times" onclick="removeBlacklistWord('${word}')"></i>
        `;
        list.appendChild(badge);
    });
}

function addBlacklistWord() {
    const word = document.getElementById("input-blacklist-word").value.trim().toLowerCase();
    if (!word) return;
    
    if (db.blacklist.includes(word)) return;
    
    db.blacklist.push(word);
    saveLocalDB();
    syncToRemote("add_blacklist", word);
    
    document.getElementById("input-blacklist-word").value = "";
    loadAdminBlacklist();
    showToast("Keyword added to blacklist.");
}

function removeBlacklistWord(word) {
    db.blacklist = db.blacklist.filter(w => w !== word);
    saveLocalDB();
    syncToRemote("remove_blacklist", word);
    loadAdminBlacklist();
    showToast("Keyword removed.");
}

// Active anonymous chat list monitor
function loadAdminAnonChats() {
    const list = document.getElementById("admin-anon-chats-list");
    list.innerHTML = "";
    
    const activeAnonUsers = db.users.filter(u => u.activeAnonSessionId);
    if (activeAnonUsers.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">কোনো সক্রিয় চ্যাট সেশন নেই।</p>`;
        return;
    }
    
    activeAnonUsers.forEach(user => {
        const item = document.createElement("div");
        item.className = "admin-item-card glass-inner mb-05";
        item.innerHTML = `
            <div class="admin-item-info">
                <h4>Alias: ${user.activeAnonName}</h4>
                <p>Real Name: ${user.fullName} (${user.phoneNumber})</p>
            </div>
            <button class="btn btn-secondary btn-small" onclick="openAdminAnonChatDialog('${user.uid}')">Chat</button>
        `;
        list.appendChild(item);
    });
}

// Admin Chat Dialog with User
let adminSelectedImageBase64 = null;

function openAdminAnonChatDialog(uid) {
    const user = db.users.find(u => u.uid === uid);
    if (!user) return;
    
    activeAdminAnonTarget = user;
    
    document.getElementById("admin-chat-partner-alias").innerText = `Chat with ${user.activeAnonName}`;
    document.getElementById("admin-chat-partner-real").innerText = `Real: ${user.fullName} (${user.phoneNumber})`;
    
    document.getElementById("dialog-admin-anon-chat").style.display = "flex";
    renderAdminAnonChatHistory();
}

function closeAdminAnonChatDialog() {
    document.getElementById("dialog-admin-anon-chat").style.display = "none";
    activeAdminAnonTarget = null;
    clearAdminAttachedImage();
}

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
    
    const censored = censorText(text);
    
    const newMsg = {
        id: "msg_" + Date.now(),
        senderId: "admin_uid_7001646363",
        receiverId: activeAdminAnonTarget.uid,
        content: censored,
        imageUrl: adminSelectedImageBase64 || null,
        createdAt: new Date().toISOString(),
        isRead: false,
        isAnonymous: true,
        anonSessionId: activeAdminAnonTarget.activeAnonSessionId,
        anonName: activeAdminAnonTarget.activeAnonName
    };
    
    db.messages.push(newMsg);
    saveLocalDB();
    syncToRemote("save_message", newMsg);
    
    // Notification for user
    const userNoti = {
        id: "noti_" + Date.now(),
        userId: activeAdminAnonTarget.uid,
        title: "র‍্যান্ডম চ্যাট বার্তা",
        body: `র‍্যান্ডম সহায়তাকারী: ${censored.take(20)}`,
        createdAt: new Date().toISOString(),
        type: "system",
        isRead: false
    };
    db.notifications.unshift(userNoti);
    syncToRemote("save_notification", userNoti);
    
    input.value = "";
    clearAdminAttachedImage();
    renderAdminAnonChatHistory();
}

function renderAdminAnonChatHistory() {
    const list = document.getElementById("admin-anon-chat-history");
    list.innerHTML = "";
    
    const anonMessages = db.messages.filter(m => 
        m.isAnonymous && 
        m.anonSessionId === activeAdminAnonTarget.activeAnonSessionId &&
        ((m.senderId === activeAdminAnonTarget.uid && m.receiverId === "admin_uid_7001646363") || 
         (m.senderId === "admin_uid_7001646363" && m.receiverId === activeAdminAnonTarget.uid))
    );
    
    anonMessages.forEach(msg => {
        const isMe = msg.senderId === "admin_uid_7001646363";
        const bubble = document.createElement("div");
        bubble.className = `chat-bubble-row ${isMe ? 'me' : 'other'}`;
        
        let actionsRow = "";
        if (msg.imageUrl) {
            // Save and Delete links below the image in admin dialog
            actionsRow = `
                <div class="lightbox-actions-row mt-05" style="gap:10px">
                    <span style="font-size:0.75rem; color:#00f0ff; cursor:pointer; font-weight:bold" onclick="showToast('Image saved!')">Save</span>
                    <span style="font-size:0.75rem; color:#ff003c; cursor:pointer; font-weight:bold" onclick="deleteAdminChatImage('${msg.id}')">Delete</span>
                </div>
            `;
        }
        
        bubble.innerHTML = `
            <div class="chat-bubble">
                ${msg.imageUrl ? `<img src="${msg.imageUrl}" class="bubble-image" onclick="openLightbox('${msg.imageUrl}', ${JSON.stringify(msg).replace(/"/g, '&quot;')})">` : ""}
                ${actionsRow}
                ${msg.content ? `<span>${msg.content}</span>` : ""}
                <span class="bubble-time">${msg.createdAt.substring(11, 16)}</span>
            </div>
        `;
        list.appendChild(bubble);
    });
    list.scrollTop = list.scrollHeight;
}

function deleteAdminChatImage(msgId) {
    db.messages = db.messages.filter(m => m.id !== msgId);
    saveLocalDB();
    syncToRemote("delete_message", msgId);
    showToast("Message deleted successfully!");
    renderAdminAnonChatHistory();
}

// All chats auditing log list
function loadAdminAllChatsHistory() {
    const list = document.getElementById("admin-all-chats-list");
    list.innerHTML = "";
    
    // Group all non-anonymous messages by conversation pairs
    const privateMsgs = db.messages.filter(m => !m.isAnonymous);
    
    // Group by pair key (ordered alphabetically by uids)
    const grouped = {};
    privateMsgs.forEach(m => {
        const key = m.senderId < m.receiverId ? `${m.senderId}_${m.receiverId}` : `${m.receiverId}_${m.senderId}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
    });
    
    const keys = Object.keys(grouped);
    if (keys.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">সিস্টেমে কোনো ব্যক্তিগত কথোপকথন নেই।</p>`;
        return;
    }
    
    keys.forEach(key => {
        const uids = key.split("_");
        const userA = db.users.find(u => u.uid === uids[0]);
        const userB = db.users.find(u => u.uid === uids[1]);
        if (!userA || !userB) return;
        
        const item = document.createElement("div");
        item.className = "admin-item-card glass-inner mb-05";
        item.innerHTML = `
            <div class="admin-item-info">
                <h4>${userA.fullName} ⇆ ${userB.fullName}</h4>
                <p>Messages Count: ${grouped[key].length}</p>
            </div>
            <button class="btn btn-secondary btn-small" onclick="openSafetyChatDialog('${uids[0]}', '${uids[1]}')">Audit Logs</button>
        `;
        list.appendChild(item);
    });
}

function openSafetyChatDialog(uid1, uid2) {
    const userA = db.users.find(u => u.uid === uid1);
    const userB = db.users.find(u => u.uid === uid2);
    if (!userA || !userB) return;
    
    document.getElementById("safety-chat-desc").innerText = `Audit logs chronologically between: ${userA.fullName} and ${userB.fullName}`;
    document.getElementById("dialog-safety-chat").style.display = "flex";
    
    const history = document.getElementById("safety-chat-history");
    history.innerHTML = "";
    
    const list = db.messages.filter(m => 
        !m.isAnonymous && 
        ((m.senderId === uid1 && m.receiverId === uid2) || (m.senderId === uid2 && m.receiverId === uid1))
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    list.forEach(msg => {
        const sender = msg.senderId === uid1 ? userA : userB;
        const bubble = document.createElement("div");
        bubble.className = "chat-bubble-row other"; // always left-aligned for audits
        bubble.innerHTML = `
            <div class="chat-bubble" style="background: rgba(255,255,255,0.06); max-width:85%">
                <span class="text-cyan text-small font-bold d-block mb-05">${sender.fullName}:</span>
                ${msg.imageUrl ? `<img src="${msg.imageUrl}" class="bubble-image" onclick="openLightbox('${msg.imageUrl}')">` : ""}
                ${msg.content ? `<span>${msg.content}</span>` : ""}
                <span class="bubble-time">${msg.createdAt.replace("T", " ").substring(0, 16)}</span>
            </div>
        `;
        history.appendChild(bubble);
    });
    history.scrollTop = history.scrollHeight;
}

function closeSafetyChatDialog() {
    document.getElementById("dialog-safety-chat").style.display = "none";
}

// ==========================================
// 14. HELPERS & GENERAL EVENT LISTENERS
// ==========================================

function setupEventListeners() {
    // Escape clicks on overlay dialogs
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

function updateUI() {
    // Updates global UI metrics (notifications badge count, stats counts, etc.)
    if (currentUser) {
        const myNotifs = db.notifications.filter(n => n.userId === currentUser.uid && !n.isRead);
        const badge = document.getElementById("badge-notif");
        if (myNotifs.length > 0) {
            badge.style.display = "inline-block";
            badge.innerText = myNotifs.length;
        } else {
            badge.style.display = "none";
        }
    }
}
