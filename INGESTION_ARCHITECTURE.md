# CrashPulse AI Realtime Ingestion Architecture

CrashPulse AI is an educational realtime analytics system for multiplier histories. It does not automate betting, guarantee predictions, bypass access controls, or implement platform circumvention.

## Runtime Paths

- `npm run dev` starts the Next.js dashboard and Socket.IO server.
- `npm run ingestion:browser` starts the persistent Playwright browser collector and stores authorized websocket multiplier telemetry through Prisma.
- `CRASH_SOURCE_WS=wss://... npm run dev` enables direct websocket ingestion through `server/ingestion/websocket-client.ts`.

## Pipeline

1. `PacketParser` decodes text, JSON, and binary websocket frames safely.
2. `EventClassifier` filters heartbeat, asset, image, profile, locale, and unrelated UI payloads.
3. `RoundExtractor` walks nested JSON and readable text packets to normalize multiplier, round id, players, bets, cashouts, timestamp, and volatility.
4. `StorageService` batches writes to PostgreSQL with Prisma `createMany`, `skipDuplicates`, retry handling, and optional rotated NDJSON backup logs.
5. `RealtimeAnalyticsEngine` computes moving averages, rolling volatility, standard deviation, entropy, streak clusters, probability buckets, trend score, and risk score.
6. `feature-engineering/dataset.ts` generates ML-ready feature rows and snapshot exports.

## Database

Apply the migration before production collection:

```bash
npx prisma migrate deploy
```

Recommended Postgres settings for high-volume collection:

- Use PgBouncer or managed connection pooling for dashboard plus collector workloads.
- Keep `Round.createdAt`, `Round.multiplier`, and `Round.roundId` indexed.
- Partition `Round` by month after tens of millions of rows.
- Use read replicas for historical dashboard queries once ingestion is sustained above thousands of rows per minute.
- Back up the database; NDJSON logs are only recovery aids, not the primary store.

## Long-Running Collection

Important environment variables:

- `DATABASE_URL`: primary PostgreSQL connection string.
- `CRASH_SOURCE_WS`: optional direct websocket source.
- `AVIATOR_TARGET_URL`: browser collector target URL.
- `PLAYWRIGHT_USER_DATA_DIR`: persistent profile path, defaults to `./.playwright-profile`.
- `INGESTION_BATCH_SIZE`: default `100`.
- `INGESTION_FLUSH_INTERVAL_MS`: default `1000`.
- `INGESTION_BACKUP_NDJSON=false`: disables backup NDJSON writes.
- `INGESTION_MAX_WS_PAYLOAD_BYTES`: default `512000`.

Monitor:

- `GET /api/admin/health` for ingestion counters, DB health, uptime, and latest analytics.
- Socket.IO `admin:health` for the same health data in the live dashboard.

## Dataset Exports

- `GET /api/datasets?format=json&limit=10000` returns feature rows.
- `GET /api/datasets?format=csv&limit=10000` downloads CSV.
- `POST /api/datasets` with `{ "format": "csv", "name": "snapshot-name" }` writes a dataset snapshot under `datasets/`.
- `POST /api/datasets` with `{ "format": "parquet" }` writes a parquet-staging artifact and records the snapshot. Install a binary Parquet writer in the analytics service to materialize true `.parquet` files at scale.

## Scaling Notes

- Run browser ingestion as a separate process/container from the dashboard in production.
- Use one ingestion writer per authorized source and one shared PostgreSQL pool.
- Keep dashboard API limits modest and query recent windows first.
- Move expensive historical feature generation to scheduled jobs when datasets exceed a few million rows.
- Prefer object storage for exported datasets and keep only metadata in `DatasetSnapshot`.
