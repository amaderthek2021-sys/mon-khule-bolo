// Mon Khule Bolo - Web Client Controller
// Shared Google Apps Script Database Sync Logic

// Paste your deployed Google Apps Script Web App URL here to sync the website and APK databases!
const API_URL = "https://script.google.com/macros/s/AKfycbzkO2uEkYR3WJLG_eAEkPTcvE0m06C0N7Bovuk1rm-DkNUPaZJHHDw9oLaqJVFLWdVu/exec"; 

// Local/Offline Fallback State (seeded with the same mock data as the Android App)
let db = {
    users: [],
    posts: [],
    comments: [],
    messages: [],
    notifications: [],
    chatRequests: [],
    blacklist: ["badword", "spam", "abuse"],
    friendRequests: [],
    friendships: []
};

// Current Session State
let currentUser = null;
let currentLanguage = "en"; // "bn" or "en"
let selectedCategory = "";
let currentMatchedPartner = null;
let isSearchingPartner = false;
let activeAdminAnonTarget = null;
let activeLightboxMsg = null;

// Translation resources
const translations = {
    bn: {
        chat_anonymous: "Randomly Chat Anonymously",
        home: "Home Feed",
        explore: "Explore",
        categories: "Categories",
        notifications: "Notifications",
        messages: "Messages",
        friends: "Friends",
        profile: "Profile"
    },
    en: {
        chat_anonymous: "Randomly Chat Anonymously",
        home: "Home Feed",
        explore: "Explore",
        categories: "Categories",
        notifications: "Notifications",
        messages: "Messages",
        friends: "Friends",
        profile: "Profile"
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
    // Seed initial users matching Android seed data if database is empty or outdated
    const DB_SEED_VERSION = "seeded_v5";
    const isSeeded = localStorage.getItem("mon_khule_bolo_seeded_ver") === DB_SEED_VERSION;

    if (!localStorage.getItem("mon_khule_bolo_db") || !isSeeded) {
        // Admin
        const adminUser = {
            uid: "admin_uid_7001646363",
            phoneNumber: "7001646363",
            fullName: "Admin Mod (Admin)",
            username: "admin_mkhb",
            password: "7001646363",
            age: 30,
            gender: "Other",
            state: "West Bengal",
            district: "Kolkata",
            city: "Kolkata City",
            role: "admin",
            isVerified: true,
            profilePicUrl: "👽",
            bio: "Security Auditor."
        };

        const maleNames = [
            "Rohan Sen", "Joydeb Tripura", "Subrata Paul", "Sourav Ganguly", "Avik Sarkar",
            "Aarav Sharma", "Arjun Banerjee", "Vihaan Patel", "Kabir Mukherjee", "Aditya Das",
            "Ishaan Bose", "Reyansh Ghosh", "Amit Dutta", "Rahul Roy", "Pritam Chakraborty",
            "Nilanjan Sen", "Sandip Dey", "Debashis Guha", "Shuvam Pal", "Tanmoy Ghosh"
        ];

        const femaleNames = [
            "Sneha Das", "Riya Sen", "Payel Dey", "Anjali Roy", "Tanushree Bose",
            "Moumita Saha", "Priya Chakraborty", "Deboleena Dutt", "Keya Ghosal", "Shreya Ghoshal",
            "Ananya Chatterjee", "Diya Sengupta", "Ishita Bhattacharya", "Megha Paul", "Pooja Ghosh",
            "Sanchari Mitra", "Rimi Sarkar", "Swagata Mukherjee", "Trisha Sen", "Rituparna Das",
            "Susmita Roy", "Priyanka Dutta", "Debjani Banerjee", "Aditi Guha", "Sayantani Ghosh",
            "Paramita Bose", "Monalisa Kar", "Koyel Dey", "Srabanti Chakraborty", "Subhashree Sen",
            "Mimi Chakraborty", "Tanima Sen", "Payel Mukherjee", "Gargi Roy", "June Mukherjee",
            "Paoli Das", "Koneenica Sen", "Rimpa Chatterjee", "Bidipta Chakraborty", "Sudipta Chakraborty"
        ];

        const maleBios = [
            "I love to read stories and chat with new people.",
            "Preparing for competitive job exams.",
            "Photography is my passion.",
            "Coding late at night and listening to music.",
            "Sports enthusiast. Let's talk about cricket!",
            "Looking for good conversations and deep thoughts.",
            "Music is life. Guitarist by passion.",
            "A simple guy who loves to travel.",
            "Addicted to tea and books. ☕📚",
            "Let's share secrets and be friends."
        ];

        const femaleBios = [
            "I am here to speak my heart out.",
            "I consider everyone a good friend.",
            "Looking for people who love mountains.",
            "Music therapy is my favorite.",
            "I live in poetry and novels.",
            "Coffee and good movies on rainy days. 🌧️☕",
            "Sweet talker, loves listening to life experiences.",
            "A simple girl with big dreams.",
            "Shantiniketan is my second home. 🌸",
            "Singing makes my day. Let's connect!"
        ];

        const westBengalCities = [
            "Kolkata", "Howrah", "Siliguri", "Durgapur", "Asansol", "Kharagpur", "Haldia",
            "Bardhaman", "Baharampur", "Habra", "Shantipur", "Dankuni", "Kalyani", "Chinsurah",
            "Serampore", "Bally", "Salt Lake", "Dum Dum", "Jadavpur", "Baruipur", "Bolpur", "Darjeeling"
        ];

        const maleAvatars = ["👨🏻", "🧔", "👨🏽‍💻", "👨🏼‍💼", "👦"];
        const femaleAvatars = ["👩🏻", "👧🏽", "👱🏻‍♀️", "🙋‍♀️", "👩🏼‍💼"];

        db.users = [adminUser];

        const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        // Generate 20 Male Users
        for (let i = 0; i < maleNames.length; i++) {
            const fullName = maleNames[i];
            const cleanName = fullName.toLowerCase().replace(/[^a-z0-9]/g, "");
            db.users.push({
                uid: "user_male_" + i,
                phoneNumber: "+9198765" + String(10000 + i),
                fullName: fullName,
                username: cleanName + "_" + (100 + i),
                password: "password",
                age: getRandomInt(19, 29),
                gender: "Male",
                state: "West Bengal",
                district: getRandomItem(westBengalCities),
                city: getRandomItem(westBengalCities),
                isVerified: true,
                bio: getRandomItem(maleBios),
                role: "user",
                profilePicUrl: getRandomItem(maleAvatars)
            });
        }

        // Generate 40 Female Users
        for (let i = 0; i < femaleNames.length; i++) {
            const fullName = femaleNames[i];
            const cleanName = fullName.toLowerCase().replace(/[^a-z0-9]/g, "");
            db.users.push({
                uid: "user_female_" + i,
                phoneNumber: "+9198765" + String(20000 + i),
                fullName: fullName,
                username: cleanName + "_" + (100 + i),
                password: "password",
                age: getRandomInt(18, 28),
                gender: "Female",
                state: "West Bengal",
                district: getRandomItem(westBengalCities),
                city: getRandomItem(westBengalCities),
                isVerified: true,
                bio: getRandomItem(femaleBios),
                role: "user",
                profilePicUrl: getRandomItem(femaleAvatars)
            });
        }

        const confessionTemplates = [
            { category: "Confession", content: "আমি আমার টিউশনি ফি দিয়ে বন্ধুদের সাথে রেস্টুরেন্টে খেয়ে নিয়েছি, আর বাড়িতে বলেছি যে বই কিনেছি।" },
            { category: "Confession", content: "আমার অফিসের কলিগকে আমার খুব ভালো লাগে, কিন্তু ওর অলরেডি বয়ফ্রেন্ড আছে। প্রতিদিন ওকে অন্য কারও সাথে হাসতে দেখে বুকটা ফেটে যায়।" },
            { category: "Confession", content: "আমি পরীক্ষার মার্কশিট জাল করে বাবা-মাকে দেখিয়েছিলাম, আজও সেই অপরাধবোধ বয়ে বেড়াচ্ছি।" },
            { category: "Confession", content: "আমি আমার পরিবারের অমতে চাকরি ছেড়ে দিয়েছি, এখনও বাড়িতে বলতে পারিনি।" },
            { category: "Confession", content: "কলেজের প্রথম দিন থেকেই ক্লাসমেট মেয়েটিকে পছন্দ করি, কিন্তু শেষ দিন পর্যন্ত ওকে বলতে পারিনি।" },
            { category: "Confession", content: "একদিন রেগে গিয়ে বাবার মানিব্যাগ থেকে কিছু টাকা সরিয়েছিলাম, আজও কাউকে সেটা বলতে পারিনি।" },
            { category: "Confession", content: "আমি আমার বেস্ট ফ্রেন্ডের জিএফ-কে আমি গোপনে ভালোবাসি, কিন্তু কখনো তাকে বলা সম্ভব নয়।" },
            { category: "Confession", content: "অফিসের কাজের চাপ আর ভালো লাগছে না, প্রতিদিন সকালে ঘুম থেকে উঠে মনে হয় আজই চাকরিটা ছেড়ে দিই।" },
            { category: "Confession", content: "বাড়িতে সবাই ভাবে আমি খুব ভালো পড়াশোনা করছি, কিন্তু আমি আসলে সারাদিন ফোন ঘেঁটে আর আড্ডা মেরে সময় কাটাই।" },
            { category: "Confession", content: "আমি আমার পুরো মাসের মাইনে একটা নতুন গেমিং কনসোল কিনতে খরচ করে ফেলেছি আর বাড়িতে বলেছি যে আমার মাইনে কেটে নেওয়া হয়েছে। খুব অপরাধবোধ হচ্ছে।" },
            
            { category: "Deep Secret", content: "সবাই ভাবে আমি খুব হাসিখুশি, কিন্তু একা থাকলে আমি ঘণ্টার পর ঘণ্টা কাঁদি।" },
            { category: "Deep Secret", content: "আমি গোপনে একটা অনাথ আশ্রমে প্রতি মাসে কিছু টাকা পাঠাই, এই কথা আমার পরিবারের কেউ জানে না।" },
            { category: "Deep Secret", content: "মাঝেমধ্যে একা থাকতে খুব ইচ্ছে করে। মনে হয় সব ছেড়ে হিমালয়ে চলে যাই।" },
            { category: "Deep Secret", content: "আমি লুকিয়ে লুকিয়ে ডায়েরি লিখি, যেখানে আমার জীবনের সমস্ত না বলা কষ্টের কথা লেখা আছে।" },
            { category: "Deep Secret", content: "আমার ছোটবেলার এক বন্ধুর সাথে একটা বড় ভুল বোঝাবুঝি হয়েছিল, আজ ৫ বছর পর আমি ওকে খুব মিস করি।" },
            { category: "Deep Secret", content: "আমার মনে হয় আমি কাউকে ছাড়া বাঁচতে পারব না, কিন্তু সমাজ আমাদের সম্পর্ক কোনোদিন মানবে না।" },
            { category: "Deep Secret", content: "আমি আজও আমার প্রথম ভালোবাসার মানুষের ছবি মাঝেমধ্যে রাতে লুকিয়ে দেখি।" },
            { category: "Deep Secret", content: "আমি জীবনে কোনোদিন সুখী হতে পারলাম না, কেবল লোক দেখানোর জন্য হাসিমুখ করে থাকি।" },
            { category: "Deep Secret", content: "আমার এক দূর সম্পর্কের আত্মীয় আমার সাথে খুব খারাপ ব্যবহার করেছিল ছোটবেলায়, আজও সেই স্মৃতি আমায় তাড়া করে।" },
            { category: "Deep Secret", content: "আমি গোপনে আমার বেস্ট ফ্রেন্ডকে নিয়ে রোমান্টিক কবিতা লিখি। ও ভাবে আমি খুব মজার মানুষ যার ভালোবাসার প্রতি কোনো টান নেই।" },
            
            { category: "Dark Secret", content: "আমি একদিন বন্ধুর দামি ঘড়ি চুরি করে বিক্রি করেছিলাম, আর ও ভাবলো ওটা হারিয়ে গেছে।" },
            { category: "Dark Secret", content: "একবার রাগ করে আমার ছোট বোনের প্রিয় শখের জিনিস ভেঙে দিয়েছিলাম, আর পোষা বেড়ালের ওপর দোষ চাপিয়েছিলাম।" },
            { category: "Dark Secret", content: "আমি গোপনে একটা ফেক অ্যাকাউন্ট দিয়ে আমার এক্স-এর প্রোফাইল রোজ স্টক করি।" },
            { category: "Dark Secret", content: "অফিসে একবার একটা ভুল করে অন্য এক কলিগের ওপর দোষ চাপিয়েছিলাম, যার জন্য ওকে চাকরি থেকে বরখাস্ত করা হয়েছিল।" },
            { category: "Dark Secret", content: "আমি এক বন্ধুর সাথে বিশ্বাসঘাতকতা করেছি, ও আমাকে ভাই ভাবতো আর আমি ওর ক্ষতি করেছি।" },
            { category: "Dark Secret", content: "আমার এক বড় দাদার ডায়েরি লুকিয়ে পড়েছিলাম, সেখানে এমন কিছু ছিল যা জেনে আমি স্তম্ভিত।" },
            { category: "Dark Secret", content: "পরীক্ষায় নকল করতে গিয়ে একবার প্রায় ধরা পড়তে যাচ্ছিলাম, সেই ভয়ের কথা এখনো ভুলিনি।" },
            { category: "Dark Secret", content: "আমি আমার জীবনের সবথেকে বড় সত্যিটা নিজের মা-বাবার থেকেও লুকিয়ে রেখেছি।" },
            { category: "Dark Secret", content: "অফিসের স্টেশনারি জিনিসপত্র আমি মাঝেমধ্যেই না বলে নিজের বাড়ি নিয়ে আসি।" },
            { category: "Dark Secret", content: "আমি আত্মীয়ের বাড়িতে গিয়ে ভুল করে একটা দামি ফুলদানি ভেঙে ফেলেছিলাম আর ওটা এমনভাবে রেখে এসেছিলাম যেন মনে হয় ওটা একা একাই পড়ে গেছে।" },
            
            { category: "Dark Desire", content: "ইচ্ছে করে কলকাতার রাস্তায় কোনো অচেনা মানুষের হাত ধরে সারা রাত হেঁটে বেড়াই।" },
            { category: "Dark Desire", content: "কখনো কখনো মনে হয় সবকিছু ছেড়ে দিয়ে কোনো পাহাড়ে নতুন নামে নতুন জীবন শুরু করি।" },
            { category: "Dark Desire", content: "আমার ইচ্ছা এমন একজনের সাথে রিলেশনে যাব যে আমার সম্পূর্ণ উল্টো, একটু পাগল আর অ্যাডভেঞ্চারাস।" },
            { category: "Dark Desire", content: "অফিসের বসের ওপর এমন রাগ জমেছে যে ইচ্ছা করে ওর মুখে এক বালতি জল ঢেলে দিই।" },
            { category: "Dark Desire", content: "মাঝেমধ্যে ইচ্ছা করে কোনো বড় চুরির সাথে যুক্ত হই, জাস্ট থ্রিলটা অনুভব করার জন্য।" },
            { category: "Dark Desire", content: "ইচ্ছে করে কয়েকদিনের জন্য এমন এক জায়গায় চলে যাই যেখানে ইন্টারনেট আর মোবাইলের কোনো নাম নিশানা নেই।" },
            { category: "Dark Desire", content: "আমি গোপনে এমন একজনকে চাই যে অলরেডি অন্য কারও সাথে সম্পর্কে আবদ্ধ।" },
            { category: "Dark Desire", content: "আমার ইচ্ছা একদিন মাঝরাতে গঙ্গার ঘাটে একা বসে মদ্যপান করব আর চিৎকার করে মনের সব রাগ প্রকাশ করব।" },
            { category: "Dark Desire", content: "ইচ্ছে করে সবার সামনে নিজের মুখোশটা খুলে ফেলি আর দেখাই আমি আসলে কতটা একা ও স্বার্থপর।" },
            { category: "Dark Desire", content: "আমার খুব ইচ্ছা আমার এই বাঁধাধরা আইটি চাকরিটা ছেড়ে দিয়ে একটা বাইক কিনি, আর দার্জিলিং-এর পাহাড়ে একটা ছোট্ট চায়ের দোকান খুলি।" },
            
            { category: "Naughty Thoughts", content: "আমার অফিসের এক হ্যান্ডসাম কলিগকে নিয়ে আমি প্রায়ই অদ্ভুত সব কল্পনা করি।" },
            { category: "Naughty Thoughts", content: "মেট্রোতে একজন সুন্দরী মেয়ে আমার দিকে তাকিয়ে হাসল, আমার মনটা কেমন যেন করে উঠল।" },
            { category: "Naughty Thoughts", content: "আমাদের কলেজের এক ইয়াং প্রোফেসরের ওপর আমার ক্রাশ আছে, ওনার লেকচার শোনার চেয়ে ওনার দিকে তাকিয়ে থাকতেই বেশি ভালো লাগে।" },
            { category: "Naughty Thoughts", content: "মাঝেমধ্যে ইচ্ছা করে কোনো party-তে সম্পূর্ণ অচেনা কোনো সুন্দর মানুষের সাথে এক রাতের জন্য হারিয়ে যাই।" },
            { category: "Naughty Thoughts", content: "আমি আমার পার্টনারের শার্ট লুকিয়ে পরি যখন ও বাড়িতে থাকে না, খুব সুন্দর একটা অনুভূতি হয়।" },
            { category: "Naughty Thoughts", content: "বন্ধুর বাড়িতে গিয়ে ওর সুন্দরী দিদিকে দেখে আমার মনটা কেমন যেন চঞ্চল হয়ে উঠেছিল।" },
            { category: "Naughty Thoughts", content: "আমি গোপনে এমন কিছু সিনেমা আর গল্প পড়ি যা সমাজ স্বাভাবিক চোখে দেখে না।" },
            { category: "Naughty Thoughts", content: "একটু রোমান্টিক বৃষ্টিভেজা দিনে মাঝেমধ্যে ইচ্ছা করে কোনো অচেনা মানুষের ঠোঁটে ঠোঁট রেখে হারিয়ে যাই।" },
            { category: "Naughty Thoughts", content: "আমার বন্ধুর হ্যান্ডসাম বড় ভাইকে দেখে আমার মনটা বারবার কেমন একটা অদ্ভুত অনুভূতিতে ভরে ওঠে।" },
            { category: "Naughty Thoughts", content: "আজ মেট্রোতে এক অচেনা হ্যান্ডসাম ছেলের দিকে তাকিয়ে থাকতে গিয়ে ধরা পড়ে গেলাম। ও চোখ ফিরিয়ে নেওয়ার বদলে হাসলো আর চোখ মারলো।" },
            
            { category: "Secret Crush", content: "প্রতি শুক্রবার যখন অফিসের মেয়েটি হলুদ শাড়ি পরে আসে, আমার ওকে রাজকন্যা মনে হয়।" },
            { category: "Secret Crush", content: "কলেজের লাইব্রেরিতে বসা মেয়েটির দিকে তাকিয়ে থাকতে থাকতে আমার পড়াশোনাই বন্ধ হয়ে যায়।" },
            { category: "Secret Crush", content: "মেট্রোতে রোজ ঠিক সাড়ে আটটার সময় এক ছেলেকে দেখি, ও যখন হেডফোন কানে দিয়ে হাসে, আমার খুব ভালো লাগে।" },
            { category: "Secret Crush", content: "আমি ওর জন্য গোপনে প্লেলিস্ট বানিয়েছি, কিন্তু ওকে কোনোদিন বলতে পারব না যে ও আমার ক্রাশ।" },
            { category: "Secret Crush", content: "ওর মিষ্টি হাসিটা দেখার জন্য আমি রোজ বিকেলে ছাদে গিয়ে দাঁড়িয়ে থাকি, ও হয়তো সেটা জানেই না।" },
            { category: "Secret Crush", content: "আমার বেস্ট ফ্রেন্ডের বোনকে আমার খুব ভালো লাগে, কিন্তু বন্ধুত্ব নষ্ট হওয়ার ভয়ে কোনোদিন বলব না।" },
            { category: "Secret Crush", content: "আমি গোপনে ওর ব্যাগে একটা ছোট চিরকুট রেখে এসেছিলাম, লিখেছিলাম 'তোমার চোখ দুটি খুব সুন্দর'।" },
            { category: "Secret Crush", content: "লিপ্ট-এ যখন আমার ক্রাশ আমাকে জিজ্ঞাসা করল আমি কোন ফ্লোরে যাব, আমি ভয়ে ভুল ফ্লোর নম্বর বলে ফেললাম।" },
            { category: "Secret Crush", content: "ও যখন ক্লাসে সবার সাথে কথা বলে, আমি লুকিয়ে লুকিয়ে শুধু ওর দিকেই তাকিয়ে থাকি।" },
            { category: "Secret Crush", content: "আমাদের পাড়ার মোড়ের ক্যাফেতে যে ছেলেটি কাজ করে, ওর ওপর আমার বিশাল ক্রাশ আছে। ওর হাসিটা জাস্ট অসাধারণ।" },
            
            { category: "Guilt & Regret", content: "আমি মার পার্স থেকে টাকা চুরি করে আমার প্রাক্তন বয়ফ্রেন্ডকে গিফট কিনে দিয়েছিলাম, আজ খুব অনুশোচনা হয়।" },
            { category: "Guilt & Regret", content: "দিদিমার মারা যাওয়ার আগের দিন ওনার সাথে খুব খারাপ ব্যবহার করেছিলাম, আর কোনোদিন ক্ষমা চাওয়ার সুযোগ পাব না।" },
            { category: "Guilt & Regret", content: "অফিসে নিজের ভুলটা ঢাকতে গিয়ে সহকর্মীর ওপর দোষ চাপিয়েছিলাম, ও চাকরিটা হারিয়েছিল, এই গিল্ট আমাকে তাড়া করে।" },
            { category: "Guilt & Regret", content: "বাবা-মার অমতে একজনের সাথে সম্পর্ক ভেঙেছিলাম, আজ ও খুব সফল আর আমি এখনো একাকীত্বে ভুগছি।" },
            { category: "Guilt & Regret", content: "একবার রাস্তায় এক ক্ষুধার্ত শিশুকে খাবার না দিয়ে এড়িয়ে চলে গিয়েছিলাম, আজও সেই বাচ্চার মুখটা মনে পড়লে কষ্ট হয়।" },
            { category: "Guilt & Regret", content: "আমি আমার বেস্ট ফ্রেন্ডের একটা সিক্রেট অন্য সবার সামনে হাসির ছলে বলে ফেলেছিলাম, আমাদের বন্ধুত্ব আজ শেষ।" },
            { category: "Guilt & Regret", content: "মাঝেমধ্যে মনে হয় যদি সেদিন ওই সিদ্ধান্তটা না নিতাম, তাহলে আজ আমার জীবনটা অন্যরকম হতো।" },
            { category: "Guilt & Regret", content: "আমি আমার পুরনো পোষা কুকুরটার খেলনা হারিয়ে ফেলেছিলাম আর মিথ্যা বলেছিলাম, ও খুব খুঁজেছিল খেলনাটা।" },
            { category: "Guilt & Regret", content: "নিজের স্বার্থের জন্য একজনের মন ভেঙেছি, আজ নিজেকে কোনোভাবেই ক্ষমা করতে পারি না।" },
            { category: "Guilt & Regret", content: "অফিসে আমরা দুজনেই ভুল করেছিলাম, কিন্তু চাকরি চলে যাওয়ার ভয়ে আমি সব দোষ আমার বন্ধুর ওপর চাপিয়ে দিয়েছিলাম।" },
            
            { category: "Random Thoughts", content: "বাঙালি হয়েও যদি বিকেলে এক কাপ চা না খাই, তবে মনে হয় দিনটাই অসম্পূর্ণ রয়ে গেল।" },
            { category: "Random Thoughts", content: "মাঝেমধ্যে মনে হয় আমরা কেন এত সোশ্যাল মিডিয়া নিয়ে মেতে থাকি, অথচ আসল জীবনে মানুষের কত অভাব।" },
            { category: "Random Thoughts", content: "বৃষ্টির দিনে জানলার ধারে বসে গান শোনার আনন্দটাই আলাদা, সব চিন্তা যেন দূর হয়ে যায়।" },
            { category: "Random Thoughts", content: "কলকাতার ট্রামের জানলা দিয়ে শহরটাকে দেখতে দেখতে মনে হয় সময়টা যদি একটু থমকে যেত।" },
            { category: "Random Thoughts", content: "কখনো ভেবেছেন কি, আমরা রাস্তায় যে কত মানুষের মুখোমুখি হই, তারা সবাই আমাদের জীবনে জাস্ট ব্যাকগ্রাউন্ড ক্যারেক্টার?" },
            { category: "Random Thoughts", content: "বয়স বাড়ার সাথে সাথে বন্ধুর সংখ্যা কমতে থাকে, কিন্তু যে কজন থাকে তারাই আসল হিরে।" },
            { category: "Random Thoughts", content: "বাঙালির আড্ডা আর তর্কের কোনো শেষ নেই, কিন্তু এটার মধ্যেই একটা অদ্ভুত আনন্দ লুকিয়ে থাকে।" },
            { category: "Random Thoughts", content: "মাঝেমধ্যে মনে হয় আমরা কেন নিজেদের আসল অনুভূতিগুলো লুকিয়ে রাখি আর হাসিমুখের অভিনয় করি।" },
            { category: "Random Thoughts", content: "আজকালকার ব্যস্ত জীবনে একটু শান্তিতে নিশ্বাস নেওয়ার সময়টুকুও যেন পাওয়া যায় না।" },
            { category: "Random Thoughts", content: "কারও কি মনে হয় যে আমরা সবাই বড় হয়ে যাওয়ার অভিনয় করছি? আমার বয়স ২২ কিন্তু এখনও মনে হয় আমি সেই ছোট বাচ্চাই যে কিছুই জানে না।" }
        ];

        const commentTemplates = [
            "একদম চিন্তা করবেন না, আমরা সবাই কোনো না কোনো সময়ে এরকম ভুল করি। নিজেকে ক্ষমা করতে শিখুন।",
            "খুবই সুন্দর পোস্ট! মনের কথা খুলে বলার জন্য ধন্যবাদ।",
            "সত্যি কথা বলে দেওয়াই ভালো। বেশিদিন লুকিয়ে রাখলে পরিস্থিতি আরও খারাপ হতে পারে।",
            "আরেহ! আমি নিজেই ঠিক এই পরিস্থিতি দিয়ে গেছি। আপনি একা নন!",
            "হিহিহি, একদম ঠিক কথা! বয়স ২০ এর কোঠায় থাকলে সবারই একই অবস্থা হয়।",
            "নিজের মনের মানুষটিকে বলেই দিন। লুকিয়ে রাখার কোনো মানে হয় না।",
            "খুবই ভালো সিদ্ধান্ত! জীবনে ভালো থাকাটাই আসল কথা।",
            "দারুণ স্বীকারোক্তি! এটা পড়ে খুব ভালো লাগলো।",
            "জীবনটা সত্যিই খুব অদ্ভুত, কখন কী হয় বলা যায় না।",
            "খুব মিষ্টি একটা কথা! পরবর্তীতে কী হয় জানাবেন।",
            "একদম ঠিক বলেছেন, আমাদের সবারই একটু একা কাটানো উচিত।",
            "কাজ আর জীবনের ভারসাম্য রাখাটা খুব কঠিন। একটু বিরতি নিন।",
            "ভীषण রিলেটেবল পোস্ট। আমি নিজেই এটা অনুভব করি।",
            "খারাপ সময় কেটে যাবে, একটু ধৈর্য ধরুন আর নিজের খেয়াল রাখুন।",
            "বাঙালির চা আর বৃষ্টির আড্ডা সত্যিই অতুলনীয়! দারুন লিখেছেন।",
            "ভুল মানুষই করে, কিন্তু সেটা স্বীকার করাই সবথেকে বড় কাজ।",
            "নিজের খেয়াল রাখুন, বেশি চিন্তা করবেন না।",
            "সবাই একরকম হয় না, সঠিক সময়ের অপেক্ষা করুন।",
            "আরে না না! আপনি একদম পাগল নন। আমাদের অনেকেরই মনের মধ্যে এইরকম চিন্তা আসে, এটা খুবই স্বাভাবিক।",
            "এটা মনের কথা খুলে বলার একদম সঠিক জায়গা। এখানে কেউ আপনাকে জাজ করবে না, মন খুলে বলুন।"
        ];

        db.posts = [];
        db.comments = [];

        const regularUsers = db.users.filter(u => u.role !== "admin");

        for (let i = 0; i < confessionTemplates.length; i++) {
            const template = confessionTemplates[i];
            const author = getRandomItem(regularUsers);
            const isAnonymous = Math.random() < 0.6;
            const postId = "post_" + (i + 1);

            const hoursAgo = (i + 1) * 4 + getRandomInt(1, 3);
            const createdAt = new Date(Date.now() - hoursAgo * 3600000).toISOString();

            const likesCount = getRandomInt(4, 18);
            const dislikesCount = getRandomInt(0, 3);
            
            const shuffledUserIds = regularUsers.map(u => u.uid).sort(() => 0.5 - Math.random());
            const likes = shuffledUserIds.slice(0, likesCount);
            const dislikes = shuffledUserIds.slice(likesCount, likesCount + dislikesCount);

            db.posts.push({
                id: postId,
                userId: author.uid,
                authorName: author.fullName,
                authorUsername: author.username,
                authorAvatar: author.profilePicUrl || "👤",
                postMode: isAnonymous ? "anonymous" : "real_name",
                type: "text",
                category: template.category,
                content: template.content,
                createdAt: createdAt,
                userLocationState: "West Bengal",
                userLocationDistrict: author.city,
                reactions: { "Like": likes, "Dislike": dislikes },
                commentsCount: 0,
                isApproved: true,
                isDummy: true
            });

            const numComments = getRandomInt(1, 3);
            for (let c = 0; c < numComments; c++) {
                const commenter = getRandomItem(regularUsers.filter(u => u.uid !== author.uid));
                const commentId = `comment_${postId}_${c + 1}`;
                const commentMinutesAfter = getRandomInt(10, 180);
                const commentCreatedAt = new Date(new Date(createdAt).getTime() + commentMinutesAfter * 60000).toISOString();
                
                db.comments.push({
                    id: commentId,
                    postId: postId,
                    userId: commenter.uid,
                    authorName: commenter.fullName,
                    authorUsername: commenter.username,
                    authorAvatar: commenter.profilePicUrl || "👤",
                    content: getRandomItem(commentTemplates),
                    createdAt: commentCreatedAt,
                    isDummy: true
                });
            }

            db.posts[db.posts.length - 1].commentsCount = numComments;
        }

        db.posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        db.notifications = [
            {
                id: "noti_1",
                userId: "user_female_0",
                title: "Your confession has a new comment",
                body: "Someone commented on your anonymous post: 'Beautifully written...'",
                createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
                type: "comment",
                isRead: false
            }
        ];

        localStorage.setItem("mon_khule_bolo_seeded_ver", DB_SEED_VERSION);
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
        const isAdmin = currentUser.role === "admin";
        document.getElementById("btn-admin-panel").style.display = isAdmin ? "flex" : "none";
        const exploreBtn = document.getElementById("nav-item-explore");
        if (exploreBtn) exploreBtn.style.display = isAdmin ? "flex" : "none";
        startSyncPolling();
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
        if (remoteData && remoteData.users) {
            // Overwrite but always preserve and sync the admin user
            const adminUser = {
                uid: "admin_uid_7001646363",
                phoneNumber: "7001646363",
                fullName: "Admin Mod (Admin)",
                username: "admin_mkhb",
                password: "7001646363",
                age: 30,
                gender: "Other",
                state: "West Bengal",
                district: "Kolkata",
                city: "Kolkata City",
                role: "admin",
                isVerified: true,
                profilePicUrl: "👽",
                bio: "Security Auditor."
            };
            
            // 1. Merge Users: keep remote users + our local dummy users
            const remoteUsers = remoteData.users || [];
            const dummyUsers = db.users.filter(u => u.uid.startsWith("user_male_") || u.uid.startsWith("user_female_"));
            const mergedUsers = [...remoteUsers];
            for (const du of dummyUsers) {
                if (!mergedUsers.some(u => u.uid === du.uid)) {
                    mergedUsers.push(du);
                }
            }
            // Ensure admin exists in merged users
            const adminExists = mergedUsers.some(u => u.uid === adminUser.uid || String(u.phoneNumber).replace(/\D/g, "").slice(-10) === "7001646363");
            if (!adminExists) {
                mergedUsers.unshift(adminUser);
                syncToRemote("save_user", adminUser);
            }
            db.users = mergedUsers;
            
            // 2. Merge Posts: keep remote posts + our local dummy posts
            const remotePosts = remoteData.posts || [];
            const dummyPosts = db.posts.filter(p => p.isDummy);
            const mergedPosts = [...remotePosts];
            for (const dp of dummyPosts) {
                if (!mergedPosts.some(p => p.id === dp.id)) {
                    mergedPosts.push(dp);
                }
            }
            db.posts = mergedPosts;
            db.posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // 3. Merge Comments: keep remote comments + our local dummy comments
            const remoteComments = remoteData.comments || [];
            const dummyComments = db.comments.filter(c => c.isDummy);
            const mergedComments = [...remoteComments];
            for (const dc of dummyComments) {
                if (!mergedComments.some(c => c.id === dc.id)) {
                    mergedComments.push(dc);
                }
            }
            db.comments = mergedComments;
            
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
            
            // Trigger active chat renders if open
            if (currentUser) {
                if (activePrivateChatPartnerId) {
                    renderPrivateChatHistory();
                }
                const activeTabEl = document.querySelector(".nav-item.active");
                const isRandomChatActive = activeTabEl && activeTabEl.getAttribute("data-tab") === "random-chat";
                if (currentUser.activeAnonSessionId && isRandomChatActive) {
                    renderRandomChatHistory();
                }
                if (currentUser.role === "admin" && activeAdminAnonTarget) {
                    renderAdminAnonChatHistory();
                }
            }
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

async function syncChatFromRemote() {
    if (!API_URL) return;
    if (isChatSyncing) return;
    isChatSyncing = true;
    try {
        const response = await fetch(API_URL + "?action=sync_chat");
        const remoteData = await response.json();
        if (remoteData && remoteData.messages) {
            db.messages = remoteData.messages || [];
            db.notifications = remoteData.notifications || [];
            db.chatRequests = remoteData.chatRequests || [];
            saveLocalDB();
            
            // Trigger active chat renders if open
            if (currentUser) {
                if (activePrivateChatPartnerId) {
                    renderPrivateChatHistory();
                }
                const activeTabEl = document.querySelector(".nav-item.active");
                const isRandomChatActive = activeTabEl && activeTabEl.getAttribute("data-tab") === "random-chat";
                if (currentUser.activeAnonSessionId && isRandomChatActive) {
                    renderRandomChatHistory();
                }
                if (currentUser.role === "admin" && activeAdminAnonTarget) {
                    renderAdminAnonChatHistory();
                }
            }
        }
    } catch (err) {
        console.error("Failed to sync chat from remote DB:", err);
    } finally {
        isChatSyncing = false;
    }
}

function startSyncPolling() {
    if (!syncPollingInterval) {
        syncPollingInterval = setInterval(async () => {
            await syncFromRemote();
        }, 15000); // Full DB sync every 15 seconds
    }
    if (!chatSyncPollingInterval) {
        chatSyncPollingInterval = setInterval(async () => {
            await syncChatFromRemote();
        }, 1000); // Lightweight chat sync every 1 second (super fast!)
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
}

async function syncToRemote(action, payload) {
    if (!API_URL) return;
    try {
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: action, payload: payload }),
            mode: "no-cors",
            headers: { "Content-Type": "text/plain" }
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
        
        const selfieStatus = document.getElementById("selfie-status");
        if (selfieStatus) {
            selfieStatus.className = "status-badge red";
            selfieStatus.innerText = "Selfie Pending ❌";
        }
        
        const galleryStatus = document.getElementById("gallery-status");
        if (galleryStatus) {
            galleryStatus.className = "status-badge red";
            galleryStatus.innerText = "Gallery Pending ❌";
        }
    }
}

function switchTab(tabId) {
    checkBanStatus();
    if (currentUser && currentUser.isBanned) return;
    
    // The explore tab is disabled - redirect to home
    if (tabId === "explore") {
        tabId = "home";
    }
    
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".tab-view").forEach(view => view.classList.remove("active"));
    
    const activeItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    const activeView = document.getElementById(`tab-${tabId}`);
    
    if (activeItem) activeItem.classList.add("active");
    if (activeView) activeView.classList.add("active");
    
    // Reset scroll position of the tab container so new view starts at the top
    const tabPane = document.querySelector(".tab-pane");
    if (tabPane) tabPane.scrollTop = 0;
    
    // Dynamic titles
    document.getElementById("header-title").innerText = translations[currentLanguage][tabId.replace("-", "_")] || tabId;
    
    if (tabId === "home") renderFeed();
    if (tabId === "explore") renderExplore();
    if (tabId === "notifications") renderNotifications();
    if (tabId === "messages") renderInbox();
    if (tabId === "friends") renderFriends();
    if (tabId === "random-chat") renderRandomChatWelcome();
    if (tabId === "profile") renderProfile();
}

function toggleLanguage() {
    currentLanguage = currentLanguage === "bn" ? "en" : "bn";
    // Redraw active tab
    const activeTab = document.querySelector(".nav-item.active").getAttribute("data-tab");
    switchTab(activeTab);
}

function toggleTheme() {
    const isDark = document.body.classList.toggle("dark-theme");
    const themeIcon = document.getElementById("theme-icon");
    if (isDark) {
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
let webcamStream = null;
let newlyRegisteredUser = null;

async function startWebcam() {
    const container = document.getElementById("webcam-container");
    const video = document.getElementById("webcam-preview");
    container.style.display = "flex";
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        video.srcObject = webcamStream;
    } catch (err) {
        console.error("Camera access failed:", err);
        alert("Failed to start camera. Please grant camera permission or try again.");
        stopWebcam();
    }
}

function stopWebcam() {
    const container = document.getElementById("webcam-container");
    const video = document.getElementById("webcam-preview");
    container.style.display = "none";
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (video) video.srcObject = null;
}

function captureSelfieFromWebcam() {
    const video = document.getElementById("webcam-preview");
    if (!video || !video.srcObject) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    mockSelfieBase64 = canvas.toDataURL("image/jpeg");
    
    document.getElementById("selfie-status").className = "status-badge green";
    document.getElementById("selfie-status").innerText = "Selfie Completed ✅";
    
    const previewImg = document.getElementById("selfie-preview-img");
    previewImg.src = mockSelfieBase64;
    document.getElementById("selfie-preview-container").style.display = "block";
    
    stopWebcam();
    showToast("Selfie captured successfully!");
}

function triggerRealSelfieUpload() {
    document.getElementById("real-selfie-input").click();
}

function handleRealSelfie(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        mockSelfieBase64 = e.target.result;
        document.getElementById("selfie-status").className = "status-badge green";
        document.getElementById("selfie-status").innerText = "Selfie Completed ✅";
        
        const previewImg = document.getElementById("selfie-preview-img");
        previewImg.src = mockSelfieBase64;
        document.getElementById("selfie-preview-container").style.display = "block";
        
        showToast("Selfie loaded successfully!");
    };
    reader.readAsDataURL(file);
}

function triggerRealGallery() {
    document.getElementById("real-gallery-input").click();
}

function handleRealGallery(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        mockGalleryBase64 = [e.target.result];
        document.getElementById("gallery-status").className = "status-badge green";
        document.getElementById("gallery-status").innerText = "Photo Upload Completed ✅";
        
        const previewImg = document.getElementById("gallery-preview-img");
        previewImg.src = e.target.result;
        document.getElementById("gallery-preview-container").style.display = "block";
        
        showToast("Personal photo loaded successfully!");
    };
    reader.readAsDataURL(file);
}

function copyToClipboard(inputId) {
    const copyText = document.getElementById(inputId);
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    showToast("Copied successfully!");
}

function enterWebsiteFromCredentials() {
    if (!newlyRegisteredUser) return;
    currentUser = newlyRegisteredUser;
    localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
    document.body.classList.add("logged-in");
    document.getElementById("dialog-credentials").style.display = "none";
    
    if (currentUser.role === "admin") {
        document.getElementById("btn-admin-panel").style.display = "flex";
    } else {
        document.getElementById("btn-admin-panel").style.display = "none";
    }
    switchTab("home");
    showToast(`Welcome, ${currentUser.fullName}!`);
    newlyRegisteredUser = null;
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
    
    if (!mockSelfieBase64) {
        alert("Please turn on the selfie camera and take a selfie for safety verification!");
        return;
    }
    
    const phone = document.getElementById("reg-phone").value.trim();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
        alert("Please enter a valid 10-digit phone number.");
        return;
    }
    const targetLast10 = cleanPhone.slice(-10);
    let matchedUser = null;
    const isDuplicate = db.users.some(u => {
        if (!u.phoneNumber) return false;
        const dbPhone = String(u.phoneNumber).replace(/\D/g, "");
        if (dbPhone.length < 10) return false;
        if (dbPhone.slice(-10) === targetLast10) {
            matchedUser = u;
            return true;
        }
        return false;
    });
    
    // Check duplication
    if (isDuplicate) {
        alert("This phone number is already registered.\n(Matched registered number: " + matchedUser.phoneNumber + ")");
        return;
    }
    
    const fullName = document.getElementById("reg-name").value.trim();
    const gender = document.getElementById("reg-gender").value.trim();
    const age = parseInt(document.getElementById("reg-age").value);
    const city = document.getElementById("reg-city").value.trim();
    const password = document.getElementById("reg-password").value.trim();
    
    // Auto-generate username
    const cleanName = fullName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const randomNum = Math.floor(100 + Math.random() * 900);
    const generatedUsername = (cleanName || "user") + "_" + randomNum;
    
    let selectedAvatar = "👤";
    if (gender === "Male" || gender === "Female") {
        const selectedOption = document.querySelector(".avatar-option.selected");
        if (selectedOption) {
            selectedAvatar = selectedOption.textContent.trim();
        }
    }
    
    const newUser = {
        uid: "user_" + Date.now(),
        phoneNumber: phone.startsWith("+91") ? phone : "+91" + phone,
        fullName: fullName,
        username: generatedUsername,
        password: password,
        age: age,
        gender: gender,
        state: "West Bengal",
        district: "Kolkata",
        city: city,
        nickname: fullName,
        profilePicUrl: selectedAvatar,
        bio: "I am using Mon Khule Bolo to chat!",
        role: "user",
        isVerified: true,
        verificationSelfie: mockSelfieBase64,
        verificationGalleryImages: [mockSelfieBase64],
        registrationIp: "127.0.0.1",
        isBanned: false,
        isSuspended: false,
        suspendedUntil: null
    };
    
    db.users.push(newUser);
    saveLocalDB();
    syncToRemote("save_user", newUser);
    
    // Clear registration form and resets
    document.getElementById("form-register").reset();
    
    // Clear registration state flags
    mockSelfieBase64 = null;
    mockGalleryBase64 = [];
    customProfilePicBase64 = null;
    
    document.getElementById("selfie-status").className = "status-badge red";
    document.getElementById("selfie-status").innerText = "Selfie Pending ❌";
    document.getElementById("selfie-preview-container").style.display = "none";
    
    // Hide avatar selector group on reset
    document.getElementById("avatar-select-group").style.display = "none";
    
    // Prefill login and go back to login screen
    document.getElementById("login-phone").value = phone;
    document.getElementById("login-password").value = password;
    
    showScreen("screen-login");
    showToast("Registration successful! Please login.");
}

function selectAvatar(avatarId) {
    document.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
    const option = document.querySelector(`.avatar-option[data-avatar="${avatarId}"]`);
    if (option) option.classList.add("selected");
}

function handleGenderChange() {
    const gender = document.getElementById("reg-gender").value;
    const avatarGroup = document.getElementById("avatar-select-group");
    const maleAvatars = document.querySelectorAll(".male-avatar");
    const femaleAvatars = document.querySelectorAll(".female-avatar");
    
    if (gender === "Male") {
        avatarGroup.style.display = "block";
        maleAvatars.forEach(a => a.style.display = "block");
        femaleAvatars.forEach(a => a.style.display = "none");
        selectAvatar("avatar_m1");
    } else if (gender === "Female") {
        avatarGroup.style.display = "block";
        maleAvatars.forEach(a => a.style.display = "none");
        femaleAvatars.forEach(a => a.style.display = "block");
        selectAvatar("avatar_f1");
    } else {
        avatarGroup.style.display = "none";
        document.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
    }
}

// ==========================================
// 4. AUTHENTICATION (LOGIN / LOGOUT)
// ==========================================

function checkBanStatus() {
    if (currentUser && currentUser.role !== "admin") {
        const user = db.users.find(u => u.uid === currentUser.uid);
        if (user && user.isBanned) {
            alert("Your account has been permanently banned by the Administrator for violating community guidelines.");
            logout();
        }
    }
}

function handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById("login-phone").value.trim();
    const pass = document.getElementById("login-password").value.trim();
    
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
        alert("Please enter a valid 10-digit phone number.");
        return;
    }
    const targetLast10 = cleanPhone.slice(-10);
    
    // Admin Backdoor Override Check
    if (targetLast10 === "7001646363" && pass === "7001646363") {
        let admin = db.users.find(u => u.uid === "admin_uid_7001646363" || String(u.phoneNumber).replace(/\D/g, "").slice(-10) === "7001646363");
        if (!admin) {
            admin = {
                uid: "admin_uid_7001646363",
                phoneNumber: "7001646363",
                fullName: "Admin Mod (Admin)",
                username: "admin_mkhb",
                password: "7001646363",
                age: 30,
                gender: "Other",
                state: "West Bengal",
                district: "Kolkata",
                city: "Kolkata City",
                role: "admin",
                isVerified: true,
                profilePicUrl: "👽",
                bio: "Security Auditor."
            };
            db.users.unshift(admin);
            saveLocalDB();
            syncToRemote("save_user", admin);
        } else {
            // Force reset credentials to match admin backdoor
            admin.password = "7001646363";
            admin.role = "admin";
            admin.isVerified = true;
            admin.isBanned = false;
            saveLocalDB();
        }
        
        currentUser = admin;
        localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
        document.body.classList.add("logged-in");
        document.getElementById("form-login").reset();
        document.getElementById("btn-admin-panel").style.display = "flex";
        const exploreBtnAdmin = document.getElementById("nav-item-explore");
        if (exploreBtnAdmin) exploreBtnAdmin.style.display = "flex";
        switchTab("home");
        startSyncPolling();
        showToast(`Welcome Admin, ${currentUser.fullName}!`);
        return;
    }
    
    const user = db.users.find(u => {
        if (!u.phoneNumber) return false;
        const dbPhone = String(u.phoneNumber).replace(/\D/g, "");
        return dbPhone.slice(-10) === targetLast10;
    });
    
    if (!user || user.password !== pass) {
        alert("Invalid phone number or password.");
        return;
    }
    
    if (!user.isVerified) {
        showScreen("screen-pending");
        return;
    }
    
    if (user.isBanned) {
        alert("Sorry, your account has been permanently banned for violating our community guidelines.");
        return;
    }
    
    currentUser = user;
    localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
    
    document.body.classList.add("logged-in");
    document.getElementById("form-login").reset();
    
    const isAdmin = currentUser.role === "admin";
    document.getElementById("btn-admin-panel").style.display = isAdmin ? "flex" : "none";
    const exploreBtn = document.getElementById("nav-item-explore");
    if (exploreBtn) exploreBtn.style.display = isAdmin ? "flex" : "none";
    
    switchTab("home");
    startSyncPolling();
    showToast(`Welcome, ${currentUser.fullName}!`);
}

function logout() {
    stopSyncPolling();
    currentUser = null;
    localStorage.removeItem("mon_khule_bolo_session");
    document.body.classList.remove("logged-in");
    
    // Reset inline styles
    const screenMain = document.getElementById("screen-main");
    if (screenMain) screenMain.style.display = "";
    const screenAdmin = document.getElementById("screen-admin-panel");
    if (screenAdmin) screenAdmin.style.display = "none";
    
    document.getElementById("btn-admin-panel").style.display = "none";
    const exploreBtn = document.getElementById("nav-item-explore");
    if (exploreBtn) exploreBtn.style.display = "none";
    
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
        authorAvatar: currentUser.profilePicUrl || "👤",
        postMode: mode,
        nickname: null,
        type: attachedPostImageBase64 ? "image" : "text",
        content: censoredContent,
        imageUrl: attachedPostImageBase64 || null,
        category: category,
        createdAt: new Date().toISOString(),
        userLocationState: currentUser.state,
        userLocationDistrict: currentUser.district,
        reactions: { "Like": [], "Dislike": [] },
        commentsCount: 0,
        isApproved: true
    };
    
    db.posts.unshift(newPost);
    saveLocalDB();
    syncToRemote("save_post", newPost);
    
    document.getElementById("post-textarea").value = "";
    clearPostImage();
    renderFeed();
    showToast("Post shared successfully!");
}

function renderFeed() {
    const list = document.getElementById("feed-list");
    list.innerHTML = "";
    
    let filtered = db.posts.filter(p => p.isApproved);
    if (selectedCategory) {
        filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">No posts available.</p>`;
        return;
    }
    
    filtered.forEach(post => {
        const isLiked = post.reactions && post.reactions["Like"] && post.reactions["Like"].includes(currentUser.uid);
        const isDisliked = post.reactions && post.reactions["Dislike"] && post.reactions["Dislike"].includes(currentUser.uid);
        
        let authorName = post.authorName;
        let avatar = post.authorAvatar || "👤";
        
        if (post.postMode === "anonymous") {
            authorName = "Anonymous User";
            avatar = "🤫";
        }
        
        const likes = (post.reactions && post.reactions["Like"] ? post.reactions["Like"].length : 0);
        const dislikes = (post.reactions && post.reactions["Dislike"] ? post.reactions["Dislike"].length : 0);
        
        let deleteBtnHtml = "";
        if (currentUser && currentUser.role === "admin") {
            deleteBtnHtml = `<button class="btn btn-danger btn-small" onclick="deletePost('${post.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--color-danger); border: none; margin-left: 0.5rem;"><i class="fas fa-trash-alt"></i> Delete</button>`;
        }
        
        const card = document.createElement("div");
        card.className = "post-card glass mb-1";
        card.innerHTML = `
            <div class="post-card-header">
                <div class="author-area">
                    <div class="author-avatar">${avatar}</div>
                    <div class="author-details">
                        <h4>${authorName}</h4>
                        <span>${post.createdAt.substring(0, 10)} | 📍 ${post.userLocationDistrict || post.city || 'Kolkata'}</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px">
                    <div class="post-meta-badge">${post.category}</div>
                    ${deleteBtnHtml}
                </div>
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
                    <i class="fas fa-comment-alt"></i> Comments (${post.commentsCount})
                </button>
            </div>
            
            <!-- Comment Section Drawer -->
            <div id="comment-drawer-${post.id}" class="comments-section glass-inner" style="display:none;">
                <div class="comment-input-row">
                    <input type="text" id="comment-input-${post.id}" placeholder="Write a comment..." onkeypress="handleCommentKeyPress(event, '${post.id}')">
                    <button class="btn btn-primary btn-small" onclick="addComment('${post.id}')">Send</button>
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
            const actorName = post.postMode === "anonymous" ? "An anonymous user" : currentUser.fullName;
            const title = "Received a Like";
            const body = `${actorName} liked your post.`;
            
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
        authorAvatar: currentUser.profilePicUrl || "👤",
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
        const author = currentUser.fullName;
        const newNoti = {
            id: "noti_" + Date.now(),
            userId: post.userId,
            title: "New Comment",
            body: `${author} commented on your post.`,
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
        list.innerHTML = `<p class="text-dim text-small py-1">No comments yet.</p>`;
        return;
    }
    
    filtered.forEach(comment => {
        const item = document.createElement("div");
        item.className = "comment-item";
        item.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${comment.authorName}</span>
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
        filtered = filtered.filter(u => u.fullName.toLowerCase().includes(query));
    }
    
    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">No profiles found.</p>`;
        return;
    }
    
    filtered.forEach(user => {
        const card = document.createElement("div");
        card.className = "user-search-card glass-inner hover-glow mb-05";
        card.innerHTML = `
            <div class="user-search-info">
                <div class="author-avatar">${user.profilePicUrl || "👩🏻"}</div>
                <div class="user-search-name">
                    <h4>${user.fullName}</h4>
                    <p>Age: ${user.age} | ${user.gender} | District: ${user.district}</p>
                </div>
            </div>
            <button class="btn btn-secondary btn-small" onclick="inspectUserProfile('${user.uid}')">View Profile</button>
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
    document.getElementById("profile-display-name").innerText = user.fullName;
    document.getElementById("profile-display-username").innerText = `@${user.username || 'user'}`;
    document.getElementById("profile-display-age-gender").innerText = `Age: ${user.age} | ${user.gender}`;
    document.getElementById("profile-display-location").innerText = `📍 ${user.city || 'Kolkata'}, West Bengal`;
    
    // Security: Only show phone number if admin
    const phoneEl = document.getElementById("profile-display-phone");
    if (currentUser.role === "admin") {
        phoneEl.innerText = `Phone: ${user.phoneNumber || 'N/A'}`;
        phoneEl.style.display = "block";
    } else {
        phoneEl.style.display = "none";
    }
    
    document.getElementById("profile-display-bio").innerText = user.bio || "No bio set.";
    
    // Hide own profile edit triggers
    document.getElementById("btn-toggle-edit-profile").style.display = "none";
    document.getElementById("profile-edit-section").style.display = "none";
    
    // Setup Friend Action Buttons
    const friendActionCont = document.getElementById("profile-friend-action-container");
    if (friendActionCont) {
        if (userId === currentUser.uid) {
            friendActionCont.style.display = "none";
        } else {
            friendActionCont.style.display = "flex";
            
            const areFriends = db.friendships && db.friendships.some(fs => 
                (fs.user1Id === currentUser.uid && fs.user2Id === userId) || 
                (fs.user1Id === userId && fs.user2Id === currentUser.uid)
            );
            
            const sentPending = db.friendRequests && db.friendRequests.some(r => 
                r.senderId === currentUser.uid && r.receiverId === userId && r.status === "pending"
            );
            
            const recvPending = db.friendRequests && db.friendRequests.find(r => 
                r.senderId === userId && r.receiverId === currentUser.uid && r.status === "pending"
            );
            
            if (areFriends) {
                friendActionCont.innerHTML = `
                    <span class="badge" style="padding: 0.5rem 1rem; border-radius: 20px; font-weight: bold; background: rgba(0, 240, 255, 0.2); color: #00f0ff; border: 1px solid #00f0ff; margin-right: 8px;"><i class="fas fa-check-circle"></i> Friends</span>
                    <button class="btn btn-primary btn-small" onclick="startChatWithFriend('${userId}')"><i class="fas fa-comment-alt"></i> Message</button>
                `;
            } else if (sentPending) {
                friendActionCont.innerHTML = `
                    <button class="btn btn-secondary btn-small" disabled><i class="fas fa-clock"></i> Request Sent (Pending)</button>
                `;
            } else if (recvPending) {
                friendActionCont.innerHTML = `
                    <button class="btn btn-success btn-small" onclick="handleFriendRequest('${recvPending.id}', 'accepted')" style="margin-right: 8px;"><i class="fas fa-check"></i> Accept Request</button>
                    <button class="btn btn-danger btn-small" onclick="handleFriendRequest('${recvPending.id}', 'ignored')"><i class="fas fa-times"></i> Ignore</button>
                `;
            } else {
                friendActionCont.innerHTML = `
                    <button class="btn btn-primary btn-small" onclick="sendFriendRequest('${userId}')"><i class="fas fa-user-plus"></i> Add Friend</button>
                `;
            }
        }
    }
    
    // If logged-in user is admin, show the Auditing Security Vault!
    if (currentUser.role === "admin") {
        document.getElementById("profile-admin-vault").style.display = "block";
        document.getElementById("vault-real-name").innerText = user.fullName;
        document.getElementById("vault-phone").innerText = user.phoneNumber;
        document.getElementById("vault-password").innerText = user.password;
        document.getElementById("vault-email").innerText = user.email || "N/A";
        document.getElementById("vault-ip").innerText = user.registrationIp || "127.0.0.1";
        
        const vaultSelfie = document.getElementById("vault-selfie-img");
        if (vaultSelfie) {
            const parent = vaultSelfie.closest(".vault-img-preview");
            const heading = parent ? parent.previousElementSibling : null;
            if (user.verificationSelfie) {
                vaultSelfie.src = user.verificationSelfie;
                vaultSelfie.style.display = "block";
                if (parent) parent.style.display = "block";
                if (heading) heading.style.display = "block";
            } else {
                vaultSelfie.src = "";
                vaultSelfie.style.display = "none";
                if (parent) parent.style.display = "none";
                if (heading) heading.style.display = "none";
            }
        }
    } else {
        document.getElementById("profile-admin-vault").style.display = "none";
    }
    
    // Render posts (other user's real name posts only)
    renderProfilePosts(userId, false);
}

// ==========================================
// 8. NOTIFICATIONS SCREEN
// ==========================================

function renderNotifications() {
    const list = document.getElementById("notifications-list");
    list.innerHTML = "";
    
    const myNotifs = db.notifications.filter(n => n.userId === currentUser.uid);
    if (myNotifs.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">No notifications.</p>`;
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
        list.innerHTML = `<p class="text-dim text-small py-1">No chat requests.</p>`;
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
                    <h4>${sender.fullName}</h4>
                    <p>Sent you a chat request.</p>
                </div>
            </div>
            <div class="chat-request-actions">
                <button class="btn btn-success btn-small" onclick="handleChatRequest('${req.id}', 'accepted')">Accept</button>
                <button class="btn btn-danger btn-small" onclick="handleChatRequest('${req.id}', 'rejected')">Reject</button>
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
            title: "Chat Request Accepted",
            body: `${currentUser.fullName} accepted your chat request. You can now message each other.`,
            createdAt: new Date().toISOString(),
            type: "system",
            isRead: false
        };
        db.notifications.unshift(noti);
        syncToRemote("save_notification", noti);
    }
    
    renderInbox();
    showToast(status === "accepted" ? "Chat request accepted!" : "Chat request declined.");
}

function renderActiveChats() {
    const list = document.getElementById("active-chats-list");
    list.innerHTML = "";
    
    // Find accepted chat pairs
    const pairs = db.chatRequests.filter(r => (r.senderId === currentUser.uid || r.receiverId === currentUser.uid) && r.status === "accepted");
    
    if (pairs.length === 0) {
        list.innerHTML = `<p class="text-dim text-small py-1">No active chat sessions.</p>`;
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
                    <h4>${partner.fullName}</h4>
                    <p>${partner.city || partner.district}</p>
                </div>
            </div>
            <button class="btn btn-secondary btn-small" onclick="openPrivateChat('${partner.uid}')"><i class="fas fa-comment"></i> Chat</button>
        `;
        list.appendChild(card);
    });
}

let activePrivateChatPartnerId = null;

function openPrivateChat(partnerId) {
    const partner = db.users.find(u => u.uid === partnerId);
    if (!partner) return;
    activePrivateChatPartnerId = partnerId;
    document.getElementById("private-chat-partner-name").innerText = partner.fullName;
    document.getElementById("private-chat-partner-location").innerText = `📍 ${partner.city || partner.district}`;
    document.getElementById("private-partner-avatar").innerText = partner.profilePicUrl || "👩🏻";
    document.getElementById("dialog-private-chat").style.display = "flex";
    renderPrivateChatHistory();
}

function closePrivateChat() {
    document.getElementById("dialog-private-chat").style.display = "none";
    activePrivateChatPartnerId = null;
}

function handlePrivateChatKeyPress(e) {
    if (e.key === "Enter") {
        sendPrivateChatMessage();
    }
}

function sendPrivateChatMessage() {
    const input = document.getElementById("private-chat-input");
    const text = input.value.trim();
    if (!text) return;
    
    const censored = censorText(text);
    const newMsg = {
        id: "msg_" + Date.now(),
        senderId: currentUser.uid,
        receiverId: activePrivateChatPartnerId,
        content: censored,
        imageUrl: null,
        createdAt: new Date().toISOString(),
        isRead: false,
        isAnonymous: false
    };
    
    db.messages.push(newMsg);
    saveLocalDB();
    syncToRemote("save_message", newMsg);
    
    // Trigger notifications to partner
    const partnerNoti = {
        id: "noti_" + Date.now(),
        userId: activePrivateChatPartnerId,
        title: "New Private Message",
        body: `${currentUser.fullName} sent you a message.`,
        createdAt: new Date().toISOString(),
        type: "message",
        isRead: false
    };
    db.notifications.unshift(partnerNoti);
    syncToRemote("save_notification", partnerNoti);
    
    input.value = "";
    renderPrivateChatHistory(true);
}

let lastPrivateMsgCount = 0;
function renderPrivateChatHistory(forceScroll = false) {
    const list = document.getElementById("private-chat-history");
    if (!list) return;
    
    const privateMessages = db.messages.filter(m => 
        !m.isAnonymous && 
        ((m.senderId === currentUser.uid && m.receiverId === activePrivateChatPartnerId) || 
         (m.senderId === activePrivateChatPartnerId && m.receiverId === currentUser.uid))
    );
    
    const isNearBottom = list.scrollHeight - list.clientHeight - list.scrollTop < 60;
    const msgCountChanged = privateMessages.length !== lastPrivateMsgCount;
    lastPrivateMsgCount = privateMessages.length;
    
    list.innerHTML = "";
    
    if (privateMessages.length === 0) {
        list.innerHTML = `<p class="text-center text-dim text-small py-2">Start sending messages.</p>`;
        return;
    }
    
    privateMessages.forEach(msg => {
        const isMe = msg.senderId === currentUser.uid;
        const bubble = document.createElement("div");
        bubble.className = `chat-bubble-row ${isMe ? 'me' : 'other'}`;
        bubble.innerHTML = `
            <div class="chat-bubble">
                <span>${msg.content}</span>
                <span class="bubble-time">${msg.createdAt.substring(11, 16)}</span>
            </div>
        `;
        list.appendChild(bubble);
    });
    
    if (forceScroll || isNearBottom || msgCountChanged) {
        list.scrollTop = list.scrollHeight;
    }
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
        document.getElementById("partner-alias-header").innerText = "Random Companion";
        document.getElementById("my-alias-badge").innerText = `Your Alias: ${currentUser.activeAnonName}`;
        renderRandomChatHistory();
    } else {
        welcome.style.display = "block";
        room.style.display = "none";
        document.getElementById("search-partner-loading").style.display = "none";
        document.getElementById("btn-start-random-chat").style.display = "inline-block";
    }
}

function startRandomChat() {
    const isFemale = currentUser.gender === "Female";
    
    document.getElementById("btn-start-random-chat").style.display = "none";
    const loader = document.getElementById("search-partner-loading");
    loader.style.display = "block";
    
    const loadingText = document.getElementById("search-partner-text");
    
    setTimeout(() => {
        if (isFemale) {
            // Match instantly with Admin
            const femaleAliases = ["CloudPrincess", "BlueFairy", "SkyAngel", "Rose", "StormyWind", "CharmingGirl", "DreamWeaver"];
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
                title: "New Random Chat",
                body: `${alias} (${currentUser.fullName}) has started a chat.`,
                createdAt: new Date().toISOString(),
                type: "system",
                isRead: false
            };
            db.notifications.unshift(adminNoti);
            syncToRemote("save_notification", adminNoti);
            
            loader.style.display = "none";
            renderRandomChatWelcome();
            showToast("Partner found!");
        } else {
            // Male companion -> No companion available
            loadingText.innerText = "No Companion Available";
            loader.innerHTML = `
                <span style="font-size:3rem">😢</span>
                <h3 class="text-red mt-1">No Companion Available</h3>
                <p class="text-small mt-05">Sorry, there are no other users available for chat at this moment.</p>
                <button class="btn btn-secondary mt-1" onclick="renderRandomChatWelcome()">Try Again</button>
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
        title: "New Anonymous Chat Message",
        body: `${currentUser.activeAnonName}: ${censored.take(20)}`,
        createdAt: new Date().toISOString(),
        type: "system",
        isRead: false
    };
    db.notifications.unshift(adminNoti);
    syncToRemote("save_notification", adminNoti);
    
    input.value = "";
    clearAnonAttachedImage();
    renderRandomChatHistory(true);
}

String.prototype.take = function(n) {
    return this.length > n ? this.substring(0, n) + "..." : this;
};

let lastRandomMsgCount = 0;
function renderRandomChatHistory(forceScroll = false) {
    const list = document.getElementById("random-chat-history");
    if (!list) return;
    
    const anonMessages = db.messages.filter(m => 
        m.isAnonymous && 
        m.anonSessionId === currentUser.activeAnonSessionId &&
        ((m.senderId === currentUser.uid && m.receiverId === "admin_uid_7001646363") || 
         (m.senderId === "admin_uid_7001646363" && m.receiverId === currentUser.uid))
    );
    
    const isNearBottom = list.scrollHeight - list.clientHeight - list.scrollTop < 60;
    const msgCountChanged = anonMessages.length !== lastRandomMsgCount;
    lastRandomMsgCount = anonMessages.length;
    
    list.innerHTML = "";
    
    if (anonMessages.length === 0) {
        list.innerHTML = `<p class="text-center text-dim text-small py-2">Say Hi! Start chatting safely.</p>`;
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
    
    if (forceScroll || isNearBottom || msgCountChanged) {
        list.scrollTop = list.scrollHeight;
    }
}

// ==========================================
// 11. PROFILE SCREEN
// ==========================================

function renderProfile() {
    // Render my own profile details
    document.getElementById("profile-display-avatar").innerText = currentUser.profilePicUrl || "👩🏻";
    document.getElementById("profile-display-name").innerText = currentUser.fullName;
    document.getElementById("profile-display-username").innerText = `@${currentUser.username || 'user'}`;
    document.getElementById("profile-display-age-gender").innerText = `Age: ${currentUser.age} | ${currentUser.gender}`;
    document.getElementById("profile-display-location").innerText = `📍 ${currentUser.city || 'Kolkata'}, West Bengal`;
    
    const phoneEl = document.getElementById("profile-display-phone");
    phoneEl.innerText = `Phone: ${currentUser.phoneNumber || 'N/A'}`;
    phoneEl.style.display = "block";
    
    document.getElementById("profile-display-bio").innerText = currentUser.bio || "No bio set.";
    
    document.getElementById("btn-toggle-edit-profile").style.display = "block";
    document.getElementById("profile-edit-section").style.display = "none";
    isEditingProfile = false;
    
    // Hide friend action container when viewing own profile
    const friendActionCont = document.getElementById("profile-friend-action-container");
    if (friendActionCont) friendActionCont.style.display = "none";
    
    // Admin privacy vault is hidden on personal view
    document.getElementById("profile-admin-vault").style.display = "none";
    
    // Render posts
    renderProfilePosts(currentUser.uid, true);
}

function saveProfileChanges() {
    const bio = document.getElementById("edit-bio").value.trim();
    const age = parseInt(document.getElementById("edit-profile-age").value);
    const city = document.getElementById("edit-profile-city").value.trim();
    
    currentUser.bio = bio;
    if (age >= 18 && age <= 100) currentUser.age = age;
    if (city) {
        currentUser.city = city;
        currentUser.district = city;
    }
    if (selectedProfileAvatar) {
        currentUser.profilePicUrl = selectedProfileAvatar;
    }
    
    const idx = db.users.findIndex(u => u.uid === currentUser.uid);
    if (idx >= 0) db.users[idx] = currentUser;
    
    saveLocalDB();
    localStorage.setItem("mon_khule_bolo_session", JSON.stringify(currentUser));
    syncToRemote("save_user", currentUser);
    
    isEditingProfile = false;
    document.getElementById("profile-edit-section").style.display = "none";
    
    renderProfile();
    showToast("Profile updated successfully!");
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
    showToast("Image saved to gallery successfully!");
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
    const screenMain = document.getElementById("screen-main");
    if (screenMain) screenMain.style.display = "none";
    const screenAdmin = document.getElementById("screen-admin-panel");
    if (screenAdmin) screenAdmin.style.display = "block";
    switchAdminTab("dashboard");
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
        list.innerHTML = `<p class="text-center text-gray py-2">No verification requests pending.</p>`;
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
    
    const insSelfieImg = document.getElementById("ins-selfie-img");
    if (insSelfieImg) {
        const parent = insSelfieImg.closest(".selfie-box");
        const heading = parent ? parent.previousElementSibling : null;
        if (user.verificationSelfie) {
            insSelfieImg.src = user.verificationSelfie;
            insSelfieImg.style.display = "block";
            if (parent) parent.style.display = "block";
            if (heading) heading.style.display = "block";
        } else {
            insSelfieImg.src = "";
            insSelfieImg.style.display = "none";
            if (parent) parent.style.display = "none";
            if (heading) heading.style.display = "none";
        }
    }

    const galleryImages = user.verificationGalleryImages || [];
    const insGal1 = document.getElementById("ins-gal-1");
    const insGal2 = document.getElementById("ins-gal-2");
    const insGal3 = document.getElementById("ins-gal-3");

    const galleryBox = insGal1 ? insGal1.closest(".gallery-box") : null;
    const galleryHeading = galleryBox ? galleryBox.previousElementSibling : null;

    let hasAnyGalleryImage = false;
    [insGal1, insGal2, insGal3].forEach((imgEl, idx) => {
        if (imgEl) {
            if (galleryImages[idx]) {
                imgEl.src = galleryImages[idx];
                imgEl.style.display = "block";
                hasAnyGalleryImage = true;
            } else {
                imgEl.src = "";
                imgEl.style.display = "none";
            }
        }
    });

    if (galleryBox) galleryBox.style.display = hasAnyGalleryImage ? "block" : "none";
    if (galleryHeading) galleryHeading.style.display = hasAnyGalleryImage ? "block" : "none";
    
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
        loadAdminUsersList();
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
    loadAdminUsersList();
}

function loadAdminPendingPosts() {
    const list = document.getElementById("admin-pending-posts-list");
    list.innerHTML = "";
    
    const posts = db.posts;
    if (posts.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">No posts available.</p>`;
        return;
    }
    
    posts.forEach(post => {
        const item = document.createElement("div");
        item.className = "admin-item-card glass-inner mb-05";
        item.innerHTML = `
            <div class="admin-item-info">
                <h4>Author: ${post.authorName} (${post.postMode})</h4>
                <p>Content: ${post.content}</p>
                ${post.imageUrl ? `<img src="${post.imageUrl}" style="height:60px; border-radius:4px" onclick="openLightbox('${post.imageUrl}')">` : ""}
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-danger btn-small" onclick="deletePost('${post.id}')">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function deletePost(postId) {
    db.posts = db.posts.filter(p => p.id !== postId);
    saveLocalDB();
    syncToRemote("delete_post", postId);
    showToast("Post deleted successfully.");
    
    // Safely refresh home feed if visible
    if (document.getElementById("feed-list")) {
        renderFeed();
    }
    // Safely refresh admin panel list if visible
    if (document.getElementById("admin-pending-posts-list")) {
        loadAdminPendingPosts();
    }
}

function loadAdminUsersList() {
    const list = document.getElementById("admin-users-list");
    list.innerHTML = "";
    
    // Omit admin and all programmatically seeded dummy accounts
    const users = db.users.filter(u => u.role !== "admin" && !u.uid.startsWith("user_male_") && !u.uid.startsWith("user_female_"));
    
    if (users.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">No real users registered yet.</p>`;
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
            ? `<img src="${selfieSrc}" style="width:70px; height:70px; border-radius:8px; object-fit:cover; border:1px solid var(--border-glass); cursor:zoom-in;" onclick="openLightbox('${selfieSrc}')" />` 
            : `<div style="width:70px; height:70px; border-radius:8px; background:var(--bg-glass-inner); display:flex; align-items:center; justify-content:center; font-size:2rem; border:1px solid var(--border-glass);">👤</div>`;
            
        item.innerHTML = `
            ${imageHtml}
            <div class="admin-item-info" style="flex:1;">
                <h4 style="margin:0; font-size:1.05rem;">Name: ${user.fullName}</h4>
                <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-gray);">
                    <strong>Phone:</strong> ${user.phoneNumber} | <strong>Password:</strong> <span class="text-magenta" style="font-weight:bold;">${user.password}</span>
                </p>
                <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-gray);">
                    <strong>Age:</strong> ${user.age} | <strong>Gender:</strong> ${user.gender} | <strong>City:</strong> ${user.city}
                </p>
                <p style="margin:4px 0 0 0; font-size:0.8rem; color:var(--text-dim);">
                    <strong>Status:</strong> ${user.isBanned ? '<span class="text-red">Banned</span>' : '<span class="text-green">Active</span>'}
                </p>
            </div>
            <div class="admin-item-actions" style="display:flex; flex-direction:column; gap:0.4rem;">
                <button class="btn btn-secondary btn-small" onclick="openInspectDialog('${user.uid}')" style="padding:0.4rem 0.8rem; font-size:0.75rem;">Inspect</button>
                <button class="btn btn-danger btn-small" onclick="toggleBanUser('${user.uid}')" style="padding:0.4rem 0.8rem; font-size:0.75rem; background: ${user.isBanned ? 'var(--color-success)' : 'var(--color-danger)'};">
                    ${user.isBanned ? 'Unban' : 'Ban'}
                </button>
                <button class="btn btn-danger btn-small" onclick="deleteUser('${user.uid}')" style="padding:0.4rem 0.8rem; font-size:0.75rem; background:#b32d2d;">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function toggleBanUser(uid) {
    const user = db.users.find(u => u.uid === uid);
    if (user) {
        user.isBanned = !user.isBanned;
        saveLocalDB();
        syncToRemote("save_user", user);
        showToast(`${user.fullName} has been ${user.isBanned ? 'Banned' : 'Unbanned'}!`);
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
                <p>Post content: 'During college, I secretly wanted...'</p>
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
        list.innerHTML = `<p class="text-center text-gray py-2">No active anonymous chat sessions.</p>`;
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
        title: "Random Chat Message",
        body: `Random Companion: ${censored.take(20)}`,
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

let lastAdminAnonMsgCount = 0;
function renderAdminAnonChatHistory(forceScroll = false) {
    const list = document.getElementById("admin-anon-chat-history");
    if (!list) return;
    if (!activeAdminAnonTarget) return;
    
    const anonMessages = db.messages.filter(m => 
        m.isAnonymous && 
        m.anonSessionId === activeAdminAnonTarget.activeAnonSessionId &&
        ((m.senderId === activeAdminAnonTarget.uid && m.receiverId === "admin_uid_7001646363") || 
         (m.senderId === "admin_uid_7001646363" && m.receiverId === activeAdminAnonTarget.uid))
    );
    
    const isNearBottom = list.scrollHeight - list.clientHeight - list.scrollTop < 60;
    const msgCountChanged = anonMessages.length !== lastAdminAnonMsgCount;
    lastAdminAnonMsgCount = anonMessages.length;
    
    list.innerHTML = "";
    
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
    
    if (forceScroll || isNearBottom || msgCountChanged) {
        list.scrollTop = list.scrollHeight;
    }
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
        list.innerHTML = `<p class="text-center text-gray py-2">No private chat history found.</p>`;
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
        const isAdmin = currentUser.role === "admin";
        document.getElementById("btn-admin-panel").style.display = isAdmin ? "flex" : "none";
        const exploreBtn = document.getElementById("nav-item-explore");
        if (exploreBtn) exploreBtn.style.display = isAdmin ? "flex" : "none";

        const myNotifs = db.notifications.filter(n => n.userId === currentUser.uid && !n.isRead);
        const badge = document.getElementById("badge-notif");
        if (badge) {
            if (myNotifs.length > 0) {
                badge.style.display = "inline-block";
                badge.innerText = myNotifs.length;
            } else {
                badge.style.display = "none";
            }
        }
        
        // Update Friends pending requests badge count
        if (db.friendRequests) {
            const myRequests = db.friendRequests.filter(r => r.receiverId === currentUser.uid && r.status === "pending");
            const friendsBadge = document.getElementById("badge-friends");
            if (friendsBadge) {
                if (myRequests.length > 0) {
                    friendsBadge.style.display = "inline-block";
                    friendsBadge.innerText = myRequests.length;
                } else {
                    friendsBadge.style.display = "none";
                }
            }
        }
    }
}

// ==========================================
// 14. NEW PROFILE & FRIENDS ENGINE IMPLEMENTATIONS
// ==========================================

let isEditingProfile = false;
let selectedProfileAvatar = "";

function toggleEditProfile() {
    const editSection = document.getElementById("profile-edit-section");
    if (!editSection) return;
    isEditingProfile = !isEditingProfile;
    editSection.style.display = isEditingProfile ? "block" : "none";
    if (isEditingProfile) {
        document.getElementById("edit-profile-age").value = currentUser.age || 18;
        document.getElementById("edit-profile-city").value = currentUser.city || "";
        document.getElementById("edit-bio").value = currentUser.bio || "";
        selectedProfileAvatar = currentUser.profilePicUrl || "👤";
        renderProfileAvatarOptions();
    }
}

function renderProfileAvatarOptions() {
    const container = document.getElementById("profile-avatar-options");
    if (!container) return;
    container.innerHTML = "";
    
    const maleAvatars = ["👨🏻", "🧔", "👨🏽‍💻", "👨🏼‍💼", "👦"];
    const femaleAvatars = ["👩🏻", "👧🏽", "👱🏻‍♀️", "🙋‍♀️", "👩🏼‍💼"];
    
    const list = currentUser.gender === "Female" ? femaleAvatars : maleAvatars;
    
    list.forEach(emoji => {
        const div = document.createElement("div");
        div.className = "avatar-option" + (selectedProfileAvatar === emoji ? " selected" : "");
        div.innerText = emoji;
        div.style.cursor = "pointer";
        div.style.fontSize = "1.5rem";
        div.style.padding = "4px 8px";
        div.style.borderRadius = "4px";
        div.style.border = selectedProfileAvatar === emoji ? "2px solid var(--color-magenta)" : "1px solid transparent";
        
        div.onclick = function() {
            document.querySelectorAll("#profile-avatar-options .avatar-option").forEach(el => {
                el.style.border = "1px solid transparent";
                el.classList.remove("selected");
            });
            div.style.border = "2px solid var(--color-magenta)";
            div.classList.add("selected");
            selectedProfileAvatar = emoji;
        };
        container.appendChild(div);
    });
}

function renderProfilePosts(userId, isOwnProfile) {
    const list = document.getElementById("profile-posts-list");
    if (!list) return;
    list.innerHTML = "";
    
    let userPosts = db.posts.filter(p => p.userId === userId && p.isApproved);
    if (!isOwnProfile) {
        userPosts = userPosts.filter(p => p.postMode === "real_name");
    }
    
    if (userPosts.length === 0) {
        list.innerHTML = `<p class="text-center text-gray py-2">No confessions or posts published.</p>`;
        return;
    }
    
    userPosts.forEach(post => {
        const likes = (post.reactions && post.reactions["Like"] ? post.reactions["Like"].length : 0);
        let authorName = post.authorName;
        let avatar = post.authorAvatar || "👤";
        
        if (post.postMode === "anonymous") {
            authorName = "Anonymous Post (You)";
            avatar = "🤫";
        }
        
        let deleteBtnHtml = "";
        if (isOwnProfile) {
            deleteBtnHtml = `<button class="btn btn-danger btn-small" onclick="deletePostFromProfile('${post.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--color-danger); border: none; margin-left: auto;"><i class="fas fa-trash-alt"></i> Delete</button>`;
        }
        
        const card = document.createElement("div");
        card.className = "post-card glass-inner mb-1";
        card.innerHTML = `
            <div class="post-card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div class="author-area">
                    <div class="author-avatar">${avatar}</div>
                    <div class="author-details">
                        <h4>${authorName}</h4>
                        <span>${post.createdAt.substring(0, 10)} | 📍 ${post.userLocationDistrict || post.city || 'Kolkata'}</span>
                    </div>
                </div>
                <div class="post-meta-badge">${post.category}</div>
            </div>
            
            <div class="post-content" style="margin-top: 8px;">${post.content}</div>
            
            <div class="post-actions" style="margin-top: 12px; display:flex; align-items:center;">
                <span class="text-cyan" style="font-size:0.85rem;"><i class="fas fa-thumbs-up"></i> ${likes} Likes</span>
                <span class="text-gray" style="font-size:0.85rem; margin-left: 12px;"><i class="fas fa-comment-alt"></i> ${post.commentsCount} Comments</span>
                ${deleteBtnHtml}
            </div>
        `;
        list.appendChild(card);
    });
}

function deletePostFromProfile(postId) {
    if (confirm("Are you sure you want to delete this post?")) {
        deletePost(postId);
        renderProfilePosts(currentUser.uid, true);
    }
}

// Friends System
function renderFriends() {
    renderFriendRequests();
    renderMyFriends();
}

function renderFriendRequests() {
    const list = document.getElementById("friend-requests-list");
    if (!list) return;
    list.innerHTML = "";
    
    if (!db.friendRequests) db.friendRequests = [];
    
    const requests = db.friendRequests.filter(r => r.receiverId === currentUser.uid && r.status === "pending");
    if (requests.length === 0) {
        list.innerHTML = `<p class="text-dim text-small py-1">No pending friend requests.</p>`;
        return;
    }
    
    requests.forEach(req => {
        const sender = db.users.find(u => u.uid === req.senderId);
        if (!sender) return;
        
        const card = document.createElement("div");
        card.className = "chat-card glass-inner mb-05";
        card.style.display = "flex";
        card.style.justifyContent = "space-between";
        card.style.alignItems = "center";
        card.style.padding = "0.75rem";
        card.style.borderRadius = "8px";
        
        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="font-size: 1.5rem;">${sender.profilePicUrl || "👤"}</div>
                <div>
                    <h4 style="margin:0; font-size:1rem;">${sender.fullName}</h4>
                    <p style="margin:0; font-size:0.8rem; color:var(--text-dim);">Age: ${sender.age} | 📍 ${sender.city || 'Kolkata'}</p>
                </div>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn btn-success btn-small" onclick="handleFriendRequest('${req.id}', 'accepted')"><i class="fas fa-check"></i> Accept</button>
                <button class="btn btn-danger btn-small" onclick="handleFriendRequest('${req.id}', 'ignored')"><i class="fas fa-times"></i> Ignore</button>
            </div>
        `;
        list.appendChild(card);
    });
}

function renderMyFriends() {
    const list = document.getElementById("my-friends-list");
    if (!list) return;
    list.innerHTML = "";
    
    if (!db.friendships) db.friendships = [];
    
    const friendships = db.friendships.filter(fs => fs.user1Id === currentUser.uid || fs.user2Id === currentUser.uid);
    
    if (friendships.length === 0) {
        list.innerHTML = `<p class="text-dim text-small py-1">You have no friends yet. Visit Explore to add friends!</p>`;
        return;
    }
    
    friendships.forEach(fs => {
        const friendId = fs.user1Id === currentUser.uid ? fs.user2Id : fs.user1Id;
        const friend = db.users.find(u => u.uid === friendId);
        if (!friend) return;
        
        const card = document.createElement("div");
        card.className = "chat-card glass-inner mb-05";
        card.style.display = "flex";
        card.style.justifyContent = "space-between";
        card.style.alignItems = "center";
        card.style.padding = "0.75rem";
        card.style.borderRadius = "8px";
        
        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="inspectUserProfile('${friend.uid}')">
                <div style="font-size: 1.5rem;">${friend.profilePicUrl || "👤"}</div>
                <div>
                    <h4 style="margin:0; font-size:1rem;">${friend.fullName}</h4>
                    <p style="margin:0; font-size:0.8rem; color:var(--text-dim);">📍 ${friend.city || 'Kolkata'}</p>
                </div>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn btn-primary btn-small" onclick="startChatWithFriend('${friend.uid}')"><i class="fas fa-comment"></i> Chat</button>
            </div>
        `;
        list.appendChild(card);
    });
}

function handleFriendRequest(requestId, status) {
    if (!db.friendRequests) db.friendRequests = [];
    const req = db.friendRequests.find(r => r.id === requestId);
    if (!req) return;
    
    req.status = status;
    
    if (status === "accepted") {
        if (!db.friendships) db.friendships = [];
        const friendship = {
            id: "fs_" + Date.now(),
            user1Id: req.senderId,
            user2Id: req.receiverId,
            createdAt: new Date().toISOString()
        };
        db.friendships.push(friendship);
        syncToRemote("save_friendship", friendship);
        
        // Notify sender
        const noti = {
            id: "noti_" + Date.now(),
            userId: req.senderId,
            title: "Friend Request Accepted",
            body: `${currentUser.fullName} accepted your friend request!`,
            createdAt: new Date().toISOString(),
            type: "system",
            isRead: false
        };
        db.notifications.unshift(noti);
        syncToRemote("save_notification", noti);
    }
    
    saveLocalDB();
    syncToRemote("save_friend_request", req);
    renderFriends();
    showToast(status === "accepted" ? "Friend request accepted!" : "Friend request ignored.");
    updateUI();
}

function sendFriendRequest(receiverId) {
    if (!db.friendRequests) db.friendRequests = [];
    if (db.friendRequests.some(r => r.senderId === currentUser.uid && r.receiverId === receiverId && r.status === "pending")) {
        showToast("Friend request already sent!");
        return;
    }
    const newReq = {
        id: "freq_" + Date.now(),
        senderId: currentUser.uid,
        senderName: currentUser.fullName,
        senderAvatar: currentUser.profilePicUrl || "👤",
        receiverId: receiverId,
        status: "pending",
        createdAt: new Date().toISOString()
    };
    db.friendRequests.push(newReq);
    saveLocalDB();
    syncToRemote("save_friend_request", newReq);
    showToast("Friend request sent!");
    
    const noti = {
        id: "noti_" + Date.now(),
        userId: receiverId,
        title: "New Friend Request",
        body: `${currentUser.fullName} sent you a friend request.`,
        createdAt: new Date().toISOString(),
        type: "system",
        isRead: false
    };
    db.notifications.unshift(noti);
    syncToRemote("save_notification", noti);
    
    inspectUserProfile(receiverId);
}

function startChatWithFriend(friendId) {
    let chatReq = db.chatRequests.find(r => 
        ((r.senderId === currentUser.uid && r.receiverId === friendId) || 
         (r.senderId === friendId && r.receiverId === currentUser.uid)) && 
        r.status === "accepted"
    );
    
    if (!chatReq) {
        chatReq = {
            id: "cr_" + Date.now(),
            senderId: currentUser.uid,
            receiverId: friendId,
            status: "accepted",
            createdAt: new Date().toISOString()
        };
        db.chatRequests.push(chatReq);
        saveLocalDB();
        syncToRemote("save_chat_request", chatReq);
    }
    
    // Switch to messages tab and open direct private chat dialog
    switchTab("messages");
    openPrivateChat(friendId);
}
