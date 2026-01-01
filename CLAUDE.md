# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**每日问答系统 (Daily QA System)** - A WeChat Mini Program for couples to strengthen their relationship through daily question exchanges. Features include daily question push at 21:00, AI-generated personalized questions, and weekly/monthly memory reports.

## Tech Stack

**Backend**: Node.js + Express.js 5.x + PostgreSQL (Sequelize ORM)
**Frontend**: Native WeChat Mini Program (WXML, WXSS, JS)
**Authentication**: JWT + bcryptjs
**Scheduled Tasks**: node-cron
**Testing**: Jest + Supertest

## Common Commands

```bash
# Backend development
cd backend && npm run dev              # nodemon with auto-restart
cd backend && npm start                # Production (node src/index.js)

# Testing
cd backend && npm test                 # Jest unit tests
cd backend && npm run test:watch       # Watch mode
cd backend && npm run test:coverage    # Coverage report

# Code quality
cd backend && npm run lint             # ESLint
cd backend && npm run lint:fix         # ESLint auto-fix
cd backend && npm run format           # Prettier
```

## Architecture

```
/backend/
├── src/
│   ├── api/           # Route handlers (auth, questions, couple, memories, user, ai)
│   ├── models/        # Sequelize models (User, Couple, Question, Answer, DailyQuestion, Memory)
│   ├── services/      # Business logic (questionService, aiService, reportService)
│   ├── tasks/         # Cron jobs for automated tasks (dailyQuestion, weekly/monthly reports)
│   ├── middleware/    # Auth, rate limiting, input validation, security
│   └── utils/         # Database, logger, websocket helpers
├── tests/             # Jest unit tests
└── ecosystem.config.js # PM2 production config

/miniprogram/          # WeChat Mini Program
├── pages/             # Home, answer, history, memories pages
└── utils/api.js       # API client wrapper
```

**Patterns**:
- RESTful API with JWT authentication middleware
- WebSocket for real-time updates between partners
- Cron jobs for scheduled daily question push at 21:00
- Service layer pattern for business logic separation

## Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Phone + code login |
| `/api/questions/today` | GET | Get today's question |
| `/api/questions/answer` | POST | Submit answer |
| `/api/couple/bind` | POST | Bind partner phone |
| `/api/memories` | GET | List memory reports |

## Documentation

- `/specs/001-daily-qa-system/spec.md` - Feature specifications
- `/specs/001-daily-qa-system/data-model.md` - Database schema
- `/IMPLEMENTATION_SUMMARY.md` - Detailed implementation notes
