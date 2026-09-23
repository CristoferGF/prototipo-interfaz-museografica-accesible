#ifndef CONFIG_RECEPTOR_H
#define CONFIG_RECEPTOR_H

#include <Arduino.h>

// ==========================================
// ASIGNACIÓN DE PINES (GPIO)
// ==========================================
constexpr int PIN_SERVO = 13; // Señal PWM hacia actuador/driver de vibración

// ==========================================
// CALIBRACIÓN DEL ACTUADOR HÁPTICO
// ==========================================
constexpr int SERVO_PULSE_MIN = 500;  // Ancho mínimo de pulso (µs)
constexpr int SERVO_PULSE_MAX = 2400; // Ancho máximo de pulso (µs)
constexpr int SERVO_VALOR_ON  = 180;  // Estado de activación máxima
constexpr int SERVO_VALOR_OFF = 0;    // Reposo

constexpr int DURACION_BOOT_FEEDBACK_MS = 400; // Pulso háptico de arranque
constexpr int TIEMPO_ESTABILIZACION_MS  = 1500; // Retardo post-alimentación

// ==========================================
// ESTRUCTURA DE COMUNICACIÓN ESP-NOW
// ==========================================
struct __attribute__((packed)) EstructuraDatos {
  int tipoVibracion;              // 1: Continuo, 2: Ráfaga
  unsigned long duracionVibracion; // Tiempo total en ms
};

#endif // CONFIG_RECEPTOR_H