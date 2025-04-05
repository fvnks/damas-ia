const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const gameRoutes = require('./routes/gameRoutes');
const GameController = require('./controllers/GameController');

// Función de depuración
function debug(message) {
  console.log(`[SERVER] ${message}`);
}

// Inicializar express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Mapa para almacenar las API keys de los usuarios
const userApiKeys = new Map();

// Configurar middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Configurar rutas API
app.use('/api/game', gameRoutes);

// Ruta principal
app.get('/', (req, res) => {
  debug('Solicitud a la ruta principal');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Configurar Socket.IO
io.on('connection', (socket) => {
  debug('Cliente conectado: ' + socket.id);
  
  // Cliente establece su API key
  socket.on('setApiKey', ({ apiKey }) => {
    if (!apiKey || apiKey.trim() === '') {
      return socket.emit('error', { 
        error: 'API_KEY_REQUIRED', 
        message: 'Se requiere una API key para usar la IA'
      });
    }
    
    // Guardar la API key del usuario
    userApiKeys.set(socket.id, apiKey.trim());
    debug(`API key establecida para el cliente: ${socket.id}`);
  });
  
  // Crear un nuevo juego
  socket.on('createGame', ({ apiKey }) => {
    // Verificar si se proporcionó una API key en la solicitud o si hay una guardada
    const userApiKey = apiKey || userApiKeys.get(socket.id);
    
    if (!userApiKey) {
      return socket.emit('error', { 
        error: 'API_KEY_REQUIRED', 
        message: 'Se requiere una API key para crear un juego'
      });
    }
    
    debug(`Creando juego para el cliente: ${socket.id}`);
    const sessionId = socket.id;
    const gameState = GameController.createGame(sessionId, userApiKey);
    debug(`Estado inicial del juego: ${JSON.stringify(gameState)}`);
    socket.emit('gameState', { sessionId, ...gameState });
  });
  
  // Jugador realiza un movimiento
  socket.on('playerMove', async ({ fromRow, fromCol, toRow, toCol, apiKey }) => {
    debug(`Movimiento del jugador: (${fromRow}, ${fromCol}) → (${toRow}, ${toCol})`);
    const sessionId = socket.id;
    
    // Verificar si se proporcionó una API key en la solicitud o si hay una guardada
    const userApiKey = apiKey || userApiKeys.get(socket.id);
    
    if (!userApiKey) {
      return socket.emit('error', { 
        error: 'API_KEY_REQUIRED', 
        message: 'Se requiere una API key para realizar un movimiento'
      });
    }
    
    const result = GameController.playerMove(sessionId, fromRow, fromCol, toRow, toCol);
    
    if (result.error) {
      debug(`Error en el movimiento: ${result.error}`);
      return socket.emit('error', result);
    }
    
    debug('Movimiento del jugador exitoso');
    socket.emit('gameState', { sessionId, ...result });
    
    // Si el juego no ha terminado y es turno de la IA, ejecutar el movimiento de la IA
    if (!result.gameOver && result.currentPlayer === 2) {
      debug('Iniciando turno de la IA');
      socket.emit('aiThinking', true);
      
      try {
        debug('Solicitando movimiento a la IA');
        // Pasar la API key del usuario al método aiMove
        const aiResult = await GameController.aiMove(sessionId, userApiKey);
        socket.emit('aiThinking', false);
        
        if (aiResult.error) {
          debug(`Error en movimiento de la IA: ${aiResult.error}`);
          socket.emit('error', aiResult.error);
        } else {
          debug(`Movimiento de la IA: ${JSON.stringify(aiResult.aiMove)}`);
          socket.emit('gameState', { sessionId, ...aiResult });
        }
      } catch (error) {
        debug(`Error inesperado en el turno de la IA: ${error.message}`);
        socket.emit('aiThinking', false);
        socket.emit('error', { 
          error: 'AI_ERROR', 
          message: error.message || 'Error en el movimiento de la IA'
        });
      }
    }
  });
  
  // Cliente se desconecta
  socket.on('disconnect', () => {
    debug('Cliente desconectado: ' + socket.id);
    // Eliminar la API key del usuario al desconectarse
    userApiKeys.delete(socket.id);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  debug(`Servidor iniciado en http://localhost:${PORT}`);
  debug('Presiona Ctrl+C para detener');
}); 