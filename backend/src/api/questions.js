const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const QuestionService = require('../services/questionService');
const Couple = require('../models/Couple');
const logger = require('../utils/logger');

// Get today's question
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user's couple
    const couple = await Couple.findByUserId(userId);
    if (!couple) {
      return res.status(404).json({ 
        error: 'No active couple relationship found',
        code: 'COUPLE_NOT_FOUND'
      });
    }

    // Get today's question using QuestionService
    const todayQuestion = await QuestionService.getTodayQuestion(couple.id);
    
    // Determine which user is the current user
    const isUser1 = couple.user1_id === userId;
    
    // Format response according to API specification
    const response = {
      question: {
        id: todayQuestion.question.id,
        question_text: todayQuestion.question.question_text,
        category: todayQuestion.question.category,
        answer_type: todayQuestion.question.answer_type,
        choices: todayQuestion.question.choices
      },
      user_answered: isUser1 ? todayQuestion.user1_answered : todayQuestion.user2_answered,
      partner_answered: isUser1 ? todayQuestion.user2_answered : todayQuestion.user1_answered
    };

    // Include detailed answer information if available
    if (isUser1 && todayQuestion.user1_answer) {
      response.user_answer = {
        answer_text: todayQuestion.user1_answer.answer,
        media_url: todayQuestion.user1_answer.media_url,
        created_at: todayQuestion.user1_answer.created_at
      };
    } else if (!isUser1 && todayQuestion.user2_answer) {
      response.user_answer = {
        answer_text: todayQuestion.user2_answer.answer,
        media_url: todayQuestion.user2_answer.media_url,
        created_at: todayQuestion.user2_answer.created_at
      };
    }

    // Include partner's answer if available
    if (isUser1 && todayQuestion.user2_answer) {
      response.partner_answer = {
        answer_text: todayQuestion.user2_answer.answer,
        media_url: todayQuestion.user2_answer.media_url,
        created_at: todayQuestion.user2_answer.created_at
      };
    } else if (!isUser1 && todayQuestion.user1_answer) {
      response.partner_answer = {
        answer_text: todayQuestion.user1_answer.answer,
        media_url: todayQuestion.user1_answer.media_url,
        created_at: todayQuestion.user1_answer.created_at
      };
    }

    res.json(response);
  } catch (error) {
    logger.error('Get today question error:', error);
    res.status(500).json({ 
      error: 'Failed to get today question',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Submit answer
router.post('/answer', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { question_id, answer_text, media_url, answer_type } = req.body;
    
    // Validate required fields
    if (!question_id) {
      return res.status(400).json({ 
        error: 'Question ID is required',
        code: 'MISSING_QUESTION_ID'
      });
    }

    if (!answer_text && !media_url) {
      return res.status(400).json({ 
        error: 'Answer text or media URL is required',
        code: 'MISSING_ANSWER_CONTENT'
      });
    }

    // Get user's couple
    const couple = await Couple.findByUserId(userId);
    if (!couple) {
      return res.status(404).json({ 
        error: 'No active couple relationship found',
        code: 'COUPLE_NOT_FOUND'
      });
    }

    // Submit answer using QuestionService
    const answer = await QuestionService.submitAnswer(
      couple.id,
      userId,
      question_id,
      {
        answer_text,
        media_url,
        answer_type: answer_type || 'text'
      }
    );

    // TODO: Send notification to partner
    // This could be implemented using WebSocket or push notifications

    res.status(201).json({
      message: 'Answer submitted successfully',
      answer: answer.toJSON()
    });
  } catch (error) {
    logger.error('Submit answer error:', error);
    
    // Handle specific error cases
    if (error.message === 'User is not part of this couple') {
      return res.status(403).json({ 
        error: 'User is not part of this couple',
        code: 'NOT_COUPLE_MEMBER'
      });
    }
    
    if (error.message === 'Question not found') {
      return res.status(404).json({ 
        error: 'Question not found',
        code: 'QUESTION_NOT_FOUND'
      });
    }
    
    if (error.message === 'User has already answered this question') {
      return res.status(400).json({ 
        error: 'Already answered this question',
        code: 'ALREADY_ANSWERED'
      });
    }

    res.status(500).json({ 
      error: 'Failed to submit answer',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get answer history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 30;
    const offset = parseInt(req.query.offset) || 0;
    
    // Get user's couple
    const couple = await Couple.findByUserId(userId);
    if (!couple) {
      return res.status(404).json({ 
        error: 'No active couple relationship found',
        code: 'COUPLE_NOT_FOUND'
      });
    }

    // Get history using QuestionService
    const history = await QuestionService.getHistory(couple.id, limit, offset);
    
    // Get total count for pagination
    const stats = await QuestionService.getStats(couple.id);
    
    res.json({
      answers: history,
      total: stats.answers.total_answers || 0,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Get history error:', error);
    res.status(500).json({ 
      error: 'Failed to get answer history',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;