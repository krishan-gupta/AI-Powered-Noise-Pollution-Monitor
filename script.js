import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. NEW Firebase Configuration (Singapore Project) ---
const firebaseConfig = {
  apiKey: "AIzaSyDUuwgY7-M7QUiP7lnSXC0QRZd8TtXOfKo",
  authDomain: "vit-noise-monitor-pro.firebaseapp.com",
  databaseURL:
    "https://vit-noise-monitor-pro-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vit-noise-monitor-pro",
  storageBucket: "vit-noise-monitor-pro.firebasestorage.app",
  messagingSenderId: "59273261046",
  appId: "1:59273261046:web:482f8cb91a5ed449cbe1d7",
  measurementId: "G-N1KTSFQBB4",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const noiseRef = ref(db, "live_data"); // Path matches your ESP32 code

// --- 2. Speedometer Class Definition ---
class Speedometer {
  constructor(canvasId, label) {
    this.canvas = document.getElementById(canvasId);
    this.label = label;
    this.max = 130;
    this.value = 0;
    this.currentValue = 0;
    this.animationFrame = null;

    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.radius = Math.min(this.centerX, this.centerY) - 20;

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
    } else {
      this.currentValue = this.value;
      this.drawGauge();
    }
  }

  getComputedColor(variable) {
    const style = getComputedStyle(document.documentElement);
    const value = style.getPropertyValue(variable).trim();
    return `hsl(${value})`;
  }

  getCategory(db) {
    if (db <= 50)
      return { text: "good", color: this.getComputedColor("--good") };
    if (db <= 70)
      return { text: "loud", color: this.getComputedColor("--loud") };
    if (db <= 100)
      return { text: "too loud", color: this.getComputedColor("--too-loud") };
    return { text: "extreme", color: this.getComputedColor("--extreme") };
  }

  drawGauge() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const zones = [
      { start: 0, end: 50, color: this.getComputedColor("--good") },
      { start: 50, end: 70, color: this.getComputedColor("--loud") },
      { start: 70, end: 100, color: this.getComputedColor("--too-loud") },
      { start: 100, end: 130, color: this.getComputedColor("--extreme") },
    ];

    zones.forEach((zone) => {
      const startAngle =
        Math.PI * 0.75 + (zone.start / this.max) * Math.PI * 1.5;
      const endAngle = Math.PI * 0.75 + (zone.end / this.max) * Math.PI * 1.5;
      this.ctx.strokeStyle = zone.color;
      this.ctx.lineWidth = 25;
      this.ctx.beginPath();
      this.ctx.arc(
        this.centerX,
        this.centerY,
        this.radius,
        startAngle,
        endAngle,
      );
      this.ctx.stroke();
    });

    const gaugeText = this.getComputedColor("--gauge-text");
    this.ctx.fillStyle = gaugeText;
    this.ctx.font = "bold 12px system-ui";
    this.ctx.textAlign = "center";

    for (let i = 0; i <= this.max; i += 20) {
      const angle = Math.PI * 0.75 + (i / this.max) * Math.PI * 1.5;
      const textX = this.centerX + (this.radius - 40) * Math.cos(angle);
      const textY = this.centerY + (this.radius - 40) * Math.sin(angle);
      this.ctx.fillText(i.toString(), textX, textY);
    }

    const needleAngle =
      Math.PI * 0.75 + (this.currentValue / this.max) * Math.PI * 1.5;
    const category = this.getCategory(this.currentValue);
    this.ctx.strokeStyle = category.color;
    this.ctx.lineWidth = 5;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(this.centerX, this.centerY);
    this.ctx.lineTo(
      this.centerX + (this.radius - 30) * Math.cos(needleAngle),
      this.centerY + (this.radius - 30) * Math.sin(needleAngle),
    );
    this.ctx.stroke();

    this.ctx.fillStyle = gaugeText;
    this.ctx.font = "bold 28px system-ui";
    this.ctx.fillText(
      Math.round(this.currentValue).toString(),
      this.centerX,
      this.centerY + 50,
    );
    this.ctx.font = "14px system-ui";
    this.ctx.fillText("dB", this.centerX, this.centerY + 70);
    this.ctx.fillStyle = category.color;
    this.ctx.font = "bold 16px system-ui";
    this.ctx.fillText(
      category.text.toUpperCase(),
      this.centerX,
      this.centerY + 95,
    );
  }
}

// --- 3. Initialize Gauges & Theme ---
const totalNoiseGauge = new Speedometer("speedometer-left", "Total Noise");
const carHornGauge = new Speedometer("speedometer-right", "Car Horn");

const themeToggle = document.getElementById("theme-toggle");
const moonIcon = themeToggle.querySelector('[data-lucide="moon"]');
const sunIcon = themeToggle.querySelector('[data-lucide="sun"]');

function setAppTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  moonIcon.classList.toggle("hidden", theme === "dark");
  sunIcon.classList.toggle("hidden", theme !== "dark");
  localStorage.setItem("theme", theme);
}

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.classList.contains("dark");
  setAppTheme(isDark ? "light" : "dark");
});

// --- 4. Live Data Listener (Real-Time Singapore Sync) ---
onValue(noiseRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    // Total Noise (Left) updates with every change
    totalNoiseGauge.setValue(data.db || 0);

    // Car Horn (Right) only moves if is_horn is true
    if (data.is_horn === true) {
      carHornGauge.setValue(data.db);
    } else {
      carHornGauge.setValue(0);
    }
  }
});

// Initial Setup
const savedTheme = localStorage.getItem("theme") || "light";
setAppTheme(savedTheme);
lucide.createIcons();
