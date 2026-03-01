import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Remove the old 'import' line and use this instead:
import "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";

// The library will now be available globally as 'emailjs'
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

// --- 2. Analytics, Email & Heartbeat Variables ---
let dbHistory = [];
let highNoiseStartTime = null;
let lastEmailSentTime = 0;
let lastDataTimestamp = 0; // Tracks the last time data arrived

const NOISE_THRESHOLD = 60;
const DURATION_REQUIRED = 5000;
const EMAIL_COOLDOWN = 15000;

// Initialize EmailJS
emailjs.init("tPkfVATP_WR7Xz3y_NI2h");

// --- 3. Speedometer Class ---
class Speedometer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.max = 130;
    this.value = 0;
    this.currentValue = 0;
    this.animationFrame = null;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.centerX = 150;
    this.centerY = 150;
    this.radius = 110;

    this.themeObserver = new MutationObserver(() => this.drawGauge());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  setValue(newValue) {
    this.value = Math.max(0, Math.min(newValue, this.max));
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animate();
  }

  animate() {
    const diff = this.value - this.currentValue;
    if (Math.abs(diff) > 0.1) {
      this.currentValue += diff * 0.1;
      this.drawGauge();
      this.animationFrame = requestAnimationFrame(() => this.animate());
    }
  }

  getComputedColor(variable) {
    return `hsl(${getComputedStyle(document.documentElement).getPropertyValue(variable).trim()})`;
  }

  drawGauge() {
    this.ctx.clearRect(0, 0, 300, 300);
    const zones = [
      { start: 0, end: 50, color: this.getComputedColor("--good") },
      { start: 50, end: 70, color: this.getComputedColor("--loud") },
      { start: 70, end: 100, color: this.getComputedColor("--too-loud") },
      { start: 100, end: 130, color: this.getComputedColor("--extreme") },
    ];

    zones.forEach((z) => {
      this.ctx.strokeStyle = z.color;
      this.ctx.lineWidth = 25;
      this.ctx.beginPath();
      this.ctx.arc(
        150,
        150,
        110,
        Math.PI * (0.75 + (z.start / 130) * 1.5),
        Math.PI * (0.75 + (z.end / 130) * 1.5),
      );
      this.ctx.stroke();
    });

    const angle = Math.PI * (0.75 + (this.currentValue / 130) * 1.5);
    this.ctx.strokeStyle = this.getComputedColor("--foreground");
    this.ctx.lineWidth = 5;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(150, 150);
    this.ctx.lineTo(150 + 90 * Math.cos(angle), 150 + 90 * Math.sin(angle));
    this.ctx.stroke();

    this.ctx.fillStyle = this.getComputedColor("--foreground");
    this.ctx.font = "bold 28px system-ui";
    this.ctx.textAlign = "center";
    this.ctx.fillText(Math.round(this.currentValue), 150, 200);
  }
}

// --- 4. Initialization ---
const totalNoiseGauge = new Speedometer("speedometer-left");
const themeToggle = document.getElementById("theme-toggle");
const timeWindowSelect = document.getElementById("timeWindow");
const aiStatusDiv = document.getElementById("ai-status");
const sensorStatusDiv = document.getElementById("sensor-status"); // New element

function triggerEmailAlert(avgDb) {
  const params = { avg_db: avgDb.toFixed(1) };
  emailjs
    .send("service_s2s4yyc", "template_dihamwo", params)
    .then(() => console.log("✅ Alert Email Sent!"))
    .catch((err) => console.error("❌ Email Failed:", err));
}

// Function to update the Sensor Status Badge
function updateSensorStatus(isOnline) {
  if (isOnline) {
    sensorStatusDiv.classList.replace("bg-muted", "bg-green-600/20");
    sensorStatusDiv.classList.replace(
      "text-muted-foreground",
      "text-green-500",
    );
    sensorStatusDiv.querySelector("span").innerText = "ESP32: LIVE";
  } else {
    sensorStatusDiv.classList.replace("bg-green-600/20", "bg-muted");
    sensorStatusDiv.classList.replace(
      "text-green-500",
      "text-muted-foreground",
    );
    sensorStatusDiv.querySelector("span").innerText = "Sensor Offline";
  }
}

// --- 5. Live Listener ---
onValue(noiseRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    lastDataTimestamp = Date.now(); // Mark time of arrival
    updateSensorStatus(true); // Data arrived, so it's live

    const currentDb = data.db || 0;
    const now = Date.now();
    totalNoiseGauge.setValue(currentDb);

    // AI Status Update
    if (data.is_horn) {
      aiStatusDiv.className =
        "flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white animate-pulse shadow-lg";
      aiStatusDiv.querySelector("span").innerText = "HORN DETECTED!";
    } else {
      aiStatusDiv.className =
        "flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground";
      aiStatusDiv.querySelector("span").innerText = "No Horn Detected";
    }

    // Analytics Tracking
    dbHistory.push({ time: now, val: currentDb });
    dbHistory = dbHistory.filter((p) => p.time > now - 300000);

    const windowLimit = now - parseInt(timeWindowSelect.value) * 1000;
    const windowData = dbHistory.filter((p) => p.time > windowLimit);

    if (windowData.length > 0) {
      const vals = windowData.map((p) => p.val);
      document.getElementById("avgDb").innerText = (
        vals.reduce((a, b) => a + b, 0) / vals.length
      ).toFixed(1);
      document.getElementById("maxDb").innerText = Math.max(...vals).toFixed(1);
      document.getElementById("minDb").innerText = Math.min(...vals).toFixed(1);
    }

    // Email Alert Timer Logic
    if (currentDb > NOISE_THRESHOLD) {
      if (highNoiseStartTime === null) highNoiseStartTime = now;
      else if (now - highNoiseStartTime >= DURATION_REQUIRED) {
        if (now - lastEmailSentTime >= EMAIL_COOLDOWN) {
          const recent = dbHistory
            .filter((x) => x.time > now - 5000)
            .map((x) => x.val);
          const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
          triggerEmailAlert(avg);
          lastEmailSentTime = now;
          highNoiseStartTime = null;
        }
      }
    } else {
      highNoiseStartTime = null;
    }
  }
});

// Heartbeat interval: Check every 3 seconds if the sensor is still active
setInterval(() => {
  const isOnline = Date.now() - lastDataTimestamp < 5000; // Offline if no data for 5s
  updateSensorStatus(isOnline);
}, 3000);

// Theme & Setup
themeToggle.onclick = () => {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  themeToggle
    .querySelector('[data-lucide="moon"]')
    .classList.toggle("hidden", isDark);
  themeToggle
    .querySelector('[data-lucide="sun"]')
    .classList.toggle("hidden", !isDark);
};

if (localStorage.getItem("theme") !== "light")
  document.documentElement.classList.add("dark");
lucide.createIcons();
