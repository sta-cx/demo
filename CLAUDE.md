# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**每日问答系统 (Daily QA System)** - A WeChat Mini Program for couples to strengthen their relationship through daily question exchanges. Features include daily question push at 21:00, AI-generated personalized questions, and weekly/monthly memory reports.

## Tech Stack

**Backend**: Node.js + Express.js 5.x + PostgreSQL (pg connection pool, raw SQL)
**Frontend**: Vue 3.5 + Vite 7 (Web) + Native WeChat Mini Program
**Authentication**: JWT + bcryptjs
**Scheduled Tasks**: node-cron (daily 21:00 push, weekly/monthly reports)
**Real-time**: WebSocket (ws)
**AI Integration**: @supabase/supabase-js (心流/iFlow API)
**Testing**: Jest + Supertest
**Logging**: Winston
**Process Manager**: PM2

## Common Commands

```bash
# Backend development
cd backend && npm run dev              # nodemon with auto-restart
cd backend && npm start                # Production mode
cd backend && pm2 start ecosystem.config.js  # PM2 production
cd backend && pm2 logs our-daily-backend     # View PM2 logs

# Testing
cd backend && npm test                 # Jest unit tests
cd backend && npm run test:watch       # Watch mode
cd backend && npm run test:coverage    # Coverage report

# Code quality
cd backend && npm run lint             # ESLint
cd backend && npm run lint:fix         # ESLint auto-fix
cd backend && npm run format           # Prettier

# Web frontend (Vue 3)
cd web && npm run dev                  # Vite dev server with HMR
cd web && npm run build                # Production build
cd web && npm run preview              # Preview production build
```

## Architecture

```
/backend/
├── src/
│   ├── api/           # RESTful route handlers (auth, questions, couple, memories, user, ai)
│   ├── models/        # Data models with SQL queries (User, Couple, Question, Answer, DailyQuestion, Memory)
│   ├── services/      # Business logic layer (questionService, aiService, analysisService, reportService)
│   ├── tasks/         # Cron jobs (dailyQuestion at 21:00, weeklyReport, monthlyReport)
│   ├── middleware/    # Auth (JWT), rate limiting, security (Helmet, CORS, input validation)
│   ├── utils/         # Database pool (pg), logger (Winston), WebSocket server, iFlow API client
│   └── index.js       # Express app entry point
├── tests/             # Jest unit tests
└── ecosystem.config.js # PM2 config (500MB mem limit, auto-restart)

/web/                  # Vue 3 Web Frontend
├── src/
│   ├── api/           # Axios client with interceptors
│   ├── views/         # Page components (Login, Home, Answer, History)
│   ├── router/        # Vue Router with auth guards
│   ├── components/    # Reusable components
│   └── stores/        # Pinia state (structure ready, not yet implemented)

/miniprogram/          # WeChat Mini Program
├── pages/             # index (today), answer, history, memories
├── components/        # Reusable mini-program components
├── utils/api.js       # API client wrapper
├── app.json           # Mini-program config (tabBar navigation)
└── app.wxss           # Global styles
```

**Patterns**:
- **Service Layer**: Business logic in `/services`, separated from routes
- **Direct SQL**: PostgreSQL via pg connection pool (no ORM)
- **WebSocket Events**: `notifyNewAnswer`, `notifyQuestionCompleted` for partner sync
- **Cron Jobs**: Only start in production (`NODE_ENV=production`)
- **AI Fallback**: Falls back to preset questions if iFlow API fails
- **Smart Question Selection**: Analyzes 30-day history for sentiment-based category selection

## Key Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/health` | GET | Health check | No |
| `/api/auth/send-code` | POST | Send SMS verification code | No |
| `/api/auth/login` | POST | Phone + code login, returns JWT | No |
| `/api/questions/today` | GET | Get today's question for couple | JWT |
| `/api/questions/answer` | POST | Submit answer with sentiment analysis | JWT |
| `/api/questions/history` | GET | Get answer history | JWT |
| `/api/couple/info` | GET | Get couple relationship info | JWT |
| `/api/couple/bind` | POST | Bind partner by phone number | JWT |
| `/api/memories` | GET | List memory reports (weekly/monthly) | JWT |
| `/api/user/settings` | GET/PUT | Get/update user preferences | JWT |
| `/api/ai/generate` | POST | Manual AI question generation | JWT |

## Smart Question Selection Algorithm

Located in `backend/src/services/questionService.js:selectQuestionForCouple`:

1. Analyzes last 30 days of answers for sentiment score
2. Sentiment < 50: Selects `fun` category questions
3. Low engagement: Selects `daily` simple questions
4. Normal: Selects `emotion` relationship questions
5. AI generation: Requires minimum 7 days of history

## Database Notes

- Uses raw SQL queries with parameterized statements (SQL injection safe)
- Connection pool: max 10, min 0, 5s timeout
- Slow query logging: queries > 100ms trigger warnings
- Key index: `idx_daily_questions_couple_date` for today's question lookups
- Schema defined in `/specs/001-daily-qa-system/data-model.md`

## Environment Variables

Required in `/backend/.env`:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `IFLOW_API_KEY`, `IFLOW_BASE_URL` (心流 AI)
- `WECHAT_APPID`, `WECHAT_SECRET` (Mini-program)

## Documentation

- `/specs/001-daily-qa-system/spec.md` - Feature specifications and User Stories
- `/specs/001-daily-qa-system/data-model.md` - Database schema and ER diagrams
- `/IMPLEMENTATION_SUMMARY.md` - User Story 1 implementation notes
- `/DEVELOPMENT_PLAN.md` - 30-day development roadmap with priority tiers
