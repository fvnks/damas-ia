# Damas vs Gemini

Un juego de damas en el que puedes jugar contra la IA de Google Gemini.

## Características

- Juego de damas completo con todas las reglas estándar
- Interfaz web responsiva
- La IA utiliza el modelo Gemini 1.5 Pro para analizar y realizar movimientos
- Comunicación en tiempo real mediante Socket.IO

## Requisitos

- Node.js (v14 o superior)
- Una clave API de Google Gemini

## Instalación

1. Clona este repositorio:
   ```
   git clone https://github.com/tuusuario/checkers-gemini.git
   cd checkers-gemini
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto y añade tu clave API de Gemini:
   ```
   PORT=3000
   GEMINI_API_KEY=tu_clave_api_aquí
   ```

## Uso

1. Inicia el servidor:
   ```
   npm start
   ```

2. Abre tu navegador y ve a `http://localhost:3000`

3. Haz clic en "Nuevo Juego" para comenzar una partida

4. Para mover una pieza:
   - Haz clic en la pieza que quieres mover
   - Los movimientos válidos se mostrarán en el tablero
   - Haz clic en una de las posiciones válidas para realizar el movimiento

5. Después de tu movimiento, Gemini analizará el tablero y realizará su jugada

## Reglas del juego

- Las piezas solo pueden moverse en diagonal
- Las piezas normales solo pueden moverse hacia adelante
- Las damas pueden moverse en cualquier diagonal
- Las piezas se capturan saltando sobre ellas a una casilla vacía
- Si es posible capturar, debes hacerlo
- Al llegar al extremo opuesto, la pieza se convierte en dama

## Cómo funciona la IA

La IA utiliza el modelo Gemini 1.5 Pro para analizar el estado actual del tablero y determinar el mejor movimiento. Se le proporciona el estado del tablero y las reglas básicas, y debe responder con las coordenadas de su próximo movimiento.

Si Gemini devuelve un movimiento inválido o si hay algún error en la comunicación con la API, el sistema realizará un movimiento aleatorio válido.

## Personalización

Puedes modificar el comportamiento de la IA editando el prompt en `src/services/GeminiService.js`. Ajustando las instrucciones, podrías hacer que Gemini juegue de forma más agresiva, defensiva o que priorice ciertos tipos de movimientos.

## Licencia

MIT 