#include <Arduino.h>
#include <HardwareSerial.h>
#include <DFRobotDFPlayerMini.h>
#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <esp_now.h>

// --- CONFIGURACIÓN DE PINES ---
constexpr int PIN_RX2 = 16; 
constexpr int PIN_TX2 = 17; 
constexpr int PIN_SDA = 5;
constexpr int PIN_RST = 22;

constexpr int PIN_POT          = 34; 
constexpr int PIN_SWITCH       = 32; 

constexpr int PIN_PLAY_PAUSE   = 33; // Botón 1: Play / Pausa
constexpr int PIN_STOP         = 25; // Botón 2: Stop
constexpr int PIN_SPEED_UP     = 26; // Botón 3: Aumentar Velocidad (+1 nivel)
constexpr int PIN_SPEED_DOWN   = 27; // Botón 4: Disminuir Velocidad (-1 nivel)

// --- INSTANCIAS ---
HardwareSerial puertoDFPlayer(2);
DFRobotDFPlayerMini miDFPlayer;
MFRC522 rfid(PIN_SDA, PIN_RST);

// --- CONFIGURACIÓN ESP-NOW ---
const uint8_t direccionBroadcast[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

struct __attribute__((packed)) EstructuraDatos {
  int tipoVibracion; 
  unsigned long duracionVibracion; 
};
EstructuraDatos misDatos;
esp_now_peer_info_t informacionPar;

// --- BASE DE DATOS DE PIEZAS DEL MUSEO ---
struct PiezaMuseo {
  String uidHex;                  
  int numeroCarpeta;              
  unsigned long cueIdentificacion;      
  unsigned long duracionIdentificacion; 
  unsigned long cueExtendidaBase;       
  unsigned long duracionExtendidaBase;  
};

const PiezaMuseo inventario[] = {
  // Escarabajo: Carpeta 01. Base original a los 78 segundos (78000ms).
  {"04 4B FA 19 7F 61 80", 1, 0, 0, 78000, 3000},  
  {"8A 9B 0C 1D",            2, 5000, 500, 10000, 2000}, 
  {"F3 44 B2 89",            3, 3000, 500, 6000, 2000}   
};
constexpr int TOTAL_PIEZAS = sizeof(inventario) / sizeof(inventario[0]);

// --- VARIABLES DE ESTADO ---
int ultimoVolumen = -1;
int ultimoModo = -1;
bool estaReproduciendo = false;
int modoVelocidad = 2; 

// VARIABLES PARA BOTONES
bool antPlay = HIGH;
bool antStop = HIGH;
bool antSpeedUp = HIGH;
bool antSpeedDown = HIGH;

// CONTROL MULTIMEDIA DINÁMICO
int carpetaActual = 1;
int archivoActual = 2;
unsigned long tiempoInicioAudio = 0;   
bool vibracionPendiente = false;       
unsigned long tiempoEsperaDinamico = 0; 
unsigned long duracionOriginal = 0;    

String uidActivo = ""; 

// --- FUNCIÓN ENRUTADORA CON VELOCIDADES FIJADAS ---
void aplicarCambioVelocidad() {
  for (int i = 0; i < TOTAL_PIEZAS; i++) {
    if (inventario[i].numeroCarpeta == carpetaActual) {
      
      if (ultimoModo == LOW) {
        // MODO DESCRIPTIVO: Archivo 001.mp3
        archivoActual = 1;
        tiempoEsperaDinamico = inventario[i].cueIdentificacion;
        duracionOriginal = inventario[i].duracionIdentificacion;
      } else {
        // MODO NARRATIVO / INFORMATIVO: Selección secuencial de velocidad
        if (modoVelocidad == 1) {      // LENTO (Archivo 004.mp3 -> -10% Audacity)
          archivoActual = 4;           
          // CORRECCIÓN: Multiplicar por 1.10 para sincronizar de forma precisa el estiramiento del audio
          tiempoEsperaDinamico = inventario[i].cueExtendidaBase * 1.10; 
          duracionOriginal = inventario[i].duracionExtendidaBase * 1.10;
          Serial.println(F("[CONTROL] Cambiado a Lento (004.mp3) -> Factor 1.10"));
        } 
        else if (modoVelocidad == 2) { // NORMAL (Archivo 002.mp3 -> Base)
          archivoActual = 2;           
          tiempoEsperaDinamico = inventario[i].cueExtendidaBase;        
          duracionOriginal = inventario[i].duracionExtendidaBase;
          Serial.println(F("[CONTROL] Cambiado a Normal (002.mp3) -> Base 1.0x"));
        } 
        else if (modoVelocidad == 3) { // RÁPIDO (Archivo 003.mp3 -> +50% Audacity)
          archivoActual = 3;           
          tiempoEsperaDinamico = inventario[i].cueExtendidaBase / 1.50; 
          duracionOriginal = inventario[i].duracionExtendidaBase / 1.50;
          Serial.println(F("[CONTROL] Cambiado a Rápido (003.mp3) -> Ritmo 1.50"));
        }
      }

      miDFPlayer.playFolder(carpetaActual, archivoActual);
      tiempoInicioAudio = millis(); 
      vibracionPendiente = (tiempoEsperaDinamico > 0);
      estaReproduciendo = true;
      break;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println(F("================================================="));
  Serial.println(F("    EMISOR FINAL - CON AUDIOS DE CAMBIO DE MODO  "));
  Serial.println(F("================================================="));

  pinMode(PIN_SWITCH, INPUT_PULLUP);
  pinMode(PIN_PLAY_PAUSE, INPUT_PULLUP);
  pinMode(PIN_STOP, INPUT_PULLUP);
  pinMode(PIN_SPEED_UP, INPUT_PULLUP);
  pinMode(PIN_SPEED_DOWN, INPUT_PULLUP);

  // Forzar estado inicial del interruptor al arrancar
  ultimoModo = digitalRead(PIN_SWITCH);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); 

  if (esp_now_init() != ESP_OK) {
    Serial.println(F("[ERROR] No se pudo inicializar ESP-NOW"));
    return;
  }

  memset(&informacionPar, 0, sizeof(informacionPar));
  memcpy(informacionPar.peer_addr, direccionBroadcast, 6);
  informacionPar.channel = 0;  
  informacionPar.encrypt = false;
  esp_now_add_peer(&informacionPar);

  SPI.begin(18, 19, 23, 5); 
  rfid.PCD_Init();

  puertoDFPlayer.begin(9600, SERIAL_8N1, PIN_RX2, PIN_TX2);
  if (!miDFPlayer.begin(puertoDFPlayer)) {
    Serial.println(F("[ERROR] DFPlayer no detectado. Revisa la MicroSD."));
    while(true); 
  }
  
  miDFPlayer.volume(10); 
  Serial.println(F("[SISTEMA] Listo. Esperando tarjeta NFC..."));
}

void loop() {
  // 1. CONTROL DE VOLUMEN
  int lecturaPot = analogRead(PIN_POT);
  int volumenActual = map(lecturaPot, 0, 4095, 0, 15);
  if (abs(volumenActual - ultimoVolumen) >= 1) {
    ultimoVolumen = volumenActual;
    miDFPlayer.volume(ultimoVolumen);
    delay(10);
  }

  // 2. CONTROL DE MODO (REPRODUCE AUDIO AL CAMBIAR EL SWITCH)
  int modoNFC = digitalRead(PIN_SWITCH);
  if (modoNFC != ultimoModo) {
    ultimoModo = modoNFC;
    
    // Al mover el switch, se limpia el estado multimedia previo para evitar colisiones
    estaReproduciendo = false;
    vibracionPendiente = false; 
    uidActivo = ""; 
    
    if (ultimoModo == LOW) {
      // Cambió a Audio Descriptivo -> Toca Carpeta 99, Archivo 001.mp3
      miDFPlayer.playFolder(99, 1);
      Serial.println(F("[SISTEMA] Modo Descriptivo Seleccionado. Reproduciendo indicador."));
    } else {
      // Cambió a Audio Narrativo -> Toca Carpeta 99, Archivo 002.mp3
      miDFPlayer.playFolder(99, 2);
      Serial.println(F("[SISTEMA] Modo Narrativo Seleccionado. Reproduciendo indicador."));
    }
    delay(100); // Breve pausa de estabilidad para el bus serie del DFPlayer
  }

  // 3. LÓGICA DE BOTONES MULTIMEDIA NO BLOQUEANTES
  bool actPlay = digitalRead(PIN_PLAY_PAUSE);
  if (actPlay == LOW && antPlay == HIGH) {
    delay(20);
    if (digitalRead(PIN_PLAY_PAUSE) == LOW) {
      if (estaReproduciendo) {
        miDFPlayer.pause();
        estaReproduciendo = false;
        Serial.println(F("[BOTÓN] Audio Pausado."));
      } else {
        miDFPlayer.start();
        estaReproduciendo = true;
        tiempoInicioAudio = millis(); 
        Serial.println(F("[BOTÓN] Reanudando audio."));
      }
    }
  }
  antPlay = actPlay;

  bool actStop = digitalRead(PIN_STOP);
  if (actStop == LOW && antStop == HIGH) {
    delay(20);
    if (digitalRead(PIN_STOP) == LOW) {
      miDFPlayer.stop();
      estaReproduciendo = false;
      vibracionPendiente = false; 
      uidActivo = ""; 
      Serial.println(F("[BOTÓN] Reproducción detenida. Lector listo."));
    }
  }
  antStop = actStop;

  bool actSpeedUp = digitalRead(PIN_SPEED_UP);
  if (actSpeedUp == LOW && antSpeedUp == HIGH) {
    delay(20);
    if (digitalRead(PIN_SPEED_UP) == LOW) {
      if (modoVelocidad < 3) { 
        modoVelocidad++;       
        aplicarCambioVelocidad(); 
      }
    }
  }
  antSpeedUp = actSpeedUp;

  bool actSpeedDown = digitalRead(PIN_SPEED_DOWN);
  if (actSpeedDown == LOW && antSpeedDown == HIGH) {
    delay(20);
    if (digitalRead(PIN_SPEED_DOWN) == LOW) {
      if (modoVelocidad > 1) { 
        modoVelocidad--;       
        aplicarCambioVelocidad(); 
      }
    }
  }
  antSpeedDown = actSpeedDown;

  // 4. DETECCIÓN NFC CON FILTRO DE REPETICIÓN
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uidLeido = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      uidLeido += String(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ") + String(rfid.uid.uidByte[i], HEX);
    }
    uidLeido.trim();
    uidLeido.toUpperCase();

    if (uidLeido == uidActivo && estaReproduciendo) {
      rfid.PICC_HaltA();
    } 
    else {
      Serial.print(F("\n[NFC] Tarjeta Detectada: "));
      Serial.println(uidLeido);

      for (int i = 0; i < TOTAL_PIEZAS; i++) {
        if (inventario[i].uidHex == uidLeido) {
          uidActivo = uidLeido; 
          
          // PULSO CORTO DE CONFIRMACIÓN INMEDIATA (500 ms)
          EstructuraDatos datosConfirmacion;
          datosConfirmacion.tipoVibracion = 1; 
          datosConfirmacion.duracionVibracion = 500; 
          esp_now_send(direccionBroadcast, (uint8_t *) &datosConfirmacion, sizeof(datosConfirmacion));
          
          carpetaActual = inventario[i].numeroCarpeta;
          estaReproduciendo = true;
          aplicarCambioVelocidad();
          break;
        }
      }
      rfid.PICC_HaltA();
    }
  }

  // 5. CONTROL Y DISPARO DE VIBRACIÓN MULTIMEDIA CRONOMETRADA (ESP-NOW)
  if (vibracionPendiente && estaReproduciendo) {
    if (millis() - tiempoInicioAudio >= tiempoEsperaDinamico) {
      misDatos.tipoVibracion = (ultimoModo == LOW) ? 1 : 2;
      misDatos.duracionVibracion = duracionOriginal;

      Serial.print(F("[ESP-NOW] Enviando vibración programada: "));
      Serial.print(misDatos.duracionVibracion);
      Serial.println(F(" ms"));
      
      esp_now_send(direccionBroadcast, (uint8_t *) &misDatos, sizeof(misDatos));
      vibracionPendiente = false; 
    }
  }
}