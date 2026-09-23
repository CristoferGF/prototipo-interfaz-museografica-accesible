#ifndef CONFIG_EMISOR_H
#define CONFIG_EMISOR_H

#include <Arduino.h>

// ==========================================
// ASIGNACIÓN DE PINES (GPIO)
// ==========================================
constexpr int PIN_RX2        = 16; // UART2 RX hacia TX del DFPlayer
constexpr int PIN_TX2        = 17; // UART2 TX hacia RX del DFPlayer
constexpr int PIN_SDA        = 5;  // SPI SS / SDA (Lector RC522)
constexpr int PIN_RST        = 22; // Reset (Lector RC522)
constexpr int PIN_SPI_SCK    = 18; // SPI SCK
constexpr int PIN_SPI_MISO   = 19; // SPI MISO
constexpr int PIN_SPI_MOSI   = 23; // SPI MOSI

constexpr int PIN_POT        = 34; // Entrada analógica ADC (Potenciómetro)
constexpr int PIN_SWITCH     = 32; // Interruptor Selector de Modo (Descriptivo / Informativo)

constexpr int PIN_PLAY_PAUSE = 33; // Botón 1: Play / Pausa
constexpr int PIN_STOP       = 25; // Botón 2: Stop
constexpr int PIN_SPEED_UP   = 26; // Botón 3: Aumentar Velocidad
constexpr int PIN_SPEED_DOWN = 27; // Botón 4: Disminuir Velocidad

// ==========================================
// PARÁMETROS DEL SISTEMA Y AUDIO
// ==========================================
constexpr int DEBOUNCE_DELAY_MS = 20;
constexpr int VOLUMEN_MAX       = 15;
constexpr int CARPETA_SISTEMA   = 99; // Mensajes sonoros de cambio de modo

// Constantes de velocidad (Pistas en microSD)
constexpr int PISTA_DESCRIPTIVA    = 1; // 001.mp3
constexpr int PISTA_INFO_NORMAL    = 2; // 002.mp3 (1.0x)
constexpr int PISTA_INFO_RAPIDA    = 3; // 003.mp3 (+50% Audacity)
constexpr int PISTA_INFO_LENTA     = 4; // 004.mp3 (-10% Audacity)

constexpr float FACTOR_VEL_LENTA   = 1.10f;
constexpr float FACTOR_VEL_RAPIDA  = 1.50f;

// ==========================================
// COMUNICACIÓN INALÁMBRICA ESP-NOW
// ==========================================
const uint8_t DIRECCION_BROADCAST[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

struct __attribute__((packed)) EstructuraDatos {
  int tipoVibracion;              // 1: Continuo (Confirmación / Descriptivo), 2: Ráfaga
  unsigned long duracionVibracion; // Milisegundos recalculados
};

// ==========================================
// ESTRUCTURA DE LA BASE DE DATOS LOCAL
// ==========================================
struct PiezaMuseo {
  String uidHex;
  int numeroCarpeta;
  unsigned long cueIdentificacion;
  unsigned long duracionIdentificacion;
  unsigned long cueExtendidaBase;
  unsigned long duracionExtendidaBase;
};

#endif // CONFIG_EMISOR_H