const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  // TODO: Implement memories list endpoint
  res.json({ message: 'Memories list endpoint - TODO' });
});

router.post('/:id/share', authMiddleware, (req, res) => {
  // TODO: Implement memory sharing endpoint
  res.json({ message: 'Memory share endpoint - TODO' });
});

module.exports = router;