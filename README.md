# CrashPulse AI

CrashPulse AI is a production-oriented realtime analytics dashboard for Aviator/crash-style multiplier histories. It collects authorized live multiplier data, stores rounds, computes probability/risk statistics, simulates strategies, and offers an optional Python ML service.

Important: Probability estimate only — not guaranteed prediction. This app does not claim guaranteed wins, bypass platform protections, exploit vulnerabilities, or automate illegal betting.

## Stack

- Next.js 15 App Router, TypeScript, TailwindCSS, shadcn-style local UI components
- Socket.IO realtime server with reconnect, buffering, fallback polling, and synthetic demo mode
- Prisma ORM with PostgreSQL schema and safe in-memory fallback for first run
- Recharts and Framer Motion dashboard
- NextAuth Google login with JWT sessions
- Optional FastAPI analytics service using pandas, numpy, scipy, scikit-learn

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without `DATABASE_URL`, the app runs in demo mode with an in-memory store and synthetic educational data. To use PostgreSQL locally:

```bash
docker compose up -d postgres
copy .env.example .env
npm run db:migrate
npm run dev
```

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`: PostgreSQL connection string for Prisma
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials for NextAuth
- `NEXTAUTH_SECRET`: strong random secret
- `CRASH_SOURCE_WS`: optional authorized websocket feed
- `CRASH_SOURCE_POLL_URL`: optional authorized polling feed used as fallback
- `ANALYTICS_SERVICE_URL`: optional FastAPI ML service URL
- `SOCKET_ALLOWED_ORIGINS`: comma-separated allowed Socket.IO origins

Only connect feeds you are authorized to use.

## Scripts

- `npm run dev`: starts the custom Next.js + Socket.IO server
- `npm run build`: generates Prisma client and builds Next.js
- `npm run start`: starts production server
- `npm run db:migrate`: runs Prisma migrations
- `npm run db:studio`: opens Prisma Studio
- `npm run analytics:dev`: starts the Python analytics service if Python dependencies are installed

## Project Structure

```text
app/                    Next.js app and API routes
components/             Dashboard, charts, simulator, admin, and UI components
hooks/                  Client realtime/toast hooks
lib/                    Statistics, simulator, data store, Prisma, validation, security
server/                 Socket.IO server and live data collector
prisma/schema.prisma    PostgreSQL schema
analytics-service/      Optional FastAPI analytics and ML module
docker-compose.yml      App, Postgres, and analytics service
```

## Live Data Collection

The collector supports:

- Authorized WebSocket feed via `CRASH_SOURCE_WS`
- Fallback polling via `CRASH_SOURCE_POLL_URL`
- Auto reconnect with exponential backoff
- Batched Socket.IO dashboard updates
- Realistic crash simulation when no feed is configured

Accepted round payloads may include fields like `round_id`, `id`, `roundId`, `multiplier`, `crashPoint`, `crash_point`, `timestamp`, or `createdAt`.

The built-in simulation uses a real round lifecycle instead of rapid random inserts:

- `ROUND_WAITING`: 3 second countdown
- `ROUND_START`: flight begins at `1.00x`
- `MULTIPLIER_UPDATE`: smooth exponential multiplier updates every 50ms
- `ROUND_CRASH`: instant crash effect after an 8-15 second flight
- `ROUND_END`: 2 second reset before the next round

## Analytics

The dashboard calculates:

- MA10, MA25, MA50, MA100
- Volatility index from log multiplier dispersion
- Frequency distribution and heatmap
- Consecutive streak analysis
- Probability estimates for `<2x`, `>5x`, and `>10x`
- Trend score adjusted for volatility

Every probability surface includes the required disclaimer.

## Strategy Simulator

Supported strategies:

- Fixed cashout at 1.5x, 2x, or 3x
- Martingale with capped bet growth
- Fixed bet strategy
- Dynamic bankroll sizing

Outputs include ROI, win rate, profit/loss, equity curve, and drawdown.

## Optional ML Service

```bash
cd analytics-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The service exposes anomaly detection, clustering, volatility prediction, and trend scoring. It never claims exact crash prediction.
