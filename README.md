# 🔊 Real-Time Noise Pollution Monitor (Edge AI + IoT)

A high-performance IoT solution designed to detect specific noise pollutants (Car Horns) and monitor environmental decibel levels in real-time. This project features an optimized **TinyML** model deployed on an **ESP32**, syncing data to a **Firebase Realtime Database** hosted in **Singapore** for ultra-low latency.



## 🚀 Key Features
* **Edge AI Detection**: Real-time car horn detection using a quantized **TensorFlow Lite** model.
* **Memory Optimized**: AI "Tensor Arena" reduced to only **3,001 bytes** to prevent system crashes.
* **Low-Latency Sync**: Data travels to the **Singapore (asia-southeast1)** Firebase region and back in under **500ms**.
* **Pure Web Frontend**: A lightweight, responsive dashboard built using only **HTML5, CSS3, and Vanilla JavaScript**.
* **Smart Filtering**: Uses a dual-gate logic (Confidence > 80% & Volume > 75dB) to stop false alarms.

## 🛠️ Tech Stack
* **Hardware**: ESP32 Microcontroller & INMP441 Digital Microphone.
* **AI/ML**: Edge Impulse (Quantized int8 model).
* **Backend**: Firebase Realtime Database (Singapore Instance).
* **Frontend**: HTML, CSS, and JavaScript (Vanilla).

## 🧠 How I Optimized the System
To make this work on an ESP32 while keeping the live dashboard "snappy," I used three main tricks:

1.  **Tiny AI Brain**: I converted the AI weights into **8-bit integers (Quantization)**. This made the model 4x smaller, allowing it to fit into a tiny 3KB corner of the memory.
2.  **Smart Scheduling**: The ESP32 takes turns between "Listening" and "Sending." By giving the AI 100% focus first and then triggering the WiFi sync, I avoided memory collisions.
3.  **Vanilla JS Speed**: By avoiding heavy frameworks and using **Vanilla JavaScript** with the Firebase SDK, the frontend loads instantly on my **Lenovo IdeaPad** and handles the 500ms data stream with ease.



## 📊 Performance Metrics
* **AI Processing Time**: < 10ms
* **RAM Used by AI**: 3,001 bytes
* **Update Frequency**: 2 readings per second (500ms)
* **Detection Accuracy**: 73.7%

## 🎓 Acknowledgments
Developed as a semester project at **VIT Chennai**.
