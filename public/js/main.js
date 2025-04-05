// Conectar con el servidor
const socket = io();

// Referencias a elementos del DOM
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const thinkingElement = document.getElementById('thinking');
const newGameButton = document.getElementById('new-game-btn');
const playerPiecesElement = document.getElementById('player-pieces');
const aiPiecesElement = document.getElementById('ai-pieces');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyButton = document.getElementById('save-api-key-btn');
const apiKeyStatus = document.getElementById('api-key-status');

// Variables de estado del juego
let gameState = null;
let selectedPiece = null;
let validMoves = [];
let lastAIMove = null;
let requiredCaptures = [];
let draggedPiece = null;
let apiKey = null;
// Variables para soporte táctil
let touchStartX = 0;
let touchStartY = 0;
let touchedPiece = null;
// Variables para soporte 3D
let boardRotationX = 15;
let boardRotationZ = 0;
let is3DEnabled = true;
// Indicador de movimiento inválido
let invalidMoveTimer = null;

// Función de depuración para ver lo que está pasando
function debug(message) {
  console.log(`[DEBUG] ${message}`);
}

// Cargar la API key guardada (si existe)
function loadApiKey() {
  const savedApiKey = localStorage.getItem('geminiApiKey');
  if (savedApiKey) {
    apiKey = savedApiKey;
    apiKeyInput.value = maskApiKey(savedApiKey);
    apiKeyStatus.textContent = 'Configurada';
    apiKeyStatus.classList.add('configured');
    debug('API key cargada desde localStorage');
  }
}

// Ocultar parte de la API key para mostrarla en la UI
function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 8) return key;
  return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}

// Guardar la API key
function saveApiKey() {
  const newApiKey = apiKeyInput.value.trim();
  
  if (!newApiKey) {
    apiKeyStatus.textContent = 'Error: La API key no puede estar vacía';
    apiKeyStatus.classList.add('error');
    apiKeyStatus.classList.remove('configured');
    return;
  }
  
  // Guardar la API key en localStorage
  localStorage.setItem('geminiApiKey', newApiKey);
  apiKey = newApiKey;
  
  // Actualizar la UI
  apiKeyInput.value = maskApiKey(newApiKey);
  apiKeyStatus.textContent = 'Configurada';
  apiKeyStatus.classList.add('configured');
  apiKeyStatus.classList.remove('error');
  
  debug('API key guardada');
  
  // Notificar al servidor sobre la nueva API key
  socket.emit('setApiKey', { apiKey: newApiKey });
}

// Inicializar el juego
function initializeGame() {
  debug('Inicializando juego...');
  
  // Verificar API key
  if (!apiKey) {
    showTemporaryMessage('Por favor, configura tu API key de Google Gemini antes de jugar', true);
    return;
  }
  
  // Iniciar juego en el servidor
  socket.emit('createGame', { apiKey });
  
  // Mostrar mensaje de inicio
  statusElement.textContent = 'Nuevo juego iniciado. Es tu turno (blancas).';
  thinkingElement.classList.add('hidden');
  
  // Resetear variables de estado
  lastAIMove = null;
  requiredCaptures = [];
  selectedPiece = null;
  validMoves = [];
  
  // Resetear rotación del tablero
  setBoardRotation(15, 0);
  
  // Inicializar efectos visuales
  setTimeout(() => {
    initializePieceEffects();
    
    // Mostrar mensaje tutorial
    showTemporaryMessage("Selecciona una pieza para comenzar", false);
    
    // Inicializar el tutorial interactivo
    initializeTutorial();
  }, 500);
}

// Función para controlar la rotación 3D del tablero
function setBoardRotation(rotX, rotZ) {
  boardRotationX = rotX;
  boardRotationZ = rotZ;
  
  if (!is3DEnabled) {
    boardElement.style.transform = 'rotateX(0deg) rotateZ(0deg)';
    return;
  }
  
  boardElement.style.transform = `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
  debug(`Tablero rotado a X:${rotX}deg Z:${rotZ}deg`);
}

// Actualizar la interfaz con el estado actual del tablero
function updateBoard() {
  debug('Actualizando tablero...');
  if (!gameState) {
    debug('No hay estado de juego!');
    return;
  }
  
  // Limpiar el tablero
  boardElement.innerHTML = '';
  
  const board = gameState.board;
  
  // Aplicar rotación del tablero
  setBoardRotation(boardRotationX, boardRotationZ);
  
  // Crear las celdas del tablero
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement('div');
      // Casillas alternadas, las negras son las casillas donde (row+col) es impar
      const isBlackCell = (row + col) % 2 !== 0;
      cell.className = `cell ${isBlackCell ? 'black-cell' : 'white-cell'}`;
      cell.dataset.row = row;
      cell.dataset.col = col;
      
      debug(`Creando celda en ${row},${col}, es negra: ${isBlackCell}`);
      
      // Solo configurar eventos para casillas negras (donde se juega)
      if (isBlackCell) {
        // Configurar eventos para drag & drop en 3D
        cell.addEventListener('dragover', function(e) {
          // Solo permitir soltar en celdas válidas
          if (draggedPiece && isValidMove(row, col)) {
            e.preventDefault(); // Permitir soltar
            e.stopPropagation();
            
            // Si la vista 3D está activa, hacer que la celda se eleve
            if (is3DEnabled) {
              this.style.transform = 'translateZ(10px)';
            }
            
            cell.classList.add('drag-over');
          }
        });
        
        cell.addEventListener('dragleave', function() {
          cell.classList.remove('drag-over');
          
          // Resetear elevación cuando se deja de arrastrar sobre la celda
          if (is3DEnabled) {
            this.style.transform = '';
          }
        });
        
        cell.addEventListener('drop', function(e) {
          e.preventDefault();
          cell.classList.remove('drag-over');
          
          // Resetear elevación cuando se suelta la pieza
          if (is3DEnabled) {
            this.style.transform = '';
          }
          
          if (draggedPiece) {
            const fromRow = parseInt(draggedPiece.dataset.row);
            const fromCol = parseInt(draggedPiece.dataset.col);
            debug(`Soltando pieza de ${fromRow},${fromCol} en ${row},${col}`);
            
            if (isValidMove(row, col)) {
              movePiece(fromRow, fromCol, row, col);
            } else {
              showInvalidMove(row, col);
            }
            draggedPiece = null;
          }
        });
        
        // Añadir evento click a celdas para mover piezas seleccionadas
        cell.addEventListener('click', handleCellClick);
        
        // Marcar la celda como un movimiento válido si aplica
        if (selectedPiece && validMoves.some(move => move.row === row && move.col === col)) {
          cell.classList.add('valid-move');
          
          // Determinar si es una captura y añadir clase especial
          if (validMoves.some(move => move.row === row && move.col === col && move.isCapture)) {
            cell.classList.add('is-capture');
          }
        }
      }
      
      // Verificar si hay una pieza en esta celda
      const pieceValue = board[row][col];
      
      // Solo crear las piezas en casillas jugables (negras)
      if (pieceValue !== 0 && isBlackCell) {
        const piece = document.createElement('div');
        
        // Asignar clase según el tipo de pieza
        if (pieceValue === 1) {
          piece.className = 'piece player-piece';
        } else if (pieceValue === 2) {
          piece.className = 'piece ai-piece';
        } else if (pieceValue === 3) {
          piece.className = 'piece player-king';
          piece.innerHTML = '<span class="king-symbol">♛</span>';
        } else if (pieceValue === 4) {
          piece.className = 'piece ai-king';
          piece.innerHTML = '<span class="king-symbol">♛</span>';
        }
        
        // Guardar posición en el dataset para referencia durante drag & drop
        piece.dataset.row = row;
        piece.dataset.col = col;
        
        // Agregar el área de interacción ampliada
        const hitArea = document.createElement('div');
        hitArea.className = 'piece-hit-area';
        piece.appendChild(hitArea);
        
        // Agregar evento click si es pieza del jugador
        if (pieceValue === 1 || pieceValue === 3) {
          debug(`Asignando evento click a pieza en ${row},${col}`);
          
          // Hacer la pieza arrastrable
          piece.draggable = true;
          
          // Configurar los eventos para arrastrar y soltar
          piece.addEventListener('dragstart', function(e) {
            debug(`Iniciando arrastre de pieza en ${row},${col}`);
            
            // Verificar si es el turno del jugador
            if (gameState && gameState.currentPlayer !== 1) {
              e.preventDefault();
              return;
            }
            
            draggedPiece = piece;
            
            // Establecer la pieza como seleccionada para determinar movimientos válidos
            selectPiece(row, col);
            
            // Tiempo necesario para que el drag funcione correctamente
            setTimeout(() => piece.classList.add('dragging'), 0);
            
            // Establecer datos para la operación de arrastre
            e.dataTransfer.setData('text/plain', `${row},${col}`);
            e.dataTransfer.effectAllowed = 'move';
          });
          
          piece.addEventListener('dragend', function() {
            debug(`Terminando arrastre de pieza de ${row},${col}`);
            piece.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => {
              el.classList.remove('drag-over');
              if (is3DEnabled) {
                el.style.transform = '';
              }
            });
          });
          
          piece.addEventListener('click', function(e) {
            debug(`Pieza clickeada en ${row},${col}`);
            e.stopPropagation(); // Evitar que el evento se propague a la celda
            
            // Verificar si es el turno del jugador
            if (gameState && gameState.currentPlayer === 1) {
              selectPiece(row, col);
            }
          });
          
          // Resaltar piezas que tienen capturas obligatorias
          if (requiredCaptures.length > 0 && 
              requiredCaptures.some(capture => capture.fromRow === row && capture.fromCol === col)) {
            piece.classList.add('can-capture');
          }
        }
        
        // Si es la pieza seleccionada, añadir la clase
        if (selectedPiece && selectedPiece.row === row && selectedPiece.col === col) {
          piece.classList.add('selected');
        }
        
        cell.appendChild(piece);
      } else if (pieceValue !== 0 && !isBlackCell) {
        debug(`ADVERTENCIA: Hay una pieza (${pieceValue}) en una casilla blanca en ${row},${col}`);
      }
      
      boardElement.appendChild(cell);
    }
  }
  
  // Actualizar información de piezas
  playerPiecesElement.textContent = `Piezas: ${countPieces(board, [1, 3])}`;
  aiPiecesElement.textContent = `Piezas: ${countPieces(board, [2, 4])}`;
  
  // Actualizar el estado del juego
  updateGameStatus();
  
  // Aplicar efectos 3D a las piezas
  initializePieceEffects();
  
  debug('Tablero actualizado');
}

// Contar piezas de un jugador en el tablero
function countPieces(board, values) {
  let count = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (values.includes(board[row][col])) {
        count++;
      }
    }
  }
  return count;
}

// Actualizar el estado del juego
function updateGameStatus() {
  if (!gameState) return;
  
  if (gameState.gameOver) {
    if (gameState.winner === 1) {
      statusElement.textContent = '¡Has ganado! 🎉';
    } else if (gameState.winner === 2) {
      statusElement.textContent = 'Gemini ha ganado. Mejor suerte la próxima vez.';
    }
  } else {
    if (gameState.currentPlayer === 1) {
      let message = 'Es tu turno (blancas)';
      
      // Mostrar mensaje de capturas obligatorias
      if (requiredCaptures.length > 0) {
        message += ' - ¡Tienes capturas obligatorias disponibles!';
      }
      
      // Mostrar información del último movimiento de la IA
      if (lastAIMove) {
        message += ` - Último movimiento de Gemini: (${lastAIMove.fromRow},${lastAIMove.fromCol}) → (${lastAIMove.toRow},${lastAIMove.toCol})`;
      }
      
      statusElement.textContent = message;
    } else {
      statusElement.textContent = 'Turno de Gemini (negras)';
    }
  }
}

// Mostrar feedback para un movimiento inválido
function showInvalidMove(row, col) {
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (cell) {
    cell.classList.add('invalid-move');
    setTimeout(() => {
      cell.classList.remove('invalid-move');
    }, 1000);
  }
  
  // Si hay una pieza seleccionada, aplicar efecto de vibración
  if (selectedPiece) {
    const piece = document.querySelector(`.piece[data-row="${selectedPiece.row}"][data-col="${selectedPiece.col}"]`);
    if (piece) {
      piece.classList.add('shake-piece');
      setTimeout(() => {
        piece.classList.remove('shake-piece');
      }, 800);
    }
  }
  
  // Mostrar mensaje temporal
  showTemporaryMessage('¡Movimiento inválido! Selecciona un destino válido.', true);
}

// Seleccionar una pieza para mover
function selectPiece(row, col) {
  debug(`Seleccionando pieza en ${row},${col}`);
  
  // Verificar que el juego está activo
  if (!gameState) {
    debug('No hay estado de juego');
    return;
  }
  
  // Verificar que es el turno del jugador
  if (gameState.currentPlayer !== 1 || gameState.gameOver) {
    debug('No es tu turno o el juego ha terminado');
    showTemporaryMessage('No es tu turno', true);
    return;
  }
  
  // Verificar que hay una pieza del jugador en esa posición
  const pieceValue = gameState.board[row][col];
  if (pieceValue !== 1 && pieceValue !== 3) {
    debug(`No hay pieza del jugador en ${row},${col}`);
    return;
  }
  
  // Si hay capturas obligatorias, solo permitir seleccionar piezas que pueden capturar
  if (requiredCaptures.length > 0) {
    const canCapture = requiredCaptures.some(
      capture => capture.fromRow === row && capture.fromCol === col
    );
    
    if (!canCapture) {
      showTemporaryMessage('¡Debes realizar una captura obligatoria!', true);
      
      // Resaltar las piezas que pueden realizar capturas
      document.querySelectorAll('.piece').forEach(piece => {
        piece.classList.remove('can-capture');
      });
      
      // Mostrar visualmente las piezas que pueden capturar
      requiredCaptures.forEach(capture => {
        const capturePiece = document.querySelector(`.piece[data-row="${capture.fromRow}"][data-col="${capture.fromCol}"]`);
        if (capturePiece) {
          capturePiece.classList.add('can-capture');
        }
      });
      
      return;
    }
  }
  
  // Si es la misma pieza que ya está seleccionada, deseleccionarla
  if (selectedPiece && selectedPiece.row === row && selectedPiece.col === col) {
    clearSelectedPiece();
    return;
  }
  
  // Limpiar selección anterior
  clearSelectedPiece();
  
  // Calcular los movimientos válidos para esta pieza
  validMoves = findValidMovesForPosition(row, col);
  
  // Si no hay movimientos válidos, mostrar mensaje y deseleccionar
  if (validMoves.length === 0) {
    showTemporaryMessage('Esta pieza no tiene movimientos disponibles', true);
    debug(`La pieza en ${row},${col} no tiene movimientos disponibles`);
    return;
  }
  
  // Seleccionar la nueva pieza
  selectedPiece = { row, col };
  
  // Actualizar el tablero para mostrar la selección y movimientos válidos
  updateBoard();
  
  // Agregar clase "selected" a la pieza seleccionada
  const pieceElement = document.querySelector(`.piece[data-row="${row}"][data-col="${col}"]`);
  if (pieceElement) {
    pieceElement.classList.add('selected');
  }
  
  // Mostrar mensaje con el número de movimientos disponibles
  showTemporaryMessage(`${validMoves.length} movimiento${validMoves.length > 1 ? 's' : ''} disponible${validMoves.length > 1 ? 's' : ''}`, false);
}

// Mostrar un mensaje temporal
function showTemporaryMessage(message, isError = false) {
  const messageElement = document.createElement('div');
  messageElement.className = `temporary-message ${isError ? 'error' : 'info'}`;
  messageElement.textContent = message;
  document.querySelector('.board-container').appendChild(messageElement);
  
  // Animación de entrada
  setTimeout(() => {
    messageElement.classList.add('show');
  }, 10);
  
  // Eliminar después de un tiempo
  setTimeout(() => {
    messageElement.classList.remove('show');
    messageElement.classList.add('hide');
    setTimeout(() => {
      messageElement.remove();
    }, 500);
  }, 2000);
}

// Limpiar la selección actual
function clearSelectedPiece() {
  selectedPiece = null;
  validMoves = [];
  
  // Quitar clase "selected" de todas las piezas
  const pieces = boardElement.querySelectorAll('.piece');
  pieces.forEach(piece => {
    piece.classList.remove('selected');
  });
}

// Corregir la función para encontrar movimientos válidos con más depuración
function findValidMovesForPosition(row, col) {
  if (!gameState) return [];
  
  const piece = gameState.board[row][col];
  if (piece !== 1 && piece !== 3) {
    debug(`No es una pieza del jugador en ${row},${col}, valor: ${piece}`);
    return [];
  }
  
  const isKing = piece === 3; // Es una dama
  debug(`Buscando movimientos para pieza en ${row},${col}, tipo: ${isKing ? 'rey' : 'normal'}`);
  
  // Direcciones posibles (diagonal)
  const directions = [
    { rowDiff: -1, colDiff: -1 }, // Arriba-izquierda
    { rowDiff: -1, colDiff: 1 },  // Arriba-derecha
    { rowDiff: 1, colDiff: -1 },  // Abajo-izquierda (Adelante para blancas)
    { rowDiff: 1, colDiff: 1 }    // Abajo-derecha (Adelante para blancas)
  ];
  
  // *** CORRECCIÓN: Para piezas normales blancas (jugador 1), "adelante" es rowDiff > 0 ***
  const allowedDirections = isKing ? directions : directions.filter(dir => dir.rowDiff > 0);
  debug(`  Direcciones permitidas para movimientos simples (${allowedDirections.length}): ${JSON.stringify(allowedDirections)}`);
  
  // Inicializar array de movimientos válidos
  let validMoves = [];
  
  // --- Búsqueda de Capturas --- //
  let hasCaptures = false;
  debug('  Buscando capturas...');
  const captureDirections = isKing ? directions : directions; // Reyes pueden capturar hacia atrás
  for (const dir of captureDirections) {
    // *** CORRECCIÓN: Para piezas normales blancas (jugador 1), solo capturar "adelante" (rowDiff > 0) ***
    if (!isKing && dir.rowDiff < 0) {
      debug(`    Dirección de captura ${JSON.stringify(dir)} descartada (normal blanca no captura hacia atrás)`);
      continue;
    }
    
    const opponentRow = row + dir.rowDiff;
    const opponentCol = col + dir.colDiff;
    const jumpRow = opponentRow + dir.rowDiff;
    const jumpCol = opponentCol + dir.colDiff;
    
    debug(`    Verificando captura en dirección ${dir.rowDiff},${dir.colDiff}: Oponente en (${opponentRow},${opponentCol}), Salto a (${jumpRow},${jumpCol})`);
    
    // Verificar que ambas posiciones (oponente y salto) están dentro del tablero
    if (opponentRow >= 0 && opponentRow < 8 && opponentCol >= 0 && opponentCol < 8 &&
        jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
          
      const opponentPiece = gameState.board[opponentRow][opponentCol];
      debug(`      Celda oponente (${opponentRow},${opponentCol}) contiene: ${opponentPiece}`);

      // Asegurarse de que es una pieza enemiga
      if (opponentPiece !== 2 && opponentPiece !== 4) {
        debug(`      Captura RECHAZADA: La pieza en (${opponentRow},${opponentCol}) no es enemiga (es ${opponentPiece}).`);
        continue; // Pasar a la siguiente dirección si no es una pieza enemiga
      }

      // Si es enemiga, verificar la celda de salto
      const jumpCellIsEmpty = gameState.board[jumpRow][jumpCol] === 0;
      const jumpCellIsBlack = (jumpRow + jumpCol) % 2 !== 0;
      debug(`      Celda de salto (${jumpRow},${jumpCol}): Vacía=${jumpCellIsEmpty}, Negra=${jumpCellIsBlack}`);
        
      // Verificar que la celda de salto está vacía y es negra
      if (jumpCellIsEmpty && jumpCellIsBlack) {
        debug(`      ¡Captura VÁLIDA encontrada!: ${row},${col} → ${jumpRow},${jumpCol}`);
        validMoves.push({ 
          row: jumpRow, 
          col: jumpCol, 
          isCapture: true,
          captureRow: opponentRow,
          captureCol: opponentCol
        });
        hasCaptures = true;
      } else {
        debug('      Captura RECHAZADA: Celda de salto no está vacía o no es negra.');
      }
    } else {
      debug('      Captura RECHAZADA: Oponente o celda de salto fuera del tablero.');
    }
  }
  
  // Si hay capturas disponibles, son obligatorias
  if (hasCaptures) {
    debug(`  ${validMoves.length} capturas obligatorias encontradas. Devolviendo solo capturas.`);
    return validMoves;
  }
  
  // --- Búsqueda de Movimientos Simples --- //
  debug('  Buscando movimientos simples (no hay capturas obligatorias)...');
  for (const dir of allowedDirections) {
    const newRow = row + dir.rowDiff;
    const newCol = col + dir.colDiff;
    
    debug(`    Verificando movimiento simple en dirección ${dir.rowDiff},${dir.colDiff} a (${newRow},${newCol})`);
    
    // Verificar que la posición está dentro del tablero
    if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
      const targetPiece = gameState.board[newRow][newCol];
      const targetIsBlack = (newRow + newCol) % 2 !== 0;
      debug(`      Celda destino (${newRow},${newCol}): Vacía=${targetPiece === 0}, Negra=${targetIsBlack}`);
      
      // Verificar que la celda destino está vacía
      if (targetPiece === 0) {
        // Verificar que la celda destino es negra
        if (targetIsBlack) {
          debug(`      ¡Movimiento simple VÁLIDO!: ${row},${col} → ${newRow},${newCol}`);
          validMoves.push({ row: newRow, col: newCol, isCapture: false });
        } else {
          debug('      Movimiento RECHAZADO: Celda destino no es negra.');
        }
      } else {
        debug(`      Movimiento RECHAZADO: Celda destino no está vacía (contiene ${targetPiece}).`);
      }
    } else {
      debug('      Movimiento RECHAZADO: Celda destino fuera del tablero.');
    }
  }
  
  debug(`  Total de movimientos válidos encontrados para ${row},${col}: ${validMoves.length}`);
  return validMoves;
}

// Verificar si un movimiento a la celda (row, col) es válido para la pieza seleccionada
function isValidMove(toRow, toCol) {
  // Si no hay pieza seleccionada o draggedPiece, no es válido
  if (!selectedPiece && !draggedPiece && !touchedPiece) {
    debug('No hay pieza seleccionada para evaluar movimiento');
    return false;
  }
  
  // Verificar que la celda destino es negra
  if ((toRow + toCol) % 2 === 0) {
    debug(`La celda destino [${toRow},${toCol}] no es negra`);
    return false;
  }
  
  // Usar la pieza que esté siendo manipulada actualmente
  let fromRow, fromCol;
  if (draggedPiece) {
    fromRow = parseInt(draggedPiece.dataset.row);
    fromCol = parseInt(draggedPiece.dataset.col);
  } else if (touchedPiece) {
    fromRow = parseInt(touchedPiece.dataset.row);
    fromCol = parseInt(touchedPiece.dataset.col);
  } else if (selectedPiece) {
    fromRow = selectedPiece.row;
    fromCol = selectedPiece.col;
  } else {
    return false;
  }
  
  // Verificar que la celda origen es negra
  if ((fromRow + fromCol) % 2 === 0) {
    debug(`La celda origen [${fromRow},${fromCol}] no es negra`);
    return false;
  }
  
  debug(`Evaluando movimiento de (${fromRow},${fromCol}) a (${toRow},${toCol})`);
  
  // No permitir mover a la misma posición
  if (fromRow === toRow && fromCol === toCol) {
    debug('Intento de mover a la misma posición');
    return false;
  }
  
  // Verificar si hay capturas requeridas
  if (requiredCaptures.length > 0) {
    const isRequiredCapture = requiredCaptures.some(
      capture => capture.fromRow === fromRow && 
                capture.fromCol === fromCol && 
                capture.toRow === toRow && 
                capture.toCol === toCol
    );
    
    if (isRequiredCapture) {
      debug('El movimiento es una captura obligatoria');
      return true;
    } else {
      debug('Hay capturas obligatorias que deben realizarse primero');
      return false;
    }
  }
  
  // Si es la pieza seleccionada, usar los movimientos válidos ya calculados
  if (selectedPiece && selectedPiece.row === fromRow && selectedPiece.col === fromCol && validMoves.length > 0) {
    const isValid = validMoves.some(move => move.row === toRow && move.col === toCol);
    debug(`Movimiento ${isValid ? 'válido' : 'inválido'} según movimientos precalculados`);
    return isValid;
  }
  
  // Si no, calcular los movimientos válidos
  const moves = findValidMovesForPosition(fromRow, fromCol);
  
  // Verificar si el movimiento está en la lista de movimientos válidos
  const isValid = moves.some(move => move.row === toRow && move.col === toCol);
  debug(`El movimiento ${isValid ? 'es' : 'no es'} válido (de ${moves.length} posibles)`);
  
  return isValid;
}

// Encontrar todos los movimientos válidos para la pieza seleccionada
function findValidMoves() {
  if (!selectedPiece) return;
  
  // Si hay capturas obligatorias, solo mostrar esas para la pieza seleccionada
  if (requiredCaptures.length > 0) {
    validMoves = requiredCaptures
      .filter(capture => 
        capture.fromRow === selectedPiece.row && 
        capture.fromCol === selectedPiece.col
      )
      .map(capture => ({ 
        row: capture.toRow, 
        col: capture.toCol,
        isCapture: true 
      }));
    
    debug(`Movimientos válidos (capturas obligatorias): ${JSON.stringify(validMoves)}`);
    return;
  }
  
  return findValidMovesForPosition(selectedPiece.row, selectedPiece.col);
}

// Mover una pieza
function movePiece(fromRow, fromCol, toRow, toCol) {
  debug(`Intentando mover pieza de [${fromRow},${fromCol}] a [${toRow},${toCol}]`);

  // *** VALIDACIÓN DEL CLIENTE: Asegurarse de que la pieza de origen pertenece al jugador ***
  if (!gameState || !gameState.board) {
    debug('[ERROR CLIENTE] No hay estado de juego para validar la pieza.');
    return;
  }
  const pieceValue = gameState.board[fromRow][fromCol];
  if (pieceValue !== 1 && pieceValue !== 3) {
    debug(`[ERROR CLIENTE] Intento de mover una pieza que no es del jugador. Pieza en ${fromRow},${fromCol} es ${pieceValue}`);
    showTemporaryMessage('Error: Intentando mover una pieza del oponente.', true);
    // Limpiar cualquier selección incorrecta
    clearSelectedPiece(); 
    return; 
  }
  // *** FIN DE VALIDACIÓN DEL CLIENTE ***

  debug(`Validación del cliente OK. Enviando movimiento al servidor: [${fromRow},${fromCol}] a [${toRow},${toCol}]`);
  
  // Primero, enviar el movimiento al servidor con la API key para procesar el movimiento
  socket.emit('playerMove', { 
    fromRow, 
    fromCol, 
    toRow, 
    toCol,
    apiKey
  });
  
  // Mostrar un mensaje de que el movimiento se está procesando
  showTemporaryMessage('Procesando movimiento...', false);
  
  // --- El resto de la función maneja la animación visual PREVIA a la respuesta del servidor ---
  // --- La actualización REAL del estado vendrá del servidor --- 

  // Verificar si es una captura para animación
  const isCapture = Math.abs(fromRow - toRow) === 2 && Math.abs(fromCol - toCol) === 2;
  
  if (isCapture) {
    // Calcular la posición de la pieza capturada
    const capturedRow = (fromRow + toRow) / 2;
    const capturedCol = (fromCol + toCol) / 2;
    
    // Marcar la pieza capturada para el efecto visual (se eliminará cuando llegue el estado del servidor)
    const capturedCell = document.querySelector(`[data-row="${capturedRow}"][data-col="${capturedCol}"]`);
    if (capturedCell) {
      const capturedPiece = capturedCell.querySelector('.piece');
      if (capturedPiece) {
        capturedPiece.classList.add('captured');
      }
    }
  }
  
  // Actualizar el DOM visualmente (animación)
  const fromCell = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
  const toCell = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
  
  if (!fromCell || !toCell) {
    debug('[ERROR CLIENTE] No se encontraron las celdas para la animación.');
    return;
  }
  
  const pieceElement = fromCell.querySelector('.piece');
  if (!pieceElement) {
    debug('[ERROR CLIENTE] No se encontró la pieza a animar.');
    return;
  }
  
  // Animación de movimiento
  const fromRect = fromCell.getBoundingClientRect();
  const toRect = toCell.getBoundingClientRect();
  const deltaX = toRect.left - fromRect.left;
  const deltaY = toRect.top - fromRect.top;
  
  // Animación suave del movimiento
  pieceElement.style.transition = 'transform 0.5s ease-out';
  pieceElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  
  // Después de la animación, la pieza *visualmente* salta al destino,
  // pero lógicamente esperamos la confirmación del servidor.
  setTimeout(() => {
    // Mover visualmente la pieza (temporalmente)
    if (fromCell.contains(pieceElement)) {
        fromCell.removeChild(pieceElement); 
    }
    toCell.appendChild(pieceElement);
    pieceElement.style.transition = '';
    pieceElement.style.transform = '';
    
    // Actualizar los atributos de datos visualmente (temporalmente)
    pieceElement.dataset.row = toRow;
    pieceElement.dataset.col = toCol;
    
    // Limpiar selección visual
    clearSelectedPiece(); 
    
    // Marcar la última jugada visualmente (temporalmente)
    document.querySelectorAll('.last-move').forEach(cell => cell.classList.remove('last-move'));
    fromCell.classList.add('last-move');
    toCell.classList.add('last-move');
    
    // Esperando respuesta del servidor...
    thinkingElement.classList.remove('hidden');
    statusElement.textContent = 'Esperando respuesta del servidor...';
  }, 500);
}

// Manejo mejorado de la respuesta del servidor
socket.on('gameState', (data) => {
  debug(`Estado de juego recibido: ${JSON.stringify(data)}`);
  gameState = data;
  
  // Verificar si el tablero está correctamente inicializado
  debug('Verificando tablero recibido:');
  printBoardState();
  
  // Verificar que las piezas están solo en casillas negras
  let piecesInWhiteCells = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isBlackCell = (row + col) % 2 !== 0;
      const pieceValue = gameState.board[row][col];
      
      if (pieceValue !== 0 && !isBlackCell) {
        debug(`ERROR: Pieza ${pieceValue} encontrada en casilla blanca [${row},${col}]`);
        piecesInWhiteCells++;
      }
    }
  }
  
  if (piecesInWhiteCells > 0) {
    debug(`ADVERTENCIA: Se encontraron ${piecesInWhiteCells} piezas en casillas blancas`);
  }
  
  // Ocultar el indicador de pensamiento
  thinkingElement.classList.add('hidden');
  
  // Limpiar capturas requeridas
  requiredCaptures = [];
  
  // Guardar el movimiento de la IA si está presente
  if (data.aiMove) {
    lastAIMove = data.aiMove;
    
    // Animar el movimiento de la IA
    setTimeout(() => {
      animateAIMove(data.aiMove);
    }, 500);
  } else {
    // Si no hay movimiento de la IA, simplemente actualizar el tablero
    updateBoard();
  }
});

// Función para animar el movimiento de la IA
function animateAIMove(aiMove) {
  const { fromRow, fromCol, toRow, toCol } = aiMove;
  debug(`Animando movimiento de la IA de [${fromRow},${fromCol}] a [${toRow},${toCol}]`);
  
  // Obtener las celdas
  const fromCell = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
  const toCell = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
  
  if (!fromCell || !toCell) {
    debug('Error: No se encontraron las celdas para el movimiento de la IA.');
    updateBoard(); // Actualizar el tablero de todos modos
    return;
  }
  
  const piece = fromCell.querySelector('.piece');
  if (!piece) {
    debug('Error: No se encontró la pieza de la IA a mover.');
    updateBoard(); // Actualizar el tablero de todos modos
    return;
  }
  
  // Resaltar la pieza que se va a mover
  piece.classList.add('ai-moving');
  
  // Animar el destino
  toCell.classList.add('ai-target');
  
  // Esperar un poco para que el jugador vea qué pieza se va a mover
  setTimeout(() => {
    // Calcular la distancia para la animación
    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();
    const deltaX = toRect.left - fromRect.left;
    const deltaY = toRect.top - fromRect.top;
    
    // Aplicar la animación
    piece.style.transition = 'transform 0.8s ease-out';
    piece.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    
    // Verificar si es una captura
    const isCapture = Math.abs(fromRow - toRow) === 2 && Math.abs(fromCol - toCol) === 2;
    if (isCapture) {
      const capturedRow = (fromRow + toRow) / 2;
      const capturedCol = (fromCol + toCol) / 2;
      const capturedCell = document.querySelector(`[data-row="${capturedRow}"][data-col="${capturedCol}"]`);
      
      if (capturedCell) {
        const capturedPiece = capturedCell.querySelector('.piece');
        if (capturedPiece) {
          // Aplicar efecto de captura
          setTimeout(() => {
            capturedPiece.classList.add('captured');
          }, 400);
        }
      }
    }
    
    // Después de la animación, actualizar el tablero
    setTimeout(() => {
      updateBoard();
    }, 900);
  }, 600);
}

// Estilos para el movimiento de la IA
const aiMoveStyles = document.createElement('style');
aiMoveStyles.textContent = `
  .ai-moving {
    box-shadow: 0 0 20px rgba(52, 152, 219, 0.8), 0 10px 20px rgba(0, 0, 0, 0.4);
    animation: ai-pulse 1s infinite alternate;
    z-index: 50;
  }
  
  .ai-target {
    box-shadow: inset 0 0 20px rgba(52, 152, 219, 0.6);
    animation: ai-target-pulse 1s infinite alternate;
  }
  
  @keyframes ai-pulse {
    0% {
      transform: translateZ(10px) scale(1);
      box-shadow: 0 0 15px rgba(52, 152, 219, 0.7), 0 10px 15px rgba(0, 0, 0, 0.4);
    }
    100% {
      transform: translateZ(20px) scale(1.1);
      box-shadow: 0 0 30px rgba(52, 152, 219, 0.9), 0 15px 25px rgba(0, 0, 0, 0.5);
    }
  }
  
  @keyframes ai-target-pulse {
    0% {
      box-shadow: inset 0 0 15px rgba(52, 152, 219, 0.4);
    }
    100% {
      box-shadow: inset 0 0 30px rgba(52, 152, 219, 0.8);
    }
  }
`;
document.head.appendChild(aiMoveStyles);

// Manejar eventos de socket
socket.on('connect', () => {
  debug('Conectado al servidor');
  
  // Si hay API key guardada, enviarla al servidor
  if (apiKey) {
    socket.emit('setApiKey', { apiKey });
  }
});

socket.on('disconnect', () => {
  debug('Desconectado del servidor');
});

socket.on('aiThinking', (isThinking) => {
  debug(`IA pensando: ${isThinking}`);
  if (isThinking) {
    thinkingElement.classList.remove('hidden');
  } else {
    thinkingElement.classList.add('hidden');
  }
});

socket.on('error', (error) => {
  debug(`Error recibido: ${JSON.stringify(error)}`);
  
  // Ocultar el indicador de pensamiento
  thinkingElement.classList.add('hidden');
  
  // Verificar si es un error de API key
  if (error.error === 'API_KEY_INVALID' || error.error === 'API_KEY_REQUIRED') {
    apiKeyStatus.textContent = 'Error: ' + (error.message || 'API key inválida');
    apiKeyStatus.classList.add('error');
    apiKeyStatus.classList.remove('configured');
    showTemporaryMessage('Error con tu API key: ' + (error.message || 'API key inválida o no proporcionada'), true);
    return;
  }
  
  // Si hay un error de captura obligatoria, guardar las capturas y actualizar el tablero
  if (error.error === 'Hay capturas obligatorias disponibles' && error.captures) {
    requiredCaptures = error.captures;
    
    // Mostrar mensaje indicando capturas obligatorias
    showTemporaryMessage('¡Hay capturas obligatorias disponibles!', true);
    
    // Resaltar las piezas que pueden capturar
    document.querySelectorAll('.piece').forEach(piece => {
      piece.classList.remove('can-capture');
    });
    
    // Resaltar visualmente las piezas que pueden capturar
    setTimeout(() => {
      requiredCaptures.forEach(capture => {
        const capturePiece = document.querySelector(`.piece[data-row="${capture.fromRow}"][data-col="${capture.fromCol}"]`);
        if (capturePiece) {
          capturePiece.classList.add('can-capture');
        }
      });
      
      // Actualizar el estado de juego en la UI
      statusElement.textContent = 'Debes realizar una captura obligatoria con las piezas resaltadas.';
    }, 100);
    
    updateBoard();
  } else {
    // Otros errores
    statusElement.textContent = `Error: ${error.error || error}`;
    showTemporaryMessage(`Error: ${error.error || error}`, true);
  }
  
  // Desbloquear la interfaz (en caso de que estuviera bloqueada por un movimiento en proceso)
  document.querySelectorAll('.piece').forEach(piece => {
    piece.classList.remove('dragging');
  });
});

// Agregar eventos
saveApiKeyButton.addEventListener('click', saveApiKey);

apiKeyInput.addEventListener('focus', function() {
  // Al enfocar, mostrar el campo vacío para facilitar la escritura
  this.value = '';
});

apiKeyInput.addEventListener('blur', function() {
  // Al perder el foco, mascarar la API key de nuevo si no se guardó
  if (apiKey) {
    this.value = maskApiKey(apiKey);
  }
});

newGameButton.addEventListener('click', () => {
  debug('Botón Nuevo Juego clickeado');
  initializeGame();
});

// Para implementar los controles 3D del tablero, añadir estas funciones y eventos
function setupBoardControls() {
  // Botón para activar/desactivar vista 3D
  const toggle3DButton = document.createElement('button');
  toggle3DButton.id = 'toggle-3d-btn';
  toggle3DButton.textContent = 'Alternar vista 3D';
  toggle3DButton.className = 'control-btn';
  
  // Botones para rotar el tablero
  const rotateLeftButton = document.createElement('button');
  rotateLeftButton.id = 'rotate-left-btn';
  rotateLeftButton.textContent = '⟲ Rotar izquierda';
  rotateLeftButton.className = 'control-btn';
  
  const rotateRightButton = document.createElement('button');
  rotateRightButton.id = 'rotate-right-btn';
  rotateRightButton.textContent = '⟳ Rotar derecha';
  rotateRightButton.className = 'control-btn';
  
  const rotateUpButton = document.createElement('button');
  rotateUpButton.id = 'rotate-up-btn';
  rotateUpButton.textContent = '⤒ Inclinar arriba';
  rotateUpButton.className = 'control-btn';
  
  const rotateDownButton = document.createElement('button');
  rotateDownButton.id = 'rotate-down-btn';
  rotateDownButton.textContent = '⤓ Inclinar abajo';
  rotateDownButton.className = 'control-btn';
  
  const resetButton = document.createElement('button');
  resetButton.id = 'reset-view-btn';
  resetButton.textContent = 'Reiniciar vista';
  resetButton.className = 'control-btn';
  
  // Crear contenedor para los controles
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'board-controls';
  controlsContainer.appendChild(toggle3DButton);
  controlsContainer.appendChild(rotateLeftButton);
  controlsContainer.appendChild(rotateRightButton);
  controlsContainer.appendChild(rotateUpButton);
  controlsContainer.appendChild(rotateDownButton);
  controlsContainer.appendChild(resetButton);
  
  // Añadir controles antes del tablero
  boardElement.parentNode.insertBefore(controlsContainer, boardElement);
  
  // Eventos para los botones
  toggle3DButton.addEventListener('click', () => {
    is3DEnabled = !is3DEnabled;
    if (is3DEnabled) {
      setBoardRotation(boardRotationX, boardRotationZ);
      toggle3DButton.textContent = 'Desactivar vista 3D';
    } else {
      setBoardRotation(0, 0);
      toggle3DButton.textContent = 'Activar vista 3D';
    }
  });
  
  rotateLeftButton.addEventListener('click', () => {
    setBoardRotation(boardRotationX, boardRotationZ - 10);
  });
  
  rotateRightButton.addEventListener('click', () => {
    setBoardRotation(boardRotationX, boardRotationZ + 10);
  });
  
  rotateUpButton.addEventListener('click', () => {
    setBoardRotation(Math.min(boardRotationX + 5, 40), boardRotationZ);
  });
  
  rotateDownButton.addEventListener('click', () => {
    setBoardRotation(Math.max(boardRotationX - 5, 0), boardRotationZ);
  });
  
  resetButton.addEventListener('click', () => {
    setBoardRotation(15, 0);
  });
  
  // Configurar eventos de teclado para controlar rotación 3D
  document.addEventListener('keydown', (e) => {
    if (!is3DEnabled) return;
    
    switch(e.key) {
      case 'ArrowLeft':
        setBoardRotation(boardRotationX, boardRotationZ - 5);
        e.preventDefault();
        break;
      case 'ArrowRight':
        setBoardRotation(boardRotationX, boardRotationZ + 5);
        e.preventDefault();
        break;
      case 'ArrowUp':
        setBoardRotation(Math.min(boardRotationX + 5, 40), boardRotationZ);
        e.preventDefault();
        break;
      case 'ArrowDown':
        setBoardRotation(Math.max(boardRotationX - 5, 0), boardRotationZ);
        e.preventDefault();
        break;
    }
  });
}

// Inicializar la aplicación
window.addEventListener('DOMContentLoaded', () => {
  debug('Página cargada, inicializando la aplicación');
  loadApiKey();
  
  // Configurar los controles 3D del tablero
  setTimeout(() => {
    setupBoardControls();
    
    // Mostrar mensaje de bienvenida
    showTemporaryMessage('¡Bienvenido! Configura tu API Key de Google Gemini para comenzar a jugar.', false);
  }, 100);
});

// Añadir efectos visuales mejorados para las piezas
function initializePieceEffects() {
  document.querySelectorAll('.piece').forEach(piece => {
    // Aplicar efecto de sombra 3D para todas las piezas
    piece.style.boxShadow = '0 5px 10px rgba(0, 0, 0, 0.3)';
    
    // Efecto de flotación suave
    piece.classList.add('floating');
    
    // Retraso aleatorio para la animación de flotación
    const delay = Math.random() * 2;
    piece.style.animationDelay = `${delay}s`;
    
    // Añadir listener para el hover
    piece.addEventListener('mouseenter', () => {
      if (piece.classList.contains('player') && playerTurn) {
        piece.classList.add('piece-hover');
      }
    });
    
    piece.addEventListener('mouseleave', () => {
      piece.classList.remove('piece-hover');
    });
  });
}

// Función para inicializar el tutorial interactivo
function initializeTutorial() {
  // Obtener los pasos del tutorial
  const tutorialSteps = document.querySelectorAll('.tutorial-step');
  
  // Verificar si hay un tutorial guardado en localStorage
  const tutorialShown = localStorage.getItem('checkers_tutorial_shown');
  if (tutorialShown) {
    return;
  }
  
  // Crear el overlay del tutorial
  const tutorialOverlay = document.createElement('div');
  tutorialOverlay.className = 'tutorial-overlay';
  document.body.appendChild(tutorialOverlay);
  
  // Mostrar el primer paso del tutorial
  let currentStep = 0;
  
  function showTutorialStep() {
    if (currentStep >= tutorialSteps.length) {
      // Fin del tutorial
      tutorialOverlay.innerHTML = `
        <div class="tutorial-modal">
          <h3>¡Estás listo para jugar!</h3>
          <p>Ya conoces lo básico del juego de damas. ¡Ahora puedes empezar a jugar contra Gemini!</p>
          <button id="tutorial-finish-btn">Empezar a jugar</button>
        </div>
      `;
      
      document.getElementById('tutorial-finish-btn').addEventListener('click', () => {
        tutorialOverlay.classList.add('fade-out');
        setTimeout(() => {
          tutorialOverlay.remove();
          localStorage.setItem('checkers_tutorial_shown', 'true');
        }, 500);
      });
      
      return;
    }
    
    // Crear contenido para el paso actual
    const step = tutorialSteps[currentStep];
    const icon = step.querySelector('.tutorial-icon').innerText;
    const title = step.querySelector('.tutorial-text strong').innerText;
    const content = step.querySelector('.tutorial-text').innerHTML.replace(/<strong>.*?<\/strong><br>/, '');
    
    // Mostrar el modal con el paso actual
    tutorialOverlay.innerHTML = `
      <div class="tutorial-modal">
        <div class="tutorial-step-number">${icon}</div>
        <h3>${title}</h3>
        <div class="tutorial-content">${content}</div>
        <div class="tutorial-buttons">
          ${currentStep > 0 ? '<button id="tutorial-prev-btn">Anterior</button>' : ''}
          <button id="tutorial-next-btn">${currentStep < tutorialSteps.length - 1 ? 'Siguiente' : 'Finalizar'}</button>
        </div>
      </div>
    `;
    
    // Configurar botones
    if (currentStep > 0) {
      document.getElementById('tutorial-prev-btn').addEventListener('click', () => {
        currentStep--;
        showTutorialStep();
      });
    }
    
    document.getElementById('tutorial-next-btn').addEventListener('click', () => {
      currentStep++;
      showTutorialStep();
    });
  }
  
  // Mostrar el primer paso después de un breve retraso
  setTimeout(() => {
    showTutorialStep();
  }, 1000);
}

// Añadir estilos para el tutorial interactivo
const tutorialStyleSheet = document.createElement('style');
tutorialStyleSheet.textContent = `
  .tutorial-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 1;
    transition: opacity 0.5s ease;
  }
  
  .tutorial-overlay.fade-out {
    opacity: 0;
  }
  
  .tutorial-modal {
    background-color: #1a1a2e;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    padding: 25px;
    max-width: 500px;
    width: 90%;
    text-align: center;
    position: relative;
    animation: tutorial-pop 0.5s ease;
  }
  
  @keyframes tutorial-pop {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  
  .tutorial-step-number {
    background-color: #e94560;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 20px;
    font-weight: bold;
    margin: 0 auto 15px;
  }
  
  .tutorial-modal h3 {
    color: #e94560;
    margin: 0 0 15px;
    font-size: 22px;
  }
  
  .tutorial-content {
    margin-bottom: 20px;
    font-size: 16px;
    line-height: 1.5;
    color: #fff;
  }
  
  .tutorial-buttons {
    display: flex;
    justify-content: center;
    gap: 15px;
  }
  
  .tutorial-buttons button {
    background-color: #0f3460;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
  }
  
  .tutorial-buttons button:hover {
    background-color: #16213e;
    transform: translateY(-2px);
  }
  
  #tutorial-next-btn {
    background-color: #e94560;
  }
  
  #tutorial-next-btn:hover {
    background-color: #c7304a;
  }
  
  #tutorial-finish-btn {
    background-color: #4CAF50;
    color: white;
    border: none;
    padding: 12px 25px;
    border-radius: 5px;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 15px;
  }
  
  #tutorial-finish-btn:hover {
    background-color: #3e8e41;
    transform: translateY(-2px);
  }
`;

document.head.appendChild(tutorialStyleSheet);

// Estilos CSS en JavaScript para animaciones
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes float {
    0% { transform: translateY(0) translateZ(5px); }
    50% { transform: translateY(-3px) translateZ(8px); }
    100% { transform: translateY(0) translateZ(5px); }
  }
  
  .floating {
    animation: float 4s ease-in-out infinite;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  
  .shake-piece {
    animation: shake 0.5s ease-in-out;
  }
  
  @keyframes pulse-border {
    0% { box-shadow: 0 0 0 0 rgba(233, 69, 96, 0.7), 0 10px 10px rgba(0, 0, 0, 0.3); }
    70% { box-shadow: 0 0 0 6px rgba(233, 69, 96, 0), 0 10px 10px rgba(0, 0, 0, 0.3); }
    100% { box-shadow: 0 0 0 0 rgba(233, 69, 96, 0), 0 10px 10px rgba(0, 0, 0, 0.3); }
  }
  
  .pulse-border {
    animation: pulse-border 1.5s infinite;
  }
  
  .piece-hover {
    transform: translateZ(10px) scale(1.05);
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.4);
    transition: all 0.2s ease;
  }
  
  .move-highlight {
    animation: highlight-pulse 1s ease-out;
  }
  
  @keyframes highlight-pulse {
    0% { background-color: rgba(76, 175, 80, 0); }
    50% { background-color: rgba(76, 175, 80, 0.3); }
    100% { background-color: rgba(76, 175, 80, 0); }
  }
  
  .capture-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 15px;
    height: 15px;
    background-color: rgba(255, 0, 0, 0.6);
    border-radius: 50%;
    z-index: 5;
    animation: capture-pulse 1s infinite;
  }
  
  @keyframes capture-pulse {
    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
    50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.8; }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
  }
  
  .captured {
    animation: capture-anim 0.3s forwards;
    transform-origin: center center;
  }
  
  @keyframes capture-anim {
    0% { transform: scale(1) rotate(0); opacity: 1; }
    100% { transform: scale(0) rotate(180deg); opacity: 0; }
  }
  
  .temporary-message {
    position: absolute;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 16px;
    z-index: 1000;
    transition: all 0.3s ease;
    opacity: 0;
  }
  
  .temporary-message.error {
    background-color: rgba(220, 53, 69, 0.9);
  }
  
  .temporary-message.info {
    background-color: rgba(13, 110, 253, 0.9);
  }
  
  .temporary-message.show {
    top: 20px;
    opacity: 1;
  }
  
  .temporary-message.hide {
    top: -60px;
    opacity: 0;
  }
`;

document.head.appendChild(styleSheet);

// Agregar clase de estilos para piezas que pueden capturar
const captureHighlightStyle = document.createElement('style');
captureHighlightStyle.textContent = `
  .piece.can-capture {
    animation: capture-highlight 1.5s infinite;
    box-shadow: 0 0 20px rgba(255, 0, 0, 0.8), 0 10px 20px rgba(0, 0, 0, 0.4);
    z-index: 50;
  }
  
  @keyframes capture-highlight {
    0%, 100% {
      transform: translateZ(10px) scale(1);
    }
    50% {
      transform: translateZ(20px) scale(1.1);
    }
  }
`;
document.head.appendChild(captureHighlightStyle);

// Modificar la función para mejorar el agarre de las piezas
function enhancePieceInteraction() {
  document.querySelectorAll('.piece').forEach(piece => {
    // Agregar un área de interacción más amplia
    const hitArea = document.createElement('div');
    hitArea.className = 'piece-hit-area';
    piece.appendChild(hitArea);
    
    // Mejorar la respuesta táctil
    piece.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevenir scroll
      const touch = e.touches[0];
      const rect = piece.getBoundingClientRect();
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;
      
      // Guardar el offset para un mejor control durante el arrastre
      piece.dataset.offsetX = offsetX;
      piece.dataset.offsetY = offsetY;
      
      // Elevar la pieza visualmente para mejor feedback
      if (is3DEnabled) {
        piece.style.transform = 'translateZ(25px) scale(1.15)';
      }
      
      // Verificar si es una pieza del jugador y es su turno
      if (piece.classList.contains('player-piece') || piece.classList.contains('player-king')) {
        if (gameState && gameState.currentPlayer === 1) {
          const row = parseInt(piece.dataset.row);
          const col = parseInt(piece.dataset.col);
          selectPiece(row, col);
        }
      }
    }, { passive: false });
  });
  
  // Agregar estilo para el área de interacción
  const hitAreaStyle = document.createElement('style');
  hitAreaStyle.textContent = `
    .piece-hit-area {
      position: absolute;
      top: -10px;
      left: -10px;
      right: -10px;
      bottom: -10px;
      border-radius: 50%;
      z-index: 5;
      pointer-events: auto;
      cursor: pointer;
    }
  `;
  document.head.appendChild(hitAreaStyle);
}

// Función para verificar si el juego ha terminado
function checkGameOver() {
  if (!gameState) return false;
  
  // Si el juego ya está marcado como terminado, simplemente retornar
  if (gameState.gameOver) return true;
  
  // Contar piezas
  let playerPieces = 0;
  let aiPieces = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = gameState.board[row][col];
      if (cell === 1 || cell === 3) {
        playerPieces++;
      } else if (cell === 2 || cell === 4) {
        aiPieces++;
      }
    }
  }
  
  // Actualizar contadores en la UI
  document.getElementById('player-pieces').textContent = `Piezas: ${playerPieces}`;
  document.getElementById('ai-pieces').textContent = `Piezas: ${aiPieces}`;
  
  // Verificar si algún jugador se quedó sin piezas
  if (playerPieces === 0) {
    gameState.gameOver = true;
    gameState.winner = 2; // IA gana
    statusElement.textContent = "La IA ha ganado. Todas tus piezas han sido capturadas.";
    return true;
  } else if (aiPieces === 0) {
    gameState.gameOver = true;
    gameState.winner = 1; // Jugador gana
    statusElement.textContent = "¡Has ganado! Has capturado todas las piezas de la IA.";
    return true;
  }
  
  // TODO: Verificar si hay movimientos posibles para el jugador actual
  
  return false;
}

// Mejorar la detección de movimientos válidos
function updateValidMoveIndicators() {
  // Limpiar indicadores existentes
  document.querySelectorAll('.valid-move, .is-capture').forEach(cell => {
    cell.classList.remove('valid-move', 'is-capture');
  });
  
  // Si no hay pieza seleccionada, no hay movimientos que mostrar
  if (!selectedPiece) return;
  
  // Recorrer movimientos válidos
  validMoves.forEach(move => {
    const cell = document.querySelector(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);
    if (cell) {
      cell.classList.add('valid-move');
      
      // Si es una captura, añadir clase especial
      if (move.isCapture) {
        cell.classList.add('is-capture');
      }
    }
  });
}

// Actualizar las variables al recibir el estado del juego
function updateGameVariables(gameData) {
  gameState = gameData;
  
  // Actualizar contadores
  checkGameOver();
  
  // Actualizar estado del juego
  updateGameStatus();
  
  // Verificar si hay capturas obligatorias
  if (gameData.requiredCaptures && gameData.requiredCaptures.length > 0) {
    requiredCaptures = gameData.requiredCaptures;
    showTemporaryMessage('¡Hay capturas obligatorias disponibles!', false);
  } else {
    requiredCaptures = [];
  }
}

// Modificación de la función para manejo de eventos de clic en celdas
function handleCellClick(e) {
  const cell = e.currentTarget;
  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);
  
  debug(`Clic en celda ${row},${col}`);
  
  // Verificar si es turno del jugador
  if (!gameState || gameState.currentPlayer !== 1 || gameState.gameOver) {
    debug('No es tu turno o el juego ha terminado');
    return;
  }
  
  // Si hay una pieza seleccionada, intentar mover
  if (selectedPiece) {
    if (isValidMove(row, col)) {
      movePiece(selectedPiece.row, selectedPiece.col, row, col);
    } else {
      // Movimiento inválido, mostrar feedback
      showInvalidMove(row, col);
    }
  } else {
    // Si no hay pieza seleccionada, verificar si hay una pieza del jugador en la celda
    const piece = gameState.board[row][col];
    if (piece === 1 || piece === 3) {
      selectPiece(row, col);
    }
  }
}

// Agregar función de depuración para mostrar el estado del tablero
function printBoardState() {
  if (!gameState || !gameState.board) {
    debug('No hay estado de tablero para mostrar');
    return;
  }
  
  let boardStr = '\n';
  for (let row = 0; row < 8; row++) {
    let rowStr = '';
    for (let col = 0; col < 8; col++) {
      const cell = gameState.board[row][col];
      const isBlackCell = (row + col) % 2 !== 0;
      
      // Usar caracteres diferentes para cada tipo de pieza
      if (cell === 0) {
        rowStr += isBlackCell ? '□ ' : '· ';
      } else if (cell === 1) {
        rowStr += 'W '; // Pieza blanca (jugador)
      } else if (cell === 2) {
        rowStr += 'B '; // Pieza negra (IA)
      } else if (cell === 3) {
        rowStr += 'K '; // Rey blanco
      } else if (cell === 4) {
        rowStr += 'Q '; // Rey negro
      }
    }
    boardStr += rowStr + '\n';
  }
  
  debug(boardStr);
}