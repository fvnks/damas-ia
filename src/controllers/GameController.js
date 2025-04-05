const Board = require('../models/Board');
const GeminiService = require('../services/GeminiService');

class GameController {
  constructor() {
    this.games = new Map(); // Almacena las partidas activas por ID de sesión
    this.userApiKeys = new Map(); // Almacena las API keys de los usuarios por ID de sesión
    this.maxRetries = 3;    // Número máximo de intentos para obtener un movimiento válido de la IA
  }

  // Inicia un nuevo juego
  createGame(sessionId, apiKey) {
    const board = new Board();
    this.games.set(sessionId, board);
    
    // Guardar la API key del usuario
    if (apiKey) {
      this.userApiKeys.set(sessionId, apiKey);
    }
    
    return {
      board: board.getBoard(),
      currentPlayer: board.currentPlayer,
      gameOver: false,
      winner: 0
    };
  }

  // Obtiene el estado actual del juego
  getGameState(sessionId) {
    const board = this.games.get(sessionId);
    if (!board) {
      return null;
    }

    return {
      board: board.getBoard(),
      currentPlayer: board.currentPlayer,
      gameOver: board.isGameOver(),
      winner: board.getWinner()
    };
  }

  // Verifica si hay capturas obligatorias para un jugador
  getRequiredCaptures(board, player) {
    const captures = [];
    const size = board.size;
    
    // Recorrer el tablero buscando piezas del jugador
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const piece = board.board[row][col];
        
        // Verificar si la pieza pertenece al jugador
        if ((player === 1 && (piece === 1 || piece === 3)) || 
            (player === 2 && (piece === 2 || piece === 4))) {
          
          const isKing = (piece === 3 || piece === 4);
          
          // Verificar las cuatro direcciones diagonales
          const directions = [
            { rowDiff: -1, colDiff: -1 }, // Arriba-izquierda
            { rowDiff: -1, colDiff: 1 },  // Arriba-derecha
            { rowDiff: 1, colDiff: -1 },  // Abajo-izquierda
            { rowDiff: 1, colDiff: 1 }    // Abajo-derecha
          ];
          
          // Para piezas normales, solo considerar las direcciones permitidas
          const allowedDirections = isKing ? directions : 
            (player === 1 ? directions.filter(dir => dir.rowDiff < 0) : 
                           directions.filter(dir => dir.rowDiff > 0));
          
          // Verificar cada dirección
          for (const dir of allowedDirections) {
            const captureRow = row + dir.rowDiff;
            const captureCol = col + dir.colDiff;
            const landRow = captureRow + dir.rowDiff;
            const landCol = captureCol + dir.colDiff;
            
            // Verificar que las posiciones estén dentro del tablero
            if (board.isValidPosition(captureRow, captureCol) && 
                board.isValidPosition(landRow, landCol)) {
              const captureCell = board.board[captureRow][captureCol];
              const landCell = board.board[landRow][landCol];
              
              // Verificar si hay una pieza enemiga para capturar y un espacio vacío para aterrizar
              if (landCell === 0 && (
                  (player === 1 && (captureCell === 2 || captureCell === 4)) ||
                  (player === 2 && (captureCell === 1 || captureCell === 3))
                 )) {
                captures.push({
                  fromRow: row,
                  fromCol: col,
                  toRow: landRow,
                  toCol: landCol
                });
              }
            }
          }
        }
      }
    }
    
    return captures;
  }

  // Realiza un movimiento del jugador
  playerMove(sessionId, fromRow, fromCol, toRow, toCol) {
    const board = this.games.get(sessionId);
    if (!board) {
      return { error: 'Juego no encontrado' };
    }

    if (board.currentPlayer !== 1) {
      return { error: 'No es tu turno' };
    }

    if (board.isGameOver()) {
      return { error: 'El juego ha terminado' };
    }

    // Verificar si hay capturas obligatorias
    const requiredCaptures = this.getRequiredCaptures(board, 1);
    
    if (requiredCaptures.length > 0) {
      // Verificar si el movimiento es una de las capturas requeridas
      const isValidCapture = requiredCaptures.some(
        capture => capture.fromRow === fromRow && 
                  capture.fromCol === fromCol && 
                  capture.toRow === toRow && 
                  capture.toCol === toCol
      );
      
      if (!isValidCapture) {
        return { 
          error: 'Hay capturas obligatorias disponibles',
          captures: requiredCaptures 
        };
      }
    }

    const moveResult = board.makeMove(fromRow, fromCol, toRow, toCol);
    if (!moveResult) {
      return { error: 'Movimiento inválido' };
    }

    return {
      board: board.getBoard(),
      currentPlayer: board.currentPlayer,
      gameOver: board.isGameOver(),
      winner: board.getWinner()
    };
  }

  // Obtiene y ejecuta el movimiento de la IA
  async aiMove(sessionId, apiKey) {
    const board = this.games.get(sessionId);
    if (!board) {
      return { error: 'Juego no encontrado' };
    }

    if (board.currentPlayer !== 2) {
      return { error: 'No es el turno de la IA' };
    }

    if (board.isGameOver()) {
      return { error: 'El juego ha terminado' };
    }

    // Usar la API key proporcionada o la almacenada para este sessionId
    const userApiKey = apiKey || this.userApiKeys.get(sessionId);
    if (!userApiKey) {
      return { error: 'API_KEY_REQUIRED', message: 'Se requiere una API key para el movimiento de la IA' };
    }

    try {
      // Verificar si hay capturas obligatorias
      const requiredCaptures = this.getRequiredCaptures(board, 2);
      let move = null;
      let moveResult = false;
      let retries = 0;
      
      while (!moveResult && retries < this.maxRetries) {
        // Si hay capturas obligatorias, elegir una al azar
        if (requiredCaptures.length > 0 && retries > 0) {
          const randomIndex = Math.floor(Math.random() * requiredCaptures.length);
          move = requiredCaptures[randomIndex];
        } else {
          // Intentar obtener un movimiento de Gemini con la API key del usuario
          move = await GeminiService.getAIMove(board, userApiKey);
        }
        
        // Ejecutar el movimiento
        moveResult = board.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
        retries++;
      }
      
      // Si todos los intentos fallan, hacer un movimiento aleatorio válido
      if (!moveResult) {
        console.log('Todos los intentos de movimiento de IA fallaron, intentando con un movimiento aleatorio');
        this.makeRandomAIMove(board);
      }

      return {
        board: board.getBoard(),
        currentPlayer: board.currentPlayer,
        gameOver: board.isGameOver(),
        winner: board.getWinner(),
        aiMove: move
      };
    } catch (error) {
      console.error('Error en el movimiento de la IA:', error);
      return { error: 'AI_ERROR', message: error.message || 'Error al obtener movimiento de la IA' };
    }
  }

  // Realiza un movimiento aleatorio para la IA en caso de error
  makeRandomAIMove(board) {
    // Verificar si hay capturas obligatorias
    const requiredCaptures = this.getRequiredCaptures(board, 2);
    
    if (requiredCaptures.length > 0) {
      // Hacer una captura obligatoria aleatoria
      const randomCapture = requiredCaptures[Math.floor(Math.random() * requiredCaptures.length)];
      board.makeMove(
        randomCapture.fromRow, 
        randomCapture.fromCol, 
        randomCapture.toRow, 
        randomCapture.toCol
      );
      return;
    }
    
    const validMoves = [];
    
    // Buscar todas las fichas de la IA
    for (let row = 0; row < board.size; row++) {
      for (let col = 0; col < board.size; col++) {
        const piece = board.board[row][col];
        if (piece === 2 || piece === 4) {
          // Probar movimientos simples
          const directions = [
            { rowDiff: -1, colDiff: -1 },
            { rowDiff: -1, colDiff: 1 },
            { rowDiff: 1, colDiff: -1 },
            { rowDiff: 1, colDiff: 1 }
          ];
          
          // Para piezas normales, solo considerar movimientos hacia adelante (filas decrecientes)
          const allowedDirections = piece === 4 ? directions : directions.filter(dir => dir.rowDiff < 0);
          
          // Verificar movimientos simples
          for (const dir of allowedDirections) {
            // Movimiento simple
            let toRow = row + dir.rowDiff;
            let toCol = col + dir.colDiff;
            if (board.isValidMove(row, col, toRow, toCol)) {
              validMoves.push({ fromRow: row, fromCol: col, toRow, toCol });
            }
          }
        }
      }
    }
    
    // Si hay movimientos válidos, hacer uno aleatorio
    if (validMoves.length > 0) {
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      board.makeMove(randomMove.fromRow, randomMove.fromCol, randomMove.toRow, randomMove.toCol);
    } else {
      // No hay movimientos válidos, el jugador gana automáticamente
      board.aiPieces = 0;
    }
  }
}

module.exports = new GameController(); 