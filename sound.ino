#include <WiFi.h>
#include <FirebaseESP32.h>
#include <SOUND_SENSOR_inferencing.h> 
#include "driver/i2s.h"

// --- 1. CREDENTIALS ---
#define WIFI_SSID "Krishan Gupta"
#define WIFI_PASSWORD "krishan123456"
#define FIREBASE_HOST "vit-noise-monitor-pro-default-rtdb.asia-southeast1.firebasedatabase.app" 
#define FIREBASE_AUTH "O6V1u2X3Vs5DeaudSUx7hX24iRnFYxVdz6s0S90H" 

// --- 2. HARDWARE PINS ---
#define I2S_WS 15
#define I2S_SD 32
#define I2S_SCK 14
#define I2S_PORT I2S_NUM_0

FirebaseData fbdo;
FirebaseConfig config;
FirebaseAuth auth;
static float sample_buffer[EI_CLASSIFIER_RAW_SAMPLE_COUNT];

void setup_i2s() {
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = 16000,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = 64,
        .use_apll = false
    };
    i2s_pin_config_t pin_config = {
        .bck_io_num = I2S_SCK, .ws_io_num = I2S_WS,
        .data_out_num = I2S_PIN_NO_CHANGE, .data_in_num = I2S_SD
    };
    i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
    i2s_set_pin(I2S_PORT, &pin_config);
}

int microphone_audio_signal_get_data(size_t offset, size_t length, float *out_ptr) {
    size_t bytes_read;
    int32_t raw_sample;
    for (size_t i = 0; i < length; i++) {
        i2s_read(I2S_PORT, &raw_sample, sizeof(int32_t), &bytes_read, portMAX_DELAY);
        out_ptr[i] = (float)(raw_sample >> 14); 
        if (i < EI_CLASSIFIER_RAW_SAMPLE_COUNT) sample_buffer[i] = out_ptr[i];
    }
    return 0;
}

void setup() {
    Serial.begin(115200);
    setup_i2s();
    
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
    Serial.println("\nWiFi Connected!");
    
    config.host = FIREBASE_HOST;
    config.signer.tokens.legacy_token = FIREBASE_AUTH;
    
    // CRITICAL: Minimal response size for 500ms stability
    fbdo.setResponseSize(256); 
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
    
    Serial.println("System Ready: High-Speed Optimized Mode");
}

void loop() {
    signal_t signal;
    signal.total_length = EI_CLASSIFIER_RAW_SAMPLE_COUNT;
    signal.get_data = &microphone_audio_signal_get_data;

    // 1. Run Tiny AI Model
    ei_impulse_result_t result = { 0 };
    run_classifier(&signal, &result, false);
    
    float horn_score = 0;
    for (size_t ix = 0; ix < EI_CLASSIFIER_LABEL_COUNT; ix++) {
        if (String(result.classification[ix].label) == "horn") {
            horn_score = result.classification[ix].value;
        }
    }

    // 2. Calculate Decibels
    float sum_sq = 0;
    for (int i = 0; i < 500; i++) sum_sq += sample_buffer[i] * sample_buffer[i];
    float current_db = 20 * log10(sqrt(sum_sq / 500.0) / 32768.0) + 120;

    // 3. APPLY DUAL-GATE FILTERS
    // Filter: Confidence > 80% AND Volume > 75dB
    bool is_real_horn = (horn_score > 0.80) && (current_db > 75.0);

    // 4. Sync to Singapore (SG)
    if (WiFi.status() == WL_CONNECTED) {
        FirebaseJson json;
        json.set("db", current_db);
        json.set("is_horn", is_real_horn);

        if (Firebase.setJSON(fbdo, "/live_data", json)) {
            Serial.printf("Sync (SG): %.1f dB | Horn: %s (%.2f)\n", 
                          current_db, (is_real_horn ? "YES" : "NO"), horn_score);
        }
        fbdo.clear(); 
    }
    
    // 5. THE SWEET SPOT DELAY
    delay(500); 
}