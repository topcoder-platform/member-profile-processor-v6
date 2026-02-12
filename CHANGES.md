# Changes vs. New code

This file summarizes the key changes made relative to the original "New code" repo and the reasons.

## 1) Rating calculation moved in‑process
- Replaced the external `/ratings/mm/calculate` API call with the in‑process Qubits calculation.
- Reason: challenge requirement.

## 2) New schema usage for MM calculation
- MM flow now uses `round`, `long_comp_result`, `algo_rating`, `coder`, and `user` from the new schema.
- Reason: these are the tables used by the original Java ratings‑calculation service.

## 3) Legacy schema retained
- Legacy/simple tables (`challenges`, `users`, `user_challenges`, `submissions`, `rating_history`) remain in Prisma.
- Prisma model names use **ProcessorUser** to map to the legacy `users` table and avoid clashing with the new-schema `User` model.
- Reason: forum guidance to keep both schemas for compatibility.

## 4) Round ID mapping
- `legacyId` from Kafka is mapped via `round.tcDirectProjectId` to find `round.id`.
- Reason: matches the original Informix mapping from project/challenge ID to round.

## 5) Qubits parity and safety
- Algorithm is ported from Java with the same provisional/non‑provisional split.
- Added a guard to skip non‑provisional run when only 1 experienced user exists (avoids NaN).

## 6) Direct post‑calc calls
- After calculation, `loadCoders` and `loadRatings` are called directly (currently stubs).
- Reason: forum guidance preferred direct calls over Kafka chaining for now.

## 7) Seeds, scripts, tests
- Seed data targets new schema tables and includes extra scenarios (attended=N, already‑rated, missing coder, single competitor).
- `db:check` and `kafka-test` updated to reflect the new schema and seed data.

## 8) tc-core-library-js dependancy
- Switched from `appirio-tech/tc-core-library-js.git#v2.6.4` to `topcoder-platform/tc-core-library-js.git#v2.6.4`