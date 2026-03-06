# Member Profile Processor

A service that processes Marathon Match competition events to update member profiles and calculate ratings.

Round lookup for MM calculation follows the legacy mapping through `project_info` (`project_info_type_id = 56`): `legacyId/projectId -> roundId`.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start local dependencies**
   ```bash
   docker compose up -d postgres zookeeper kafka
   ```

3. **Setup database**
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   npm run db:seed
   ```

4. **Start the service**
   ```bash
   npm run dev
   ```

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/ratings_db
DATABASE_URL_DW=postgresql://postgres:password@localhost:5432/ratings_db
KAFKA_URL=localhost:9092
KAFKA_GROUP_ID=member-profile-processor-group-consumer
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
V5_API_URL=http://localhost:3001
```

For local Docker Compose, `DATABASE_URL` and `DATABASE_URL_DW` can point to the same PostgreSQL database. Prisma uses the `public` schema for OLTP tables and the `dw` schema for warehouse tables.

## Development

```bash
# Start with hot reload
npm run dev

# Database operations
npm run prisma:studio
npm run db:check

# Prisma commands
npm run prisma:generate
npm run prisma:migrate
```

`kafka:autopilot` sends `projectId=40000001` by default (seeded in `project_info`).

## Local E2E Kafka Flow

This flow exercises the full Marathon Match path:
- `calculate`
- `loadCodersToDW`
- `loadRatingsToDW`

### 1. Go to the project

```bash
cd /v6/member-profile-processor-v6
```

### 2. Load env

```bash
set -a
source .env
set +a
```

### 3. Start local dependencies

```bash
docker compose up -d postgres zookeeper kafka
```

### 4. Generate Prisma client

```bash
npx prisma generate
```

### 5. Seed E2E data

```bash
# Auto-runs:
# - prisma db push --skip-generate (public)
# - prisma db push --schema prisma/dw/schema.prisma --skip-generate (dw)
npm run db:seed:e2e
```

### 6. Start app and mock API in separate terminals

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run mock:api
```

### 7. Publish the Kafka event

Terminal 3:

```bash
npm run kafka:autopilot
```

### 8. Verify database output

```bash
psql "$DATABASE_URL" -f scripts/verify-e2e.sql
```

Expected:
- All parity, leak, duplicate, and relation-integrity checks should return `0`.
- `6b) num_submissions JAVA PARITY CHECK` should return `0 rows`.

### 9. Stop services

```bash
# Stop app/mock with Ctrl+C in their terminals
docker compose stop kafka zookeeper
```

## Mock API Server

For development testing, start the mock V5 API server:

```bash
# Start mock server
npm run mock:api

# Or run directly
node scripts/mock-v5-api-server.js
```

The mock server runs on port 3001 and provides fake responses for:
- Challenge lookups
- Submission data

Set `V5_API_URL=http://localhost:3001` in your `.env` file to use the mock server.

## Project Structure

- `src/app.ts` - Main application entry point
- `src/services/` - Business logic services
- `src/common/` - Shared utilities and database connection
- `prisma/` - Database schema and migrations
- `scripts/` - Utility scripts for testing and setup
