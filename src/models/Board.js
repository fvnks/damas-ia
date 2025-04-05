/**
 * Representación del tablero de damas
 * 0: casilla vacía
 * 1: ficha del jugador (blanca)
 * 2: ficha de la IA (negra)
 * 3: dama del jugador (blanca)
 * 4: dama de la IA (negra)
 */
class Board {
  constructor() {
    this.size = 8;
    this.board = this.initializeBoard();
    this.currentPlayer = 1; // 1: jugador, 2: IA
    this.playerPieces = 12;
    this.aiPieces = 12;
  }

  initializeBoard() {
    const board = Array(this.size).fill(0).map(() => Array(this.size).fill(0));

    // Colocar fichas
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        // Solo colocar en casillas negras (donde row + col es impar)
        if ((row + col) % 2 !== 0) {
          // Fichas del jugador (blancas) en las primeras 3 filas
          if (row < 3) {
            board[row][col] = 1;
          }
          // Fichas de la IA (negras) en las últimas 3 filas
          else if (row >= this.size - 3) {
            board[row][col] = 2;
          }
          // El resto de casillas negras quedan vacías (0)
        }
        // Las casillas blancas (row + col es par) siempre quedan vacías (0)
      }
    }
    return board;
  }

  // Devuelve una copia del tablero actual
  getBoard() {
    return JSON.parse(JSON.stringify(this.board));
  }

  // Verifica si una posición está dentro del tablero
  isValidPosition(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  // Verifica si un movimiento es válido
  isValidMove(fromRow, fromCol, toRow, toCol) {
    // Verificar que las posiciones estén dentro del tablero
    if (!this.isValidPosition(fromRow, fromCol) || !this.isValidPosition(toRow, toCol)) {
      return false;
    }

    // Verificar que la casilla destino esté vacía
    if (this.board[toRow][toCol] !== 0) {
      return false;
    }

    // Verificar que origen y destino sean casillas negras
    if ((fromRow + fromCol) % 2 === 0 || (toRow + toCol) % 2 === 0) {
      return false;
    }

    const piece = this.board[fromRow][fromCol];
    
    // Verificar que la pieza exista en el origen
    if (piece === 0) {
      return false;
    }

    // Verificar que la pieza pertenezca al jugador actual
    if (this.currentPlayer === 1 && piece !== 1 && piece !== 3) {
      return false;
    }
    if (this.currentPlayer === 2 && piece !== 2 && piece !== 4) {
      return false;
    }

    // Verificar si es un movimiento o una captura
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    // Verificar si es una dama
    const isKing = piece === 3 || piece === 4;

    // Movimiento simple (diagonal de 1 casilla)
    if (absRowDiff === 1 && absColDiff === 1) {
      // Las piezas normales solo pueden moverse hacia adelante
      if (!isKing) {
        // Para el jugador 1 (blancas), "adelante" significa rowDiff > 0
        if (this.currentPlayer === 1 && rowDiff < 0) return false;
        // Para la IA (piezas negras), "adelante" significa rowDiff < 0
        if (this.currentPlayer === 2 && rowDiff > 0) return false;
      }
      return true;
    }

    // Captura (diagonal de 2 casillas)
    if (absRowDiff === 2 && absColDiff === 2) {
      // Calcular la posición de la pieza a capturar
      const captureRow = fromRow + rowDiff / 2;
      const captureCol = fromCol + colDiff / 2;
      const capturedPiece = this.board[captureRow][captureCol];

      // Las piezas normales solo pueden capturar hacia adelante
      if (!isKing) {
        // Para el jugador 1 (blancas), "adelante" significa rowDiff > 0
        if (this.currentPlayer === 1 && rowDiff < 0) return false;
        // Para la IA (piezas negras), "adelante" significa rowDiff < 0
        if (this.currentPlayer === 2 && rowDiff > 0) return false;
      }

      // Verificar que haya una pieza enemiga en la casilla intermedia
      if (this.currentPlayer === 1 && (capturedPiece === 2 || capturedPiece === 4)) {
        return true;
      }
      if (this.currentPlayer === 2 && (capturedPiece === 1 || capturedPiece === 3)) {
        return true;
      }
    }

    return false;
  }

  // Realiza un movimiento y actualiza el estado del tablero
  makeMove(fromRow, fromCol, toRow, toCol) {
    // Revalidar el movimiento aquí para máxima seguridad
    if (!this.isValidMove(fromRow, fromCol, toRow, toCol)) {
      console.error(`[SERVER ERROR] Intento de realizar movimiento inválido: ${fromRow},${fromCol} -> ${toRow},${toCol}`);
      return false;
    }

    const piece = this.board[fromRow][fromCol];
    this.board[fromRow][fromCol] = 0;

    // Verificar si es una captura
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    if (absRowDiff === 2 && absColDiff === 2) {
      const captureRow = fromRow + rowDiff / 2;
      const captureCol = fromCol + colDiff / 2;
      const capturedPieceValue = this.board[captureRow][captureCol];
      
      // Asegurarse de que la pieza capturada exista
      if (capturedPieceValue === 0) {
        console.error(`[SERVER ERROR] Intento de capturar una casilla vacía en ${captureRow},${captureCol}`);
        // Revertir el movimiento inicial? Podría ser necesario, pero complica el estado.
        // Por ahora, solo no actualizar contadores y continuar.
      } else {
          // Actualizar el contador de piezas
        if (capturedPieceValue === 1 || capturedPieceValue === 3) {
            this.playerPieces--;
        } else {
            this.aiPieces--;
        }
        this.board[captureRow][captureCol] = 0; // Eliminar pieza capturada
      }
    }

    // Verificar si la pieza se convierte en dama
    // Jugador 1 (blancas) se convierte en rey en fila 7
    if (piece === 1 && toRow === this.size - 1) { 
      this.board[toRow][toCol] = 3; // Promoción a dama del jugador
    }
    // IA (negras) se convierte en rey en fila 0
    else if (piece === 2 && toRow === 0) { 
      this.board[toRow][toCol] = 4; // Promoción a dama de la IA
    } else {
      this.board[toRow][toCol] = piece;
    }

    // Cambiar el turno
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    
    return true;
  }

  // Verifica si el juego ha terminado
  isGameOver() {
    return this.playerPieces === 0 || this.aiPieces === 0;
  }

  // Devuelve el ganador (0: nadie, 1: jugador, 2: IA)
  getWinner() {
    if (this.playerPieces === 0) return 2;
    if (this.aiPieces === 0) return 1;
    return 0;
  }

  // Convierte el tablero a una representación de string para enviar a Gemini
  toBoardString() {
    let result = '';
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        result += this.board[row][col] + ' ';
      }
      result += '\n';
    }
    return result;
  }
}

module.exports = Board; 