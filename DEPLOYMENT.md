# CrashPulse AI Deployment Guide

## Vercel Frontend

This project uses a custom server for Socket.IO. Vercel serverless deployments do not keep long-lived Socket.IO connections alive. For production realtime, deploy the full Node server on Railway, Fly.io, Render, or another Node host. You may still deploy a static/frontend-only Next.js variant to Vercel if you point it at a separate realtime backend.

Recommended production layout:

- Railway service 1: `crashpulse-ai` Node app and Socket.IO server
- Railway service 2: PostgreSQL
- Railway service 3: optional FastAPI analytics service
- Optional Vercel frontend: only if Socket.IO is hosted separately and the frontend is adapted to connect to that backend URL

## Railway Node App

1. Create a Railway project.
2. Add a PostgreSQL database.
3. Add a service from this repository.
4. Configure variables:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
NEXTAUTH_URL=https://your-node-service.up.railway.app
NEXT_PUBLIC_APP_URL=https://your-node-service.up.railway.app
NEXTAUTH_SECRET=replace-with-a-strong-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SOCKET_ALLOWED_ORIGINS=https://your-node-service.up.railway.app
ANALYTICS_SERVICE_URL=https://your-analytics-service.up.railway.app
```

5. Run migrations once:

```bash
npm run db:migrate
```

6. Deploy with `npm run start`.

## Railway Analytics Service

Create a second Railway service using `analytics-service/Dockerfile`.

Set the public URL as `ANALYTICS_SERVICE_URL` on the Node app.

## Docker Compose

```bash
docker compose up --build
```

App: [http://localhost:3000](http://localhost:3000)  
Analytics: [http://localhost:8000/health](http://localhost:8000/health)

## Security Checklist

- Use a strong `NEXTAUTH_SECRET`.
- Restrict `SOCKET_ALLOWED_ORIGINS`.
- Connect only authorized data feeds.
- Keep Prisma queries parameterized through the Prisma client.
- Keep API and socket rate limits enabled.
- Store secrets in deployment environment variables, never in source control.
