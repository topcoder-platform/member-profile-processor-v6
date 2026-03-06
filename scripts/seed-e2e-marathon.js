/**
 * E2E seed for MarathonRatingsService.calculate -> loadRatingsToDW
 *
 * - Seeds OLTP data in public schema
 * - Seeds baseline DW data in dw schema
 */

require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PUBLIC_SCHEMA = 'public';
const DW_SCHEMA = 'dw';

const MM_ALGO_RATING_TYPE_ID = 3;
const ROUND_TYPE_MARATHON = 13;
const ROUND_TYPE_MARATHON_TOURNAMENT = 19;
const PROJECT_INFO_TYPE_ROUND_ID = 56;

const PREVIOUS_ROUND_ID = 30000000;
const CURRENT_ROUND_ID = 30000001;
const PREVIOUS_CONTEST_ID = 9000;
const CURRENT_CONTEST_ID = 9001;
const LEGACY_PROJECT_ID = 40000001;

const PROBLEM_ID = 7001;
const COMPONENT_ID = 8001;
const CATEGORY_ID = 101;
const SCHOOL_ID = 1001;

const CHALLENGE_ID = '30000001-1234-5678-9abc-def123456789';

const USERS = [
  { id: 1, handle: 'bob_hacker', stateCode: 'CA', countryCode: 'US', schoolId: SCHOOL_ID },
  { id: 2, handle: 'alice_coder', stateCode: 'CA', countryCode: 'US', schoolId: SCHOOL_ID },
  { id: 3, handle: 'charlie_newbie', stateCode: 'NY', countryCode: 'US', schoolId: null },
  { id: 4, handle: 'admin_excluded', stateCode: 'CA', countryCode: 'US', schoolId: null }
];

const PUBLIC_TABLES = [
  'long_system_test_result',
  'long_submission',
  'long_compilation',
  'long_component_state',
  'system_test_case',
  'problem_category_xref',
  'round_component',
  'component',
  'problem',
  'school_coder_rank',
  'state_coder_rank',
  'country_coder_rank',
  'coder_rank_history',
  'coder_rank',
  'streak',
  'algo_rating_history',
  'algo_rating',
  'long_comp_result',
  'project_info',
  'current_school',
  'coder',
  'user_group_xref',
  'user',
  'round',
  'contest',
  'school',
  'state',
  'country',
  'round_type_lu',
  'coder_rank_type',
  'algo_rating_type',
  'update_log',
  'calendar'
];

const DW_TABLES = [
  'long_system_test_result',
  'long_problem_submission',
  'system_test_case',
  'problem_category_xref',
  'round_component',
  'component',
  'problem',
  'school_coder_rank',
  'state_coder_rank',
  'country_coder_rank',
  'coder_rank_history',
  'coder_rank',
  'streak',
  'algo_rating_history',
  'algo_rating',
  'long_comp_result',
  'round',
  'contest',
  'round_type_lu',
  'coder_rank_type',
  'algo_rating_type',
  'update_log',
  'time',
  'calendar'
];

function tbl(schema, tableName) {
  return `${schema}."${tableName}"`;
}

async function execute(query, params = []) {
  return prisma.$executeRawUnsafe(query, ...params);
}

async function queryRows(query, params = []) {
  return prisma.$queryRawUnsafe(query, ...params);
}

function toDateOnlyUtc(dateValue) {
  const date = new Date(dateValue);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(dateValue) {
  return toDateOnlyUtc(dateValue).toISOString().slice(0, 10);
}

function addDays(dateValue, days) {
  return new Date(dateValue.getTime() + (days * 24 * 60 * 60 * 1000));
}

function getCalendarParts(dateValue) {
  const date = toDateOnlyUtc(dateValue);
  const monthLong = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const dayLong = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ];
  const dayShort = [
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
  ];

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date - yearStart) / 86400000) + 1;

  return {
    year: date.getUTCFullYear(),
    monthNumeric: date.getUTCMonth() + 1,
    monthAlphaLong: monthLong[date.getUTCMonth()],
    monthAlphaShort: monthShort[date.getUTCMonth()],
    dayOfMonth: date.getUTCDate(),
    dayOfWeekNumeric: date.getUTCDay() + 1,
    dayOfWeekAlphaLong: dayLong[date.getUTCDay()],
    dayOfWeekAlphaShort: dayShort[date.getUTCDay()],
    dayOfYear,
    weekOfYear: Math.ceil(dayOfYear / 7),
    quarter: Math.floor(date.getUTCMonth() / 3) + 1,
    date
  };
}

async function truncateSchemaTables(schema, tableNames) {
  const rows = await queryRows(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = $1
        AND tablename = ANY($2::text[])
    `,
    [schema, tableNames]
  );

  if (rows.length === 0) {
    return;
  }

  const qualified = rows.map((r) => `${schema}."${r.tablename}"`).join(', ');
  await execute(`TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE`);
}

async function insertCalendars(schema, dates) {
  const ids = new Map();
  const keys = [...new Set(dates.map((d) => dayKey(d)))];
  const includeUpdatedAt = schema === PUBLIC_SCHEMA;

  for (const key of keys) {
    const date = new Date(`${key}T00:00:00.000Z`);
    const c = getCalendarParts(date);
    const rows = includeUpdatedAt
      ? await queryRows(
          `
            INSERT INTO ${tbl(schema, 'calendar')} (
              year,
              month_numeric,
              month_alpha_long,
              month_alpha_short,
              day_of_month,
              day_of_week_numeric,
              day_of_week_alpha_long,
              day_of_week_alpha_short,
              day_of_year,
              week_of_year,
              quarter,
              date,
              updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            RETURNING calendar_id
          `,
          [
            c.year,
            c.monthNumeric,
            c.monthAlphaLong,
            c.monthAlphaShort,
            c.dayOfMonth,
            c.dayOfWeekNumeric,
            c.dayOfWeekAlphaLong,
            c.dayOfWeekAlphaShort,
            c.dayOfYear,
            c.weekOfYear,
            c.quarter,
            c.date,
            new Date()
          ]
        )
      : await queryRows(
          `
            INSERT INTO ${tbl(schema, 'calendar')} (
              year,
              month_numeric,
              month_alpha_long,
              month_alpha_short,
              day_of_month,
              day_of_week_numeric,
              day_of_week_alpha_long,
              day_of_week_alpha_short,
              day_of_year,
              week_of_year,
              quarter,
              date
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING calendar_id
          `,
          [
            c.year,
            c.monthNumeric,
            c.monthAlphaLong,
            c.monthAlphaShort,
            c.dayOfMonth,
            c.dayOfWeekNumeric,
            c.dayOfWeekAlphaLong,
            c.dayOfWeekAlphaShort,
            c.dayOfYear,
            c.weekOfYear,
            c.quarter,
            c.date
          ]
        );

    ids.set(key, Number(rows[0].calendar_id));
  }

  return ids;
}

async function insertTime(schema, dateValue) {
  const hour = new Date(dateValue).getHours();
  const minute = new Date(dateValue).getMinutes();
  const existing = await queryRows(
    `
      SELECT time_id
      FROM ${tbl(schema, 'time')}
      WHERE hour_24 = $1
        AND minute = $2
      LIMIT 1
    `,
    [hour, minute]
  );

  if (existing.length > 0) {
    return Number(existing[0].time_id);
  }

  const inserted = await queryRows(
    `
      INSERT INTO ${tbl(schema, 'time')} (hour_24, minute)
      VALUES ($1, $2)
      RETURNING time_id
    `,
    [hour, minute]
  );

  return Number(inserted[0].time_id);
}

async function seedPublic(options) {
  const {
    previousContestStart,
    currentContestStart,
    previousCalendarId,
    currentCalendarId
  } = options;

  const previousContestEnd = addDays(previousContestStart, 7);
  const currentContestEnd = addDays(currentContestStart, 7);
  const submitTime = addDays(currentContestStart, 1);

  await execute(`INSERT INTO ${tbl(PUBLIC_SCHEMA, 'algo_rating_type')} (id, algo_rating_type_desc, updated_at) VALUES (3, 'Marathon Match', CURRENT_TIMESTAMP)`);
  await execute(`INSERT INTO ${tbl(PUBLIC_SCHEMA, 'coder_rank_type')} (id, coder_rank_type_desc, updated_at) VALUES (1, 'Overall', CURRENT_TIMESTAMP), (2, 'Active', CURRENT_TIMESTAMP)`);
  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'round_type_lu')} (id, round_type_desc, algo_rating_type_id, updated_at)
      VALUES
        ($1, 'Marathon Match', $3, CURRENT_TIMESTAMP),
        ($2, 'Marathon Tournament', $3, CURRENT_TIMESTAMP)
    `,
    [ROUND_TYPE_MARATHON, ROUND_TYPE_MARATHON_TOURNAMENT, MM_ALGO_RATING_TYPE_ID]
  );

  await execute(
    `INSERT INTO ${tbl(PUBLIC_SCHEMA, 'country')} (country_code, country_name, participating, modify_date, updated_at) VALUES ('US', 'United States', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  );
  await execute(
    `INSERT INTO ${tbl(PUBLIC_SCHEMA, 'state')} (state_code, state_name, modify_date, updated_at) VALUES ('CA', 'California', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), ('NY', 'New York', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  );
  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'school')} (
        school_id,
        name,
        short_name,
        state_code,
        country_code,
        modify_date,
        updated_at
      )
      VALUES ($1, 'Topcoder University', 'TCU', 'CA', 'US', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [SCHOOL_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'contest')} (id, name, start_date, end_date, status, group_id, updated_at)
      VALUES
        ($1, 'MM Previous Contest', $3, $4, 'C', 1, CURRENT_TIMESTAMP),
        ($2, 'MM Current Contest', $5, $6, 'A', 1, CURRENT_TIMESTAMP)
    `,
    [PREVIOUS_CONTEST_ID, CURRENT_CONTEST_ID, previousContestStart, previousContestEnd, currentContestStart, currentContestEnd]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'round')} (
        id,
        contest_id,
        name,
        status,
        invitational,
        round_type_id,
        short_name,
        forum_id,
        rated_ind,
        calendar_id,
        updated_at
      )
      VALUES
        ($1, $3, 'MM Previous Round', 'C', 0, $5, 'MM-PREV', 1000, 1, $7, CURRENT_TIMESTAMP),
        ($2, $4, 'MM Current Round', 'A', 0, $5, 'MM-CURR', 1001, 1, $6, CURRENT_TIMESTAMP)
    `,
    [
      PREVIOUS_ROUND_ID,
      CURRENT_ROUND_ID,
      PREVIOUS_CONTEST_ID,
      CURRENT_CONTEST_ID,
      ROUND_TYPE_MARATHON,
      currentCalendarId,
      previousCalendarId
    ]
  );

  for (const user of USERS) {
    await execute(`INSERT INTO ${tbl(PUBLIC_SCHEMA, 'user')} (id, handle, status, updated_at) VALUES ($1, $2, 'A', CURRENT_TIMESTAMP)`, [user.id, user.handle]);

    await execute(
      `
        INSERT INTO ${tbl(PUBLIC_SCHEMA, 'coder')} (id, user_id, state_code, country_code, comp_country_code, coder_type_id, updated_at)
        VALUES ($1, $1, $2, $3, $3, 1, CURRENT_TIMESTAMP)
      `,
      [user.id, user.stateCode, user.countryCode]
    );
  }

  for (const user of USERS) {
    if (!user.schoolId) {
      continue;
    }
    await execute(
      `
        INSERT INTO ${tbl(PUBLIC_SCHEMA, 'current_school')} (
          coder_id,
          school_id,
          viewable,
          modify_date,
          updated_at
        )
        VALUES ($1, $2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [user.id, user.schoolId]
    );
  }

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'project_info')} (project_id, project_info_type_id, value, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `,
    [LEGACY_PROJECT_ID, PROJECT_INFO_TYPE_ROUND_ID, CURRENT_ROUND_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'problem')} (id, name, status_id, problem_text, problem_type_id, updated_at)
      VALUES ($1, 'Seed MM Problem', NULL, 'Seeded marathon problem statement', 1, CURRENT_TIMESTAMP)
    `,
    [PROBLEM_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'component')} (
        id,
        problem_id,
        result_type_id,
        method_name,
        class_name,
        default_solution,
        component_type_id,
        component_text,
        status_id,
        updated_at
      )
      VALUES ($1, $2, 1, 'solve', 'SeedSolver', '// seed', 1, 'seed component text', 1, CURRENT_TIMESTAMP)
    `,
    [COMPONENT_ID, PROBLEM_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'round_component')} (
        round_id,
        component_id,
        submit_order,
        division_id,
        difficulty_id,
        points,
        open_order,
        updated_at
      )
      VALUES ($1, $2, 1, 1, NULL, 100.00, 1, CURRENT_TIMESTAMP)
    `,
    [CURRENT_ROUND_ID, COMPONENT_ID]
  );

  await execute(`INSERT INTO ${tbl(PUBLIC_SCHEMA, 'problem_category_xref')} (problem_id, category_id, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)`, [PROBLEM_ID, CATEGORY_ID]);

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'long_component_state')} (
        round_id,
        coder_id,
        component_id,
        points,
        status_id,
        submission_number,
        updated_at
      )
      VALUES
        ($1, 1, $2, 110.00, 1, 1, CURRENT_TIMESTAMP),
        ($1, 2, $2, 108.00, 1, 1, CURRENT_TIMESTAMP),
        ($1, 3, $2, 95.00, 1, 1, CURRENT_TIMESTAMP)
    `,
    [CURRENT_ROUND_ID, COMPONENT_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'long_submission')} (
        round_id,
        coder_id,
        component_id,
        submission_number,
        submission_text,
        open_time,
        submit_time,
        submission_points,
        language_id,
        example,
        updated_at
      )
      VALUES
        ($1, 1, $2, 1, 'code-user-1', $3, $3, 110.00, 1, 0, CURRENT_TIMESTAMP),
        ($1, 2, $2, 1, '', $3, $3, 108.00, 1, 0, CURRENT_TIMESTAMP),
        ($1, 3, $2, 1, NULL, $3, $3, 95.00, 1, 0, CURRENT_TIMESTAMP)
    `,
    [CURRENT_ROUND_ID, COMPONENT_ID, submitTime]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'long_compilation')} (
        round_id,
        coder_id,
        component_id,
        submission_number,
        open_time,
        compile_time,
        compile_status,
        language_id,
        compilation_text,
        updated_at
      )
      VALUES
        ($1, 2, $2, 1, $3, $3, 1, 1, 'compiled-user-2', CURRENT_TIMESTAMP),
        ($1, 3, $2, 1, $3, $3, 1, 1, 'compiled-user-3', CURRENT_TIMESTAMP)
    `,
    [CURRENT_ROUND_ID, COMPONENT_ID, submitTime]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'system_test_case')} (
        component_id,
        test_case_id,
        args,
        expected_result,
        status,
        example,
        system_flag,
        updated_at
      )
      VALUES ($1, 1, 'seed-args', 'seed-expected', 1, 0, 1, CURRENT_TIMESTAMP)
    `,
    [COMPONENT_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'long_system_test_result')} (
        round_id,
        coder_id,
        component_id,
        test_case_id,
        submission_number,
        test_action,
        received_value,
        score,
        processing_time,
        fatal,
        timestamp,
        viewable,
        message,
        updated_at
      )
      VALUES
        ($1, 1, $2, 1, 1, 'run', 'ok', 110.00, 20, 0, $3, 1, 'pass', CURRENT_TIMESTAMP),
        ($1, 2, $2, 1, 1, 'run', 'ok', 108.00, 22, 0, $3, 1, 'pass', CURRENT_TIMESTAMP),
        ($1, 3, $2, 1, 1, 'run', 'ok', 95.00, 25, 0, $3, 1, 'pass', CURRENT_TIMESTAMP)
    `,
    [CURRENT_ROUND_ID, COMPONENT_ID, submitTime]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'long_comp_result')} (
        round_id,
        coder_id,
        placed,
        point_total,
        system_point_total,
        num_submissions,
        attended,
        old_rating,
        new_rating,
        old_vol,
        new_vol,
        rated,
        advanced,
        updated_at
      )
      VALUES
        ($1, 1, 1, 120.00, 120.00, 2, 'Y', 1450, 1500, 260, 250, 1, 'Y', CURRENT_TIMESTAMP),
        ($1, 3, 2, 92.00, 92.00, 2, 'Y', 1250, 1300, 320, 300, 1, 'Y', CURRENT_TIMESTAMP),
        ($2, 1, 1, 110.00, 110.00, 0, 'Y', NULL, NULL, NULL, NULL, 0, 'Y', CURRENT_TIMESTAMP),
        ($2, 2, 2, 108.00, 108.00, 0, 'N', NULL, NULL, NULL, NULL, 0, 'Y', CURRENT_TIMESTAMP),
        ($2, 3, 3, 95.00, 95.00, 0, 'Y', NULL, NULL, NULL, NULL, 0, 'Y', CURRENT_TIMESTAMP)
    `,
    [PREVIOUS_ROUND_ID, CURRENT_ROUND_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'algo_rating')} (
        coder_id,
        rating,
        vol,
        num_ratings,
        algo_rating_type_id,
        highest_rating,
        lowest_rating,
        first_rated_round_id,
        last_rated_round_id,
        num_competitions,
        round_id,
        updated_at
      )
      VALUES
        (1, 1500, 250, 10, $1, 1600, 1200, $2, $2, 10, $2, CURRENT_TIMESTAMP),
        (2, 1200, 385, 0,  $1, 1200, 1200, NULL, NULL, 0, NULL, CURRENT_TIMESTAMP),
        (3, 1300, 300, 6,  $1, 1400, 1100, $2, $2, 6, $2, CURRENT_TIMESTAMP)
    `,
    [MM_ALGO_RATING_TYPE_ID, PREVIOUS_ROUND_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(PUBLIC_SCHEMA, 'user_group_xref')} (user_id, group_id, security_status_id, updated_at)
      VALUES (4, 2000115, 1, CURRENT_TIMESTAMP)
    `
  );
}

async function seedDw(options) {
  const {
    previousContestStart,
    currentContestStart,
    previousCalendarId,
    lastLogTimestamp,
    lastLogCalendarId
  } = options;

  const previousContestEnd = addDays(previousContestStart, 7);
  const previousTimeId = await insertTime(DW_SCHEMA, previousContestStart);
  await insertTime(DW_SCHEMA, currentContestStart);

  await execute(`INSERT INTO ${tbl(DW_SCHEMA, 'algo_rating_type')} (id, algo_rating_type_desc) VALUES (3, 'Marathon Match')`);
  await execute(`INSERT INTO ${tbl(DW_SCHEMA, 'coder_rank_type')} (id, coder_rank_type_desc) VALUES (1, 'Overall'), (2, 'Active')`);
  await execute(
    `
      INSERT INTO ${tbl(DW_SCHEMA, 'round_type_lu')} (id, round_type_desc, algo_rating_type_id)
      VALUES
        ($1, 'Marathon Match', $3),
        ($2, 'Marathon Tournament', $3)
    `,
    [ROUND_TYPE_MARATHON, ROUND_TYPE_MARATHON_TOURNAMENT, MM_ALGO_RATING_TYPE_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(DW_SCHEMA, 'contest')} (id, name, start_date, end_date, status, group_id)
      VALUES ($1, 'MM Previous Contest', $2, $3, 'C', 1)
    `,
    [PREVIOUS_CONTEST_ID, previousContestStart, previousContestEnd]
  );

  await execute(
    `
      INSERT INTO ${tbl(DW_SCHEMA, 'round')} (
        id,
        contest_id,
        name,
        status,
        calendar_id,
        time_id,
        failed,
        round_type_id,
        invitational,
        notes,
        round_type_desc,
        short_name,
        forum_id,
        rated_ind,
        rating_order
      )
      VALUES
        ($1, $2, 'MM Previous Round', 'C', $3, $4, 0, $5, 0, 'seed-previous-round', 'Marathon Match', 'MM-PREV', 1000, 1, 1)
    `,
    [
      PREVIOUS_ROUND_ID,
      PREVIOUS_CONTEST_ID,
      previousCalendarId,
      previousTimeId,
      ROUND_TYPE_MARATHON
    ]
  );

  await execute(
    `
      INSERT INTO ${tbl(DW_SCHEMA, 'long_comp_result')} (
        round_id,
        coder_id,
        placed,
        point_total,
        system_point_total,
        num_submissions,
        attended,
        old_rating,
        new_rating,
        old_rating_id,
        new_rating_id,
        old_vol,
        new_vol,
        rated,
        advanced,
        provisional_placed,
        num_ratings
      )
      VALUES
        ($1, 1, 1, 120.00, 120.00, 2, 'Y', 1450, 1500, 1450, 1500, 260, 250, 1, 'Y', 1, 10),
        ($1, 3, 2, 92.00, 92.00, 2, 'Y', 1250, 1300, 1250, 1300, 320, 300, 1, 'Y', 2, 6)
    `,
    [PREVIOUS_ROUND_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(DW_SCHEMA, 'algo_rating')} (
        coder_id,
        rating,
        vol,
        num_ratings,
        algo_rating_type_id,
        highest_rating,
        lowest_rating,
        first_rated_round_id,
        last_rated_round_id,
        num_competitions,
        round_id
      )
      VALUES
        (1, 1500, 250, 10, $1, 1600, 1200, $2, $2, 10, $2),
        (2, 1200, 385, 0,  $1, 1200, 1200, NULL, NULL, 0, NULL),
        (3, 1300, 300, 6,  $1, 1400, 1100, $2, $2, 6, $2)
    `,
    [MM_ALGO_RATING_TYPE_ID, PREVIOUS_ROUND_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(DW_SCHEMA, 'algo_rating_history')} (
        coder_id,
        round_id,
        algo_rating_type_id,
        rating,
        vol,
        num_ratings,
        num_competitions
      )
      VALUES
        (1, $2, $1, 1500, 250, 10, 10),
        (3, $2, $1, 1300, 300, 6, 6)
    `,
    [MM_ALGO_RATING_TYPE_ID, PREVIOUS_ROUND_ID]
  );

  await execute(
    `
      INSERT INTO ${tbl(DW_SCHEMA, 'update_log')} (calendar_id, timestamp, log_type_id)
      VALUES
        ($1, $2, 1),
        ($1, $2, 2)
    `,
    [lastLogCalendarId, lastLogTimestamp]
  );
}

async function main() {
  const now = new Date();
  const previousContestStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 10, 10, 0, 0));
  const currentContestStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10, 10, 0, 0));
  const lastLogTimestamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));

  const importantDates = [previousContestStart, currentContestStart, lastLogTimestamp, now];

  try {
    console.log('Seeding Marathon e2e dataset (public + dw)...');

    await execute(`CREATE SCHEMA IF NOT EXISTS "${DW_SCHEMA}"`);
    await truncateSchemaTables(DW_SCHEMA, DW_TABLES);
    await truncateSchemaTables(PUBLIC_SCHEMA, PUBLIC_TABLES);

    const publicCalendarIds = await insertCalendars(PUBLIC_SCHEMA, importantDates);
    const dwCalendarIds = await insertCalendars(DW_SCHEMA, importantDates);

    await seedPublic({
      previousContestStart,
      currentContestStart,
      previousCalendarId: publicCalendarIds.get(dayKey(previousContestStart)),
      currentCalendarId: publicCalendarIds.get(dayKey(currentContestStart))
    });

    await seedDw({
      previousContestStart,
      currentContestStart,
      previousCalendarId: dwCalendarIds.get(dayKey(previousContestStart)),
      lastLogTimestamp,
      lastLogCalendarId: dwCalendarIds.get(dayKey(lastLogTimestamp))
    });

    const [publicLcrCount] = await queryRows(
      `SELECT COUNT(*)::int AS count FROM ${tbl(PUBLIC_SCHEMA, 'long_comp_result')} WHERE round_id = $1`,
      [CURRENT_ROUND_ID]
    );

    const [dwRatingsLogCount] = await queryRows(
      `SELECT COUNT(*)::int AS count FROM ${tbl(DW_SCHEMA, 'update_log')} WHERE log_type_id = 1`
    );
    const [dwCodersLogCount] = await queryRows(
      `SELECT COUNT(*)::int AS count FROM ${tbl(DW_SCHEMA, 'update_log')} WHERE log_type_id = 2`
    );

    console.log('Seed completed.');
    console.log('');
    console.log(`- challengeId: ${CHALLENGE_ID}`);
    console.log(`- legacyId: ${LEGACY_PROJECT_ID}`);
    console.log(`- roundId: ${CURRENT_ROUND_ID}`);
    console.log(`- public.long_comp_result rows for round: ${publicLcrCount.count}`);
    console.log(`- dw.update_log(log_type_id=1) rows: ${dwRatingsLogCount.count}`);
    console.log(`- dw.update_log(log_type_id=2) rows: ${dwCodersLogCount.count}`);
    console.log('');
    console.log('Next steps:');
    console.log('1) Run calculate:');
    console.log(`   npx ts-node --transpile-only -e "const svc=require('./src/services/MarathonRatingsService').default; svc.calculate('${CHALLENGE_ID}', ${LEGACY_PROJECT_ID}).then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1);});"`);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
