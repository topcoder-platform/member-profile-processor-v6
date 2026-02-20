# Member Profile Processor

A service that processes Marathon Match competition events to update member profiles and calculate ratings.

Round lookup for MM calculation follows the legacy mapping through `project_info` (`project_info_type_id = 56`): `legacyId/projectId -> roundId`.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start Kafka**
   ```bash
   docker-compose up
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
DATABASE_URL=postgresql://postgres:password@localhost:5432/member_profile_processor
KAFKA_URL=localhost:9092
KAFKA_GROUP_ID=member-profile-processor-group-consumer
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
V5_API_URL=http://localhost:3001
```

## Development

```bash
# Start with hot reload
npm run dev

# Database operations
npm run prisma:studio
npm run db:seed
npm run db:check

# Prisma commands
npm run prisma:generate
npm run prisma:migrate
```

### Test Kafka Messages
```bash
# Test autopilot message (triggers calculate)
npm run kafka:autopilot

# Note: loadCoders/loadRatings are called directly after calculation (no Kafka chaining).
# The kafka:rating and kafka:coders messages are no longer required for the MM flow.

# Show help
npm run kafka:test help
```

`kafka:autopilot` sends `projectId=40000001` by default (seeded in `project_info`).

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
