const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class GeminiService {
  constructor() {
    this.defaultApiKey = process.env.GEMINI_API_KEY;
  }

  /**
   * Obtiene el movimiento de la IA basado en el estado actual del tablero
   * @param {Board} board - El objeto tablero actual
   * @param {string} apiKey - La API key proporcionada por el usuario
   * @returns {Promise<{fromRow: number, fromCol: number, toRow: number, toCol: number}>} - Coordenadas del movimiento
   */
  async getAIMove(board, apiKey) {
    try {
      const key = apiKey || this.defaultApiKey;
      
      if (!key) {
        throw new Error('No se proporcionó una API key válida');
      }
      
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      
      const boardString = board.toBoardString();
      const prompt = `
      Estás jugando a las damas contra un humano. Tú controlas las fichas negras (valores 2 y 4).
      El tablero actual es (0: vacío, 1: blancas del humano, 2: negras tuyas, 3: dama blanca del humano, 4: dama negra tuya):
      
      ${boardString}
      
      Reglas detalladas:
      - Las piezas solo pueden moverse en diagonal.
      - Las piezas normales (2) solo pueden moverse hacia adelante (filas decrecientes).
      - Las damas (4) pueden moverse en cualquier diagonal, hacia adelante o hacia atrás.
      - Se pueden capturar piezas saltando sobre ellas a una casilla vacía.
      - Si hay más de una captura posible, puedes elegir cualquiera.
      - Las capturas múltiples están permitidas si son posibles.
      - Una pieza normal se convierte en dama al llegar a la fila 0.
      
      Estrategia sugerida:
      1. Prioriza capturar piezas del oponente cuando sea posible.
      2. Protege tus propias piezas, especialmente las damas.
      3. Trata de avanzar hacia la línea del oponente para conseguir damas.
      4. Controla el centro del tablero cuando sea posible.
      5. Evita dejar tus piezas expuestas a capturas.
      
      Analiza cuidadosamente el tablero y proporciona tu mejor movimiento para las negras.
      Responde SOLO con el formato: "fromRow,fromCol:toRow,toCol"
      Por ejemplo: "5,2:4,3" para mover desde la fila 5, columna 2 a la fila 4, columna 3.
      NO expliques tu razonamiento, solo proporciona las coordenadas.`;

      // *** DEBUG: Log del prompt enviado a Gemini ***
      console.log('\n--- Prompt Enviado a Gemini ---');
      console.log(prompt);
      console.log('-----------------------------\n');

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // *** DEBUG: Log de la respuesta cruda de Gemini ***
      console.log('\n--- Respuesta Cruda de Gemini ---');
      console.log(`"${responseText}"`);
      console.log('------------------------------\n');
      
      // Parsear la respuesta
      const parts = responseText.split(':');
      if (parts.length !== 2) {
        console.error(`Error de formato: Se esperaba ':', se recibió: "${responseText}"`);
        throw new Error('Formato de respuesta de Gemini inválido (no contiene ":")');
      }

      const [from, to] = parts;
      const fromCoords = from.split(',');
      const toCoords = to.split(',');

      if (fromCoords.length !== 2 || toCoords.length !== 2) {
        console.error(`Error de formato: Coordenadas inválidas en "${responseText}"`);
        throw new Error('Formato de respuesta de Gemini inválido (coordenadas incorrectas)');
      }
      
      const fromRow = parseInt(fromCoords[0], 10);
      const fromCol = parseInt(fromCoords[1], 10);
      const toRow = parseInt(toCoords[0], 10);
      const toCol = parseInt(toCoords[1], 10);
      
      if (isNaN(fromRow) || isNaN(fromCol) || isNaN(toRow) || isNaN(toCol)) {
        console.error(`Error de parseo: Coordenadas no numéricas en "${responseText}"`);
        throw new Error('Coordenadas inválidas de Gemini (no son números)');
      }
      
      console.log(`Movimiento parseado de Gemini: ${fromRow},${fromCol} -> ${toRow},${toCol}`);
      return { fromRow, fromCol, toRow, toCol };

    } catch (error) {
      // Proporcionar un error más específico si es posible
      console.error('Error detallado al obtener movimiento de la IA:', error);
      const errorMessage = error.message || 'Error desconocido en GeminiService';
      // Añadir detalles del error de la API si existen (ej. safety ratings)
      if (error.response && error.response.promptFeedback) {
        console.error('Prompt Feedback:', JSON.stringify(error.response.promptFeedback));
        throw new Error(`Error de Gemini: ${errorMessage}. Feedback: ${JSON.stringify(error.response.promptFeedback)}`);
      } else {
        throw new Error(`Error de Gemini: ${errorMessage}`);
      }
    }
  }
}

module.exports = new GeminiService();