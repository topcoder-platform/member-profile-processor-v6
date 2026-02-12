# 🧪 Testing Guide - Member Profile Processor

## Quick Start Testing

### 1. Start Services
```bash
# Start dependencies
docker-compose up

# Start your application  
npm run dev
```

### 2. Test Kafka Messages
```bash
# Test autopilot message (triggers calculate)
npm run kafka:autopilot

# Note: loadCoders/loadRatings are called directly after calculation (no Kafka chaining).
# The kafka:rating and kafka:coders messages are no longer required for the MM flow.

# Show help
npm run kafka:test help
```

## Full Test Flow

### Step 1: Setup Test Data
```bash
# Option 1: Full setup (migrations + seed data)
npm run db:setup

# Option 2: Just seed data (if migrations already run)
npm run db:seed
```

### Step 2: Start Mock API (optional)
```bash
# In separate terminal
npm run mock:api
```

### Step 3: Send Test Messages
```bash
# 1. Send autopilot review end message
npm run kafka:autopilot
# ✅ Should trigger: MarathonRatingsService.calculate()

# Note: loadCoders/loadRatings are invoked directly after calculate().
```

### Step 4: Check Results
```bash
npm run db:check
```

## Seed Scenarios

The seed data includes the following scenarios for validation:
- One attendee starts with attended = 'N' (should be updated to 'Y' on calculation)
- One entry has newRating/newVol already set (should be skipped)
- One user is missing a coder row (should be created automatically)
- One round has a single competitor (should be skipped by algorithm)

## Round ID Mapping

The calculation maps the legacy project ID to `round.tcDirectProjectId`. Ensure your test data
sets this field if you are using `kafka:autopilot`.

## Message Flow

```
1. autopilot   →  calculate()    →  runs Qubits + updates DB
2. calculate() →  loadCoders()   →  direct call (stub)
3. calculate() →  loadRatings()  →  direct call (stub)
```

## Troubleshooting

### Kafka Issues
```bash
# Check if Kafka is running
docker-compose ps kafka

# Check topics exist
docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Create topics manually if needed
docker-compose exec kafka kafka-topics --create --topic notifications.autopilot.events --bootstrap-server localhost:9092
docker-compose exec kafka kafka-topics --create --topic notification.rating.calculation --bootstrap-server localhost:9092
```

### Application Issues
```bash
# Check application logs
npm run dev

# Check database connection
npm run prisma:studio

# Verify test data exists
npm run db:check
```

### Common Problems

1. **"Kafka connection failed"**
   - Run: `docker-compose up kafka -d`
   - Wait 30 seconds for Kafka to start

2. **"Database connection failed"**
   - Check DATABASE_URL in .env

## Test Commands Reference

| Command | Purpose | Triggers |
|---------|---------|----------|
| `npm run kafka:autopilot` | Send autopilot review end | `calculate()` |
| `npm run kafka:rating` | (Deprecated) Send rating calculation success | - |
| `npm run kafka:coders` | (Deprecated) Send load coders success | - |
| `npm run db:seed` | Seed database with test data | - |
| `npm run db:check` | Verify database state | - |
| `npm run mock:api` | Start mock V5 API | - |
