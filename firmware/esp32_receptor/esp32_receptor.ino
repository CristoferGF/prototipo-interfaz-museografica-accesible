#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <ESP32Servo.h>

// --- CONFIGURACIÓN DE PINES ---
constexpr int PIN_SERVO = 13; // GPIO donde está conectado el motor de vibración

// --- INSTANCIAS ---
Servo servoVibrador;

// --- ESTRUCTURA DE DATOS UNIFICADA ---
struct __attribute__((packed)) EstructuraDatos {
  int tipoVibracion; 
  unsigned long duracionVibracion; // Recibe el tiempo exacto recalculado por el emisor
};
EstructuraDatos datosRecibidos;

// --- FUNCIÓN DE RECEPCIÓN (CALLBACK) ---
void alRecibirDatos(const esp_now_recv_info_t *recvInfo, const uint8_t *datosEntrantes, int longitud) {
  // Filtro de seguridad anti-ruido ambiental
  if (longitud != sizeof(EstructuraDatos)) {
    return; 
  }

  // Desempaquetado seguro de los datos recibidos por el aire
  memcpy(&datosRecibidos, datosEntrantes, sizeof(datosRecibidos));
  
  Serial.print(F("[ESP-NOW] Datos recibidos. Tipo: "));
  Serial.print(datosRecibidos.tipoVibracion);
  Serial.print(F(" | Duración: "));
  Serial.print(datosRecibidos.duracionVibracion);
  Serial.println(F(" ms"));

  // VINCULACIÓN DINÁMICA: Activamos el pin del servo solo en este instante
  servoVibrador.attach(PIN_SERVO, 500, 2400);
  delay(15); 

  // --- EJECUCIÓN DE PATRONES CON TIEMPO DINÁMICO ---
  if (datosRecibidos.tipoVibracion == 1) {
    // Procesa la confirmación instantánea del NFC (500ms) y el Modo Descriptivo
    Serial.println(F("[HÁPTICO] Activando Vibración Continua..."));
    servoVibrador.write(180);
    delay(datosRecibidos.duracionVibracion); 
    servoVibrador.write(0);
  } 
  else if (datosRecibidos.tipoVibracion == 2) {
    // Procesa las ráfagas del contenido multimedia (Vuelo)
    Serial.println(F("[HÁPTICO] Activando Ráfaga de Vuelo (Informativo)..."));
    unsigned long bloqueTiempo = datosRecibidos.duracionVibracion / 2;
    
    for (int i = 0; i < 2; i++) {
      servoVibrador.write(180);
      delay(bloqueTiempo * 0.6); // 60% del bloque encendido
      servoVibrador.write(0);
      delay(bloqueTiempo * 0.4); // 40% del bloque apagado
    }
  }

  // DESVINCULACIÓN CRÍTICA: Apagamos el pin para regresar al aislamiento total
  servoVibrador.detach();
  
  // Forzar apagado digital para evitar vibraciones residuales por corrientes parásitas
  pinMode(PIN_SERVO, OUTPUT);
  digitalWrite(PIN_SERVO, LOW);
  
  Serial.println(F("[SISTEMA] Motor liberado. Estado inactivo absoluto.\n"));
}

void setup() {
  // --- TRUCO DE ESTABILIZACIÓN ---
  // Le da 1.5 segundos al ESP32 para acomodar el voltaje de 6V antes de encender el motor
  delay(1500); 

  Serial.begin(115200);
  Serial.println(F("================================================="));
  Serial.println(F("    RECEPTOR ESTABLE - VIBRACIÓN DE ENCENDIDO    "));
  Serial.println(F("================================================="));

  // --- VIBRACIÓN DE ENCENDIDO (SOLO CORRERÁ UNA VEZ AL DAR CORRIENTE) ---
  Serial.println(F("[SISTEMA] Alerta de energía activa..."));
  servoVibrador.attach(PIN_SERVO, 500, 2400);
  delay(15);
  servoVibrador.write(180);
  delay(400); // Vibra por 400 ms firmes y se detiene
  servoVibrador.write(0);
  servoVibrador.detach();
  
  // Forzar el apagado del pin inmediatamente
  pinMode(PIN_SERVO, OUTPUT);
  digitalWrite(PIN_SERVO, LOW);
  Serial.println(F("[SISTEMA] Alerta finalizada. Entrando en modo pasivo."));

  // Configuración de red inalámbrica pasiva
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); 

  // Inicializar protocolo inalámbrico
  if (esp_now_init() != ESP_OK) {
    Serial.println(F("[ERROR] No se pudo inicializar ESP-NOW"));
    return;
  }

  // Registro directo del callback de recepción
  esp_now_register_recv_cb(alRecibirDatos);
  
  Serial.println(F("[OK] Receptor listo y estabilizado. Esperando al emisor..."));
}

void loop() {
  delay(10);
}