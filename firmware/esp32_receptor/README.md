# Firmware Nodo Receptor Háptico (ESP32 Receptor)

Nodo inalámbrico embebido dentro de la réplica háptica. Recibe los comandos sincronizados transmitidos por el controlador central vía ESP-NOW y traduce las órdenes en patrones de vibración mediante modulación PWM.

## Conexión de Pines

| Componente | Señal | Pin ESP32 (GPIO) | Notas |
|---|---|---|---|
| **Driver / Actuador Háptico** | PWM / Control | GPIO 13 | Controlado vía librería `ESP32Servo` |

## Patrones de Respuesta Táctil

* **Alimentación y Arranque:** Tras 1.5 segundos de estabilización de la fuente de alimentación, genera un pulso táctil inicial de 400 ms que valida el correcto estado operativo del receptor.
* **Tipo 1 (Vibración Continua):** Empleado para confirmación inmediata de lectura de etiqueta NFC y para hitos descriptivos.
* **Tipo 2 (Vibración en Ráfaga):** Segmenta la duración total recibida en dos ciclos (60% activo / 40% inactivo por ciclo), utilizado durante la narración sonora de eventos dinámicos.

## Mitigación de Ruido y Falsas Activaciones

Para prevenir corrientes parásitas y vibraciones involuntarias causadas por fluctuaciones en el bus PWM:
1. El actuador se vincula dinámicamente (`attach()`) únicamente en el instante en que se procesa una orden válida.
2. Finalizada la rutina de vibración, el periférico se desvincula inmediatamente (`detach()`).
3. El pin GPIO 13 es forzado por software a nivel lógico bajo (`digitalWrite(PIN_SERVO, LOW)`) en estado de reposo.