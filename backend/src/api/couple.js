const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.get('/info', authMiddleware, (req, res) => {
  // TODO: Implement couple info endpoint
  res.json({ message: 'Couple info endpoint - TODO' });
});

router.post('/bind', authMiddleware, (req, res) => {
  // TODO: Implement couple binding endpoint
  res.json({ message: 'Couple bind endpoint - TODO' });
});

module.exports = router;