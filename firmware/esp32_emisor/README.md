# Firmware Controlador Central (ESP32 Emisor)

Nodo emisor integrado en el controlador táctil portátil del sistema de mediación museográfica accesible. Gestiona la lectura NFC, procesamiento de entradas de usuario, reproducción de pistas de audio descriptivas e informativas, y sincronización inalámbrica mediante ESP-NOW.

## Periféricos y Asignación de Pines

| Componente | Función / Señal | Pin ESP32 (GPIO) | Configuración |
|---|---|---|---|
| **RC522 (RFID/NFC)** | SDA / SS | GPIO 5 | Bus SPI |
| | SCK | GPIO 18 | Bus SPI |
| | MOSI | GPIO 23 | Bus SPI |
| | MISO | GPIO 19 | Bus SPI |
| | RST | GPIO 22 | Reset digital |
| **DFPlayer Mini** | RX2 (a TX del DFPlayer) | GPIO 16 | HardwareSerial 2 (9600 baud) |
| | TX2 (a RX del DFPlayer) | GPIO 17 | HardwareSerial 2 (9600 baud) |
| **Botonera** | Play / Pause | GPIO 33 | `INPUT_PULLUP` |
| | Stop | GPIO 25 | `INPUT_PULLUP` |
| | Subir velocidad | GPIO 26 | `INPUT_PULLUP` |
| | Bajar velocidad | GPIO 27 | `INPUT_PULLUP` |
| **Controles de Modo** | Switch (Descriptivo / Info) | GPIO 32 | `INPUT_PULLUP` |
| | Potenciómetro (Volumen) | GPIO 34 | Entrada Analógica ADC |

## Lógica Operativa

1. **Lectura NFC:** Al aproximar una pieza a la base del controlador, el MFRC522 recupera el UID. Si coincide con el inventario, transmite un paquete ESP-NOW inmediato de 500 ms de vibración continua (`tipoVibracion = 1`) como retroalimentación táctil de confirmación.
2. **Selección de Pista:**
   * **Modo Descriptivo (`LOW`):** Ejecuta la pista `001.mp3` de la carpeta asociada.
   * **Modo Narrativo/Informativo (`HIGH`):** Ejecuta la pista según el selector de velocidad: `004.mp3` (Lento), `002.mp3` (Normal) o `003.mp3` (Rápido).
3. **Sincronización Háptica:** Monitorea la reproducción mediante `millis()`. Al cumplirse el instante (`cueExtendidaBase`), envía por difusión (*broadcast*) la trama con la duración ajustada según el factor de velocidad seleccionado.