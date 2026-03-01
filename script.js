import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";

// --- 1. Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDUuwgY7-M7QUiP7lnSXC0QRZd8TtXOfKo",
  authDomain: "vit-noise-monitor-pro.firebaseapp.com",
  databaseURL:
    "https://vit-noise-monitor-pro-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vit-noise-monitor-pro",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const noiseRef = ref(db, "live_data");

// --- 2. Production Settings ---
let dbHistory = [],
  highNoiseStartTime = null,
  lastEmailSentTime = 0;
let lastDataTimestamp = 0;
let isInitialLoad = true;

const NOISE_THRESHOLD = 85; // 85dB Threshold
const DURATION_REQUIRED = 3000; // 3 Seconds continuous
const EMAIL_COOLDOWN = 15000; // 15 Seconds delay

emailjs.init("lLYa6TFGISI1up15b");

// --- 3. Speedometer Class ---
class Speedometer {
  constructor(id) {
    this.canvas = document.getElementById(id);
    this.ctx = this.canvas.getContext("2d");
    this.v = 0;
    this.cur = 0;
    new MutationObserver(() => this.draw()).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
  setValue(v) {
    this.v = Math.min(Math.max(v, 0), 130);
    this.animate();
  }
  animate() {
    let d = this.v - this.cur;
    if (Math.abs(d) > 0.1) {
      this.cur += d * 0.15;
      this.draw();
      requestAnimationFrame(() => this.animate());
    }
  }
  getHSL(v) {
    return `hsl(${getComputedStyle(document.documentElement).getPropertyValue(v).trim()})`;
  }
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 300, 300);
    const zones = [
      { s: 0, e: 50, c: this.getHSL("--good") },
      { s: 50, e: 70, c: this.getHSL("--loud") },
      { s: 70, e: 100, c: this.getHSL("--too-loud") },
      { s: 100, e: 130, c: this.getHSL("--extreme") },
    ];
    zones.forEach((z) => {
      ctx.strokeStyle = z.c;
      ctx.lineWidth = 20;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(
        150,
        150,
        110,
        Math.PI * (0.75 + (z.s / 130) * 1.5),
        Math.PI * (0.75 + (z.e / 130) * 1.5),
      );
      ctx.stroke();
    });
    ctx.fillStyle = this.getHSL("--foreground");
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    for (let i = 0; i <= 120; i += 20) {
      let a = Math.PI * 0.75 + (i / 130) * Math.PI * 1.5;
      ctx.fillText(i, 150 + 82 * Math.cos(a), 150 + 82 * Math.sin(a));
    }
    let na = Math.PI * (0.75 + (this.cur / 130) * 1.5);
    ctx.strokeStyle = this.getHSL("--foreground");
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.lineTo(150 + 100 * Math.cos(na), 150 + 100 * Math.sin(na));
    ctx.stroke();
    ctx.font = "900 48px system-ui";
    ctx.fillText(Math.round(this.cur), 150, 215);
  }
}

const gauge = new Speedometer("speedometer-left");
const aiStatusDiv = document.getElementById("ai-status");
const sensorStatusDiv = document.getElementById("sensor-status");

function updateStatusUI(live) {
  if (live) {
    sensorStatusDiv.className =
      "flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-500 font-bold border border-green-500/20 transition-all duration-300";
    sensorStatusDiv.querySelector("span").innerText = "ESP32: LIVE";
  } else {
    sensorStatusDiv.className =
      "flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground font-bold border border-transparent opacity-40 transition-all duration-300";
    sensorStatusDiv.querySelector("span").innerText = "SENSOR OFFLINE";
  }
}

updateStatusUI(false);

// --- 4. Firebase Listener ---
onValue(noiseRef, (snap) => {
  const data = snap.val();
  if (data) {
    lastDataTimestamp = Date.now();
    isInitialLoad = false;

    if (sensorStatusDiv.querySelector("span").innerText !== "ESP32: LIVE") {
      updateStatusUI(true);
    }

    const db = data.db || 0;
    gauge.setValue(db);

    if (data.is_horn) {
      aiStatusDiv.className =
        "flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white font-bold shadow-lg shadow-red-500/40";
      aiStatusDiv.querySelector("span").innerText = "HORN DETECTED!";
    } else {
      aiStatusDiv.className =
        "flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 text-muted-foreground font-bold border border-border";
      aiStatusDiv.querySelector("span").innerText = "NO HORN DETECTED";
    }

    dbHistory.push({ t: Date.now(), v: db });
    const winLimit =
      parseInt(document.getElementById("timeWindow").value) * 1000;
    const win = dbHistory.filter((p) => p.t > Date.now() - winLimit);

    if (win.length > 0) {
      const vs = win.map((p) => p.v);
      document.getElementById("avgDb").innerText = (
        vs.reduce((a, b) => a + b) / vs.length
      ).toFixed(1);
      document.getElementById("maxDb").innerText = Math.max(...vs).toFixed(1);
      document.getElementById("minDb").innerText = Math.min(...vs).toFixed(1);
    }

    // --- 5. Email Trigger with Console Logging ---
    if (db > NOISE_THRESHOLD) {
      if (!highNoiseStartTime) {
        highNoiseStartTime = Date.now();
      } else if (Date.now() - highNoiseStartTime >= DURATION_REQUIRED) {
        if (Date.now() - lastEmailSentTime >= EMAIL_COOLDOWN) {
          // TRIGGER EMAIL
          emailjs
            .send("service_s2s4yyc", "template_33vagpn", {
              avg_db: db.toFixed(1),
            })
            .then(() => {
              // NEW: Console Success Message
              console.log(
                "%c✅ EMAIL SENT: 85dB Threshold Exceeded!",
                "color: #10b981; font-weight: bold; font-size: 14px;",
              );
            })
            .catch((error) => {
              // NEW: Console Error Message
              console.error(
                "%c❌ EMAIL FAILED:",
                "color: #ef4444; font-weight: bold;",
                error,
              );
            });

          lastEmailSentTime = Date.now();
          highNoiseStartTime = null;
        }
      }
    } else {
      highNoiseStartTime = null;
    }
  }
});

// --- 6. Heartbeat Logic ---
setInterval(() => {
  if (isInitialLoad) {
    updateStatusUI(false);
    return;
  }
  if (Date.now() - lastDataTimestamp > 5000) {
    if (sensorStatusDiv.querySelector("span").innerText !== "SENSOR OFFLINE") {
      updateStatusUI(false);
    }
  }
}, 3000);

// --- 7. Theme Toggle ---
document.getElementById("theme-toggle").onclick = () => {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  setTimeout(() => lucide.createIcons(), 50);
};

if (localStorage.getItem("theme") === "light")
  document.documentElement.classList.remove("dark");
lucide.createIcons();
