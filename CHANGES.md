# Latest Challenge Changes

## 1) RoundId lookup fixed to legacy mapping
- Updated round resolution to use `project_info` mapping:
  - `project_id = legacyId`
  - `project_info_type_id = 56`
  - `value = round_id`
- Implemented in `src/common/database.ts`.

## 2) `project_info` added to Prisma schema and migrations
- Added `ProjectInfo` model in `prisma/schema.prisma`.
- Added migration creating `project_info` table and index:
  - `prisma/migrations/20260218090000_add_project_info_table/migration.sql`.

## 3) Seed/test tooling aligned to new lookup path
- Seed now inserts `project_info` mappings and test mapping (`40054163 -> 30054163`):
  - `scripts/seed-database.js`.
- Kafka manual test now sends seeded project IDs (`40000001`, etc.):
  - `scripts/kafka-test.js`.
- DB check script now prints project-to-round mappings:
  - `scripts/check-db-data.js`.
- Mock V5 API legacy IDs updated to seeded project IDs:
  - `scripts/mock-v5-api-server.js`.

## 4) Docs updated for validation
- Updated mapping explanation and test instructions:
  - `README.md`
  - `TESTING.md`
