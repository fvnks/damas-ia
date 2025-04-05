# Damas vs Gemini

Un juego de damas en 3D en el que puedes jugar contra la IA de Google Gemini.

## Características

- Juego de damas completo con todas las reglas estándar
- Interfaz web interactiva en 3D con rotación del tablero
- La IA utiliza el modelo Gemini 1.5 Flash para analizar y realizar movimientos
- Comunicación en tiempo real mediante Socket.IO
- Soporte para arrastrar y soltar piezas o seleccionar con clics
- Retroalimentación visual para movimientos válidos e inválidos

## Requisitos

- Node.js (v14 o superior)
- Una clave API de Google Gemini

## Instalación

1. Clona este repositorio:
   ```
   git clone https://github.com/fvnks/damas-ia.git
   cd damas-ia/checkers-gemini
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto y añade tu clave API de Gemini (opcional, también puedes ingresarla en la interfaz):
   ```
   PORT=3000
   GEMINI_API_KEY=tu_clave_api_aquí
   ```

## Uso

1. Inicia el servidor:
   ```
   node src/index.js
   ```

2. Abre tu navegador y ve a `http://localhost:3000`

3. Si no has configurado la API KEY en el archivo `.env`, se te pedirá que ingreses tu clave API de Google Gemini en la interfaz.

4. Haz clic en "Nuevo Juego" para comenzar una partida

5. Para mover una pieza:
   - Opción 1: Haz clic en la pieza que quieres mover, los movimientos válidos se mostrarán en el tablero, y luego haz clic en una de las posiciones válidas.
   - Opción 2: Arrastra y suelta la pieza en una posición válida.

6. Después de tu movimiento, Gemini analizará el tablero y realizará su jugada

7. Puedes usar los controles encima del tablero para:
   - Rotar el tablero en 3D
   - Cambiar la perspectiva
   - Volver a la vista predeterminada

## Reglas del juego

- Las piezas solo pueden moverse en diagonal y únicamente sobre las casillas negras
- Las piezas normales solo pueden moverse hacia adelante
- Las damas pueden moverse en cualquier diagonal (adelante y atrás)
- Las piezas se capturan saltando sobre ellas a una casilla vacía
- Si es posible capturar, debes hacerlo (captura obligatoria)
- Al llegar al extremo opuesto, la pieza se convierte en dama (coronación)

## Cómo funciona la IA

La IA utiliza el modelo Gemini 1.5 Flash para analizar el estado actual del tablero y determinar el mejor movimiento. Este modelo tiene un límite de uso más generoso en la API gratuita (aproximadamente 60 RPM comparado con 2 RPM del modelo Pro).

Si experimentas errores 429 (Too Many Requests), significa que has excedido el límite de solicitudes por minuto. Solo necesitas esperar un momento antes de intentarlo nuevamente.

## Personalización

Puedes modificar el comportamiento de la IA editando el prompt en `src/services/GeminiService.js`. Ajustando las instrucciones, podrías hacer que Gemini juegue de forma más agresiva, defensiva o que priorice ciertos tipos de movimientos.

## Solución de problemas

- **Error 429 (Too Many Requests)**: El límite gratuito de la API de Gemini es de aproximadamente 60 solicitudes por minuto para el modelo Flash. Si recibes este error, espera un minuto antes de realizar más movimientos.
- **Movimientos no válidos**: Si el juego marca todos los movimientos como inválidos, verifica que estés intentando mover tus propias piezas (blancas) y no las del oponente.
- **La IA no responde**: Verifica que tu clave API de Gemini sea válida y que tengas una conexión a internet estable.

## Licencia

MIT 