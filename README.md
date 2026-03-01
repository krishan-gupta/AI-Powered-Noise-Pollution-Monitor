# 🔊 Real-Time Noise Pollution Monitor (Edge AI + IoT)

A high-performance IoT solution designed to detect specific noise pollutants (Car Horns) and monitor environmental decibel levels in real-time. This project features a quantized **TinyML** model deployed on an **ESP32**, syncing data to a **Firebase Realtime Database** hosted in **Singapore** for ultra-low latency.



## 🚀 Key Features

* **Edge AI Detection**: Real-time car horn detection using a quantized **TensorFlow Lite** model.
* **Memory Optimized**: AI "Tensor Arena" reduced to only **3,001 bytes** to prevent system crashes.
* **Low-Latency Sync**: Data travels to the **Singapore (asia-southeast1)** Firebase region and back in under **500ms**.
* **Customizable Analytics**: Integrated dropdown to toggle between **30-second** and **5-minute** data averaging windows.
* **Smart Average Calculation**: Displays a rolling average of decibel levels to provide a stable environmental noise profile.
* **Zero-Lag Dashboard**: Custom-built Vanilla JS frontend with an "Offline-First" handshake to eliminate startup lag.
* **Production Alert Logic**: Automated EmailJS integration triggers alerts only when noise exceeds **85dB for 3 continuous seconds**.

## 🛠️ Tech Stack

* **Hardware**: ESP32 Microcontroller & INMP441 Digital Microphone.
* **AI/ML**: Edge Impulse (Quantized int8 model).
* **Backend**: Firebase Realtime Database (Singapore Instance).
* **Frontend**: HTML5, CSS3 (Tailwind), and Vanilla JavaScript.

## 🧠 System Optimization

To maintain a "snappy" dashboard on a **Lenovo IdeaPad** while processing high-frequency data, the system employs:
* **Quantization**: Converted AI weights into **8-bit integers**, making the model 4x smaller to fit into a 3KB memory footprint.
* **Task Scheduling**: ESP32 alternates between AI inference and WiFi transmission to avoid memory collisions.
* **Event-Driven UI**: The frontend uses a 1-second watchdog timer to monitor sensor health and reset the UI if data stops for >15s.

## 📊 Performance Metrics

| Metric | Value |
| :--- | :--- |
| **AI Processing Time** | < 10ms |
| **RAM Used by AI** | 3,001 bytes |
| **Update Frequency** | 2 readings per second (500ms) |
| **Detection Accuracy** | 73.7% |
| **Email Alert Trigger** | > 85dB for 3.0s |
| **Data Averaging** | Selectable (30s / 5m) |



## 🎓 Acknowledgments
Developed as a semester project at **VIT Chennai**. Specialized in AI/ML and IoT integration.
