const express = require('express');
const router = express.Router();
const GameController = require('../controllers/GameController');

// Ruta para iniciar un nuevo juego
router.post('/new', (req, res) => {
  const sessionId = req.body.sessionId || Date.now().toString();
  const gameState = GameController.createGame(sessionId);
  res.json({ sessionId, ...gameState });
});

// Ruta para obtener el estado actual del juego
router.get('/state/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const gameState = GameController.getGameState(sessionId);
  
  if (!gameState) {
    return res.status(404).json({ error: 'Juego no encontrado' });
  }
  
  res.json({ sessionId, ...gameState });
});

// Ruta para realizar un movimiento del jugador
router.post('/move/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { fromRow, fromCol, toRow, toCol } = req.body;
  
  if (fromRow === undefined || fromCol === undefined || toRow === undefined || toCol === undefined) {
    return res.status(400).json({ error: 'Parámetros incompletos' });
  }
  
  const result = GameController.playerMove(
    sessionId, 
    parseInt(fromRow), 
    parseInt(fromCol), 
    parseInt(toRow), 
    parseInt(toCol)
  );
  
  if (result.error) {
    return res.status(400).json(result);
  }
  
  res.json({ sessionId, ...result });
});

// Ruta para solicitar y ejecutar el movimiento de la IA
router.post('/ai-move/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const result = await GameController.aiMove(sessionId);
    
    if (result.error) {
      return res.status(400).json(result);
    }
    
    res.json({ sessionId, ...result });
  } catch (error) {
    console.error('Error en la ruta de AI move:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router; 