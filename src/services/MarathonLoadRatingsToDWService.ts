import { PrismaClient } from '@prisma/client';
import database from '../common/database';
import logger from '../common/logger';

const MARATHON_RATING_TYPE_ID = 3;
const OVERALL_RATING_RANK_TYPE_ID = 1;
const ACTIVE_RATING_RANK_TYPE_ID = 2;
const ROUND_LOG_TYPE_ID = 1;

const ROUND_TYPE_MARATHON = 13;
const ROUND_TYPE_MARATHON_TOURNAMENT = 19;

const MARATHON_RATING_INCREASE = 8;
const MARATHON_RATING_INCREASE_ALL = 9;
const MARATHON_CONSECUTIVE_TOP_5 = 10;
const MARATHON_CONSECUTIVE_TOP_10 = 11;

type RankType = 1 | 2;

interface CoderRatingRow {
  coderId: number;
  rating: number;
  schoolId: number;
  active: boolean;
  countryCode: string | null;
  stateCode: string | null;
}

interface RoundOrderRef {
  roundId: number;
  ratingOrder: number | null;
  calendarId: number | null;
  timeId: number | null;
}

interface StreakState {
  coderId: number;
  startRoundId: number;
  endRoundId: number;
  length: number;
  currentRating: number;
}

interface StreakRow {
  coderId: number;
  streakTypeId: number;
  startRoundId: number;
  endRoundId: number;
  length: number;
  isCurrent: boolean;
}

interface StreakInputRow {
  coderId: number;
  roundId: number;
  placed: number;
  newRating: number;
  roundTypeId: number;
}

abstract class AlgoStreak {
  protected coderId = 0;
  protected startRoundId = 0;
  protected endRoundId = 0;
  protected length = 0;

  constructor(private readonly streakTypeId: number) { }

  add(inputCoderId: number, roundId: number, placed: number, rating: number, roundTypeId: number): StreakRow | null {
    let flushed: StreakRow | null = null;

    if (this.coderId !== inputCoderId) {
      flushed = this.flushInternal(true);
      this.length = 0;
      this.coderId = inputCoderId;
      this.reset();
    }

    if (this.skipRound(roundTypeId)) {
      return flushed;
    }

    if (this.addToStreak(placed, rating)) {
      if (this.length === 0) {
        this.startRoundId = roundId;
      }
      this.endRoundId = roundId;
      this.length += 1;
    } else {
      if (this.length > 1) {
        flushed = this.flushInternal(false);
      }
      this.length = 0;
    }

    return flushed;
  }

  flush(): StreakRow | null {
    return this.flushInternal(true);
  }

  protected skipRound(roundTypeId: number): boolean {
    void roundTypeId;
    return false;
  }

  protected abstract addToStreak(placed: number, rating: number): boolean;

  protected reset(): void {
    // no-op
  }

  private flushInternal(isCurrent: boolean): StreakRow | null {
    if (this.length <= 1) {
      return null;
    }

    return {
      coderId: this.coderId,
      streakTypeId: this.streakTypeId,
      startRoundId: this.startRoundId,
      endRoundId: this.endRoundId,
      length: this.length,
      isCurrent
    };
  }
}

class RatingIncreaseAllStreak extends AlgoStreak {
  private streakState: StreakState = {
    coderId: 0,
    startRoundId: 0,
    endRoundId: 0,
    length: 0,
    currentRating: -1
  };

  constructor(streakTypeId: number = MARATHON_RATING_INCREASE_ALL) {
    super(streakTypeId);
  }

  protected addToStreak(_placed: number, rating: number): boolean {
    const accept = this.streakState.currentRating >= 0 && rating > this.streakState.currentRating;
    this.streakState.currentRating = rating;
    return accept;
  }

  protected reset(): void {
    this.streakState.currentRating = -1;
  }
}

class RatingIncreaseStreak extends RatingIncreaseAllStreak {
  constructor() {
    super(MARATHON_RATING_INCREASE);
  }

  protected skipRound(roundTypeId: number): boolean {
    return roundTypeId === ROUND_TYPE_MARATHON_TOURNAMENT;
  }
}

class Top5Streak extends AlgoStreak {
  constructor() {
    super(MARATHON_CONSECUTIVE_TOP_5);
  }

  protected addToStreak(placed: number): boolean {
    return placed > 0 && placed <= 5;
  }
}

class Top10Streak extends AlgoStreak {
  constructor() {
    super(MARATHON_CONSECUTIVE_TOP_10);
  }

  protected addToStreak(placed: number): boolean {
    return placed > 0 && placed <= 10;
  }
}

class MarathonLoadRatingsToDWService {
  private readonly publicPrisma: PrismaClient;
  private readonly dwPrisma: PrismaClient;

  private readonly PUBLIC_SCHEMA = 'public';
  private readonly DW_SCHEMA = 'dw';

  private readonly roundStartCache = new Map<number, Date>();

  constructor(prismaClient?: PrismaClient) {
    this.publicPrisma = prismaClient ?? database.getPublicClient();
    this.dwPrisma = database.getDwClient();
  }

  async loadRatingsToDW(roundId: number): Promise<void> {
    const startedAt = new Date();
    try {
      logger.info(`=== start load ratings to DW for round ${roundId} ===`);

      await this.getLastUpdateTime();
      await this.clearRound(roundId);
      await this.loadContest(roundId);
      await this.loadRound(roundId);
      await this.loadProblem(roundId);
      await this.loadProblemCategory(roundId);
      await this.loadProblemSubmission(roundId);
      await this.loadSystemTestCase(roundId);
      await this.loadSystemTestResult(roundId);
      await this.loadResult(roundId);

      if (await this.isRated(roundId)) {
        await this.loadRating(roundId);
        await this.clearHistory(roundId);

        const previousRoundId = await this.getPreviousRound(roundId);
        if (previousRoundId !== null) {
          await this.copyHistory(previousRoundId, roundId);
        }

        await this.loadHistory(roundId);

        const ratings = await this.getRatingsForRound(roundId, MARATHON_RATING_TYPE_ID);

        await this.loadRatingRank(roundId, OVERALL_RATING_RANK_TYPE_ID, MARATHON_RATING_TYPE_ID, ratings);
        await this.loadRatingRank(roundId, ACTIVE_RATING_RANK_TYPE_ID, MARATHON_RATING_TYPE_ID, ratings);

        await this.loadRatingRankHistory(roundId, OVERALL_RATING_RANK_TYPE_ID, MARATHON_RATING_TYPE_ID, ratings);
        await this.loadRatingRankHistory(roundId, ACTIVE_RATING_RANK_TYPE_ID, MARATHON_RATING_TYPE_ID, ratings);

        await this.loadCountryRatingRank(roundId, OVERALL_RATING_RANK_TYPE_ID, MARATHON_RATING_TYPE_ID, ratings);
        await this.loadCountryRatingRank(roundId, ACTIVE_RATING_RANK_TYPE_ID, MARATHON_RATING_TYPE_ID, ratings);

        await this.loadStateRatingRank(roundId, OVERALL_RATING_RANK_TYPE_ID, MARATHON_RATING_TYPE_ID, ratings);
        await this.loadStateRatingRank(roundId, ACTIVE_RATING_RANK_TYPE_ID, MARATHON_RATING_TYPE_ID, ratings);

        await this.loadSchoolRatingRank(roundId, OVERALL_RATING_RANK_TYPE_ID, MARATHON_RATING_TYPE_ID, ratings);
        await this.loadSchoolRatingRank(roundId, ACTIVE_RATING_RANK_TYPE_ID, MARATHON_RATING_TYPE_ID, ratings);

        await this.loadStreaks();
      } else {
        logger.info(`*** round ${roundId} is not rated, skipping rating related loads`);
      }

      await this.setLastUpdateTime(startedAt);
      logger.info(`=== complete load ratings to DW for round ${roundId} ===`);
    } catch (error) {
      logger.error(`Failed to run the Marathon Ratings for round ${roundId}`, { error });
    }
  }

  private async getLastUpdateTime(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{ timestamp: Date | null }>(`
        SELECT ul.timestamp
        FROM ${this.tbl(this.DW_SCHEMA, 'update_log')} ul
        WHERE ul.log_id = (
          SELECT MAX(log_id)
          FROM ${this.tbl(this.DW_SCHEMA, 'update_log')}
          WHERE log_type_id = $1
        )
      `, [ROUND_LOG_TYPE_ID]);

      if (!rows[0]?.timestamp) {
        throw new Error('Last log time not found in dw.update_log');
      }

      logger.info(`Last update_log timestamp found: ${rows[0].timestamp.toISOString()}`);
    } catch (error) {
      logger.error('Failed to retrieve last log time', { error });
      throw error;
    }
  }

  private async clearRound(roundId: number): Promise<void> {
    logger.info(`=== start: clearRound (${roundId}) ===`);
    try {
      const deleteSystemTestCase = await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'system_test_case')} stc
        WHERE stc.component_id IN (
          SELECT rc.component_id
          FROM ${this.tbl(this.DW_SCHEMA, 'round_component')} rc
          WHERE rc.round_id = $1
        )
      `, [roundId]);

      const deleteSystemTestResult = await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'long_system_test_result')}
        WHERE round_id = $1
      `, [roundId]);

      const deleteProblemSubmission = await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'long_problem_submission')}
        WHERE round_id = $1
      `, [roundId]);

      const deleteProblemCategory = await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'problem_category_xref')} pcx
        WHERE pcx.problem_id IN (
          SELECT DISTINCT c.problem_id
          FROM ${this.tbl(this.DW_SCHEMA, 'round_component')} rc
          JOIN ${this.tbl(this.DW_SCHEMA, 'component')} c
            ON c.id = rc.component_id
          WHERE rc.round_id = $1
            AND c.problem_id IS NOT NULL
        )
      `, [roundId]);

      const deleteRoundComponent = await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'round_component')}
        WHERE round_id = $1
      `, [roundId]);

      const deleteLongCompResult = await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'long_comp_result')}
        WHERE round_id = $1
      `, [roundId]);

      logger.info('clearRound completed', {
        roundId,
        deleteSystemTestResult,
        deleteProblemSubmission,
        deleteSystemTestCase,
        deleteProblemCategory,
        deleteRoundComponent,
        deleteLongCompResult
      });
    } catch (error) {
      logger.error(`clearing data failed for round ${roundId}`, { error });
      throw error;
    }
  }

  private async loadContest(roundId: number): Promise<void> {
    logger.info(`=== start: loadContest (${roundId}) ===`);
    try {
      const sourceRows = await this.queryPublicRows<{
        id: number;
        name: string | null;
        start_date: Date | null;
        end_date: Date | null;
        status: string | null;
        group_id: number | null;
      }>(`
      SELECT
        c.id,
        c.name,
        c.start_date,
        c.end_date,
        c.status,
        c.group_id
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'contest')} c
      JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'round')} r
        ON r.contest_id = c.id
      WHERE r.id = $1
    `, [roundId]);

      let count = 0;
      for (const row of sourceRows) {
        const exists = await this.queryPublicRows<{ marker: number }>(`
        SELECT 1 AS marker
        FROM ${this.tbl(this.DW_SCHEMA, 'contest')}
        WHERE id = $1
      `, [row.id]);

        let affected = 0;
        if (exists.length > 0) {
          affected = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'contest')}
          SET
            name = $1,
            start_date = $2,
            end_date = $3,
            status = $4,
            group_id = $5
          WHERE id = $6
        `, [row.name, row.start_date, row.end_date, row.status, row.group_id, row.id]);
        } else {
          affected = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'contest')} (
            id,
            name,
            start_date,
            end_date,
            status,
            group_id
          )
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [row.id, row.name, row.start_date, row.end_date, row.status, row.group_id]);
        }

        if (affected !== 1) {
          throw new Error(`loadContest expected exactly one affected row for contest ${row.id}, got ${affected}`);
        }

        count += affected;
        logger.info(`... loaded ${count} rows for contest table ...`);
      }

      logger.info(`contest records copied = ${count}`);
    } catch (error) {
      logger.error(`load of 'contest' table failed for round ${roundId}`, { error });
      throw error;
    }
  }

  private async loadRound(roundId: number): Promise<void> {
    logger.info(`=== start: loadRound (${roundId}) ===`);
    try {
      const rows = await this.queryPublicRows<{
        id: number;
        contest_id: number | null;
        name: string | null;
        status: string | null;
        start_date: Date | null;
        failed: number | null;
        round_type_id: number | null;
        invitational: number | null;
        notes: string | null;
        round_type_desc: string | null;
        short_name: string | null;
        forum_id: number | null;
        rated_ind: number | null;
      }>(`
      SELECT
        r.id,
        r.contest_id,
        r.name,
        r.status,
        c.start_date,
        0 AS failed,
        r.round_type_id,
        r.invitational,
        r.notes,
        (
          SELECT rtlu.round_type_desc
          FROM ${this.tbl(this.PUBLIC_SCHEMA, 'round_type_lu')} rtlu
          WHERE rtlu.id = r.round_type_id
        ) AS round_type_desc,
        r.short_name,
        r.forum_id,
        r.rated_ind
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'round')} r
      JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'contest')} c
        ON c.id = r.contest_id
      WHERE r.id = $1
    `, [roundId]);

      if (rows.length === 0) {
        throw new Error(`Round ${roundId} not found in public.round`);
      }

      const row = rows[0];

      if (!row.start_date) {
        throw new Error(`Round ${roundId} does not have contest start_date`);
      }

      const calendarId = await this.lookupCalendarId(row.start_date);
      const timeId = await this.lookupTimeId(row.start_date);

      const exists = await this.queryPublicRows<{ marker: number }>(`
      SELECT 1 AS marker
      FROM ${this.tbl(this.DW_SCHEMA, 'round')}
      WHERE id = $1
    `, [row.id]);
      const newRound = exists.length === 0;
      const ratingOrder = await this.resolveRatingOrder(row.id, this.toNumber(row.rated_ind) === 1, newRound);
      const failed = this.toNumber(row.failed ?? 0);

      let affected = 0;
      if (!newRound) {
        affected = await this.executeDw(`
        UPDATE ${this.tbl(this.DW_SCHEMA, 'round')}
        SET
          contest_id = $1,
          name = $2,
          status = $3,
          calendar_id = $4,
          failed = $5,
          round_type_id = $6,
          invitational = $7,
          notes = $8,
          round_type_desc = $9,
          short_name = $10,
          forum_id = $11,
          rated_ind = $12,
          time_id = $13,
          rating_order = $14
        WHERE id = $15
        `, [
          row.contest_id,
          row.name,
          row.status,
          calendarId,
          failed,
          row.round_type_id,
          row.invitational,
          row.notes,
          row.round_type_desc,
          row.short_name,
          row.forum_id,
          row.rated_ind,
          timeId,
          ratingOrder,
          row.id
        ]);
      } else {
        affected = await this.executeDw(`
        INSERT INTO ${this.tbl(this.DW_SCHEMA, 'round')} (
          id,
          contest_id,
          name,
          status,
          calendar_id,
          failed,
          round_type_id,
          invitational,
          notes,
          round_type_desc,
          short_name,
          forum_id,
          rated_ind,
          time_id,
          rating_order
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `, [
          row.id,
          row.contest_id,
          row.name,
          row.status,
          calendarId,
          failed,
          row.round_type_id,
          row.invitational,
          row.notes,
          row.round_type_desc,
          row.short_name,
          row.forum_id,
          row.rated_ind,
          timeId,
          ratingOrder
        ]);
      }

      if (affected !== 1) {
        throw new Error(`loadRound expected exactly one affected row for round ${row.id}, got ${affected}`);
      }

      logger.info(`round records copied = ${affected}`);
    } catch (error) {
      logger.error(`load of round table failed for round ${roundId}`, { error });
    }
  }

  private async loadProblem(roundId: number): Promise<void> {
    logger.info(`=== start: loadProblem (${roundId}) ===`);
    try {
      const rows = await this.queryPublicRows<{
        round_id: number;
        component_id: number;
        division_id: number | null;
        difficulty_id: number | null;
        points: unknown;
        problem_id: number | null;
        result_type_id: number | null;
        method_name: string | null;
        class_name: string | null;
        default_solution: string | null;
        component_text: string | null;
        component_status_id: number | null;
        component_modify_date: Date | null;
        problem_name: string | null;
        problem_status_id: number | null;
        problem_text: string | null;
        problem_modify_date: Date | null;
      }>(`
      SELECT
        rc.round_id,
        rc.component_id,
        rc.division_id,
        rc.difficulty_id,
        rc.points,
        c.problem_id,
        c.result_type_id,
        c.method_name,
        c.class_name,
        c.default_solution,
        c.component_text,
        c.status_id AS component_status_id,
        c.modify_date AS component_modify_date,
        p.name AS problem_name,
        p.status_id AS problem_status_id,
        p.problem_text,
        p.modify_date AS problem_modify_date
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'round_component')} rc
      JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'component')} c
        ON c.id = rc.component_id
      LEFT JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'problem')} p
        ON p.id = c.problem_id
      WHERE rc.round_id = $1
      ORDER BY rc.component_id, rc.division_id NULLS FIRST
    `, [roundId]);

      let problemCount = 0;
      let componentCount = 0;
      let roundComponentCount = 0;

      for (const row of rows) {
        if (row.problem_id !== null) {
          const problemExists = await this.queryPublicRows<{ marker: number }>(`
          SELECT 1 AS marker
          FROM ${this.tbl(this.DW_SCHEMA, 'problem')}
          WHERE id = $1
        `, [row.problem_id]);

          const affectedProblem = problemExists.length > 0
            ? await this.executeDw(`
              UPDATE ${this.tbl(this.DW_SCHEMA, 'problem')}
              SET
                name = $1,
                status_id = $2,
                problem_text = $3,
                modify_date = $4
              WHERE id = $5
            `, [
              row.problem_name,
              row.problem_status_id,
              row.problem_text,
              row.problem_modify_date,
              row.problem_id
            ])
            : await this.executeDw(`
              INSERT INTO ${this.tbl(this.DW_SCHEMA, 'problem')} (
                id,
                name,
                status_id,
                problem_text,
                modify_date
              )
              VALUES ($1,$2,$3,$4,$5)
            `, [
              row.problem_id,
              row.problem_name,
              row.problem_status_id,
              row.problem_text,
              row.problem_modify_date
            ]);

          if (affectedProblem !== 1) {
            throw new Error(`loadProblem expected one affected row for problem ${row.problem_id}, got ${affectedProblem}`);
          }
          problemCount += 1;
        }

        const componentExists = await this.queryPublicRows<{ marker: number }>(`
        SELECT 1 AS marker
        FROM ${this.tbl(this.DW_SCHEMA, 'component')}
        WHERE id = $1
      `, [row.component_id]);

        const affectedComponent = componentExists.length > 0
          ? await this.executeDw(`
            UPDATE ${this.tbl(this.DW_SCHEMA, 'component')}
            SET
              problem_id = $1,
              result_type_id = $2,
              method_name = $3,
              class_name = $4,
              default_solution = $5,
              component_text = $6,
              status_id = $7,
              modify_date = $8
            WHERE id = $9
          `, [
            row.problem_id,
            row.result_type_id,
            row.method_name,
            row.class_name,
            row.default_solution,
            row.component_text,
            row.component_status_id,
            row.component_modify_date,
            row.component_id
          ])
          : await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'component')} (
              id,
              problem_id,
              result_type_id,
              method_name,
              class_name,
              default_solution,
              component_text,
              status_id,
              modify_date
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          `, [
            row.component_id,
            row.problem_id,
            row.result_type_id,
            row.method_name,
            row.class_name,
            row.default_solution,
            row.component_text,
            row.component_status_id,
            row.component_modify_date
          ]);

        if (affectedComponent !== 1) {
          throw new Error(`loadProblem expected one affected row for component ${row.component_id}, got ${affectedComponent}`);
        }
        componentCount += 1;

        const roundComponentExists = await this.queryPublicRows<{ id: number }>(`
        SELECT rc.id
        FROM ${this.tbl(this.DW_SCHEMA, 'round_component')} rc
        WHERE rc.round_id = $1
          AND rc.component_id = $2
          AND (
            (rc.division_id IS NULL AND $3::int IS NULL)
            OR rc.division_id = $3
          )
        LIMIT 1
      `, [row.round_id, row.component_id, row.division_id]);

        const affectedRoundComponent = roundComponentExists.length > 0
          ? await this.executeDw(`
            UPDATE ${this.tbl(this.DW_SCHEMA, 'round_component')}
            SET
              difficulty_id = $1,
              points = $2
            WHERE id = $3
          `, [
            row.difficulty_id,
            row.points,
            roundComponentExists[0].id
          ])
          : await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'round_component')} (
              round_id,
              component_id,
              division_id,
              difficulty_id,
              points
            )
            VALUES ($1,$2,$3,$4,$5)
          `, [
            row.round_id,
            row.component_id,
            row.division_id,
            row.difficulty_id,
            row.points
          ]);

        if (affectedRoundComponent !== 1) {
          throw new Error(
            `loadProblem expected one affected row for round_component (${row.round_id},${row.component_id},${row.division_id}), got ${affectedRoundComponent}`
          );
        }
        roundComponentCount += 1;
      }

      logger.info('problem records copied', {
        roundId,
        problemCount,
        componentCount,
        roundComponentCount
      });
    } catch (error) {
      logger.error(`load of problem table failed for round ${roundId}`, { error });
    }
  }

  private async loadProblemCategory(roundId: number): Promise<void> {
    logger.info(`=== start: loadProblemCategory (${roundId}) ===`);
    try {
      const targetProblems = await this.queryPublicRows<{ problem_id: number }>(`
      SELECT DISTINCT c.problem_id
      FROM ${this.tbl(this.DW_SCHEMA, 'round_component')} rc
      JOIN ${this.tbl(this.DW_SCHEMA, 'component')} c
        ON c.id = rc.component_id
      WHERE rc.round_id = $1
        AND c.problem_id IS NOT NULL
    `, [roundId]);

      const problemIds = targetProblems.map((row) => this.toNumber(row.problem_id));
      if (problemIds.length > 0) {
        await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'problem_category_xref')}
        WHERE problem_id = ANY($1::int[])
      `, [problemIds]);
      }

      // Java parity note: old source used component_category_xref; normalized schema uses problem_category_xref relation.
      const sourceRows = await this.queryPublicRows<{
        problem_id: number;
        category_id: number;
      }>(`
      SELECT DISTINCT
        psrc.problem_id,
        psrc.category_id
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'problem_category_xref')} psrc
      JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'component')} c
        ON c.problem_id = psrc.problem_id
      JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'round_component')} rc
        ON rc.component_id = c.id
      WHERE rc.round_id = $1
        AND c.problem_id IS NOT NULL
      ORDER BY psrc.problem_id, psrc.category_id
    `, [roundId]);

      let count = 0;
      for (const row of sourceRows) {
        const exists = await this.queryPublicRows<{ marker: number }>(`
        SELECT 1 AS marker
        FROM ${this.tbl(this.DW_SCHEMA, 'problem_category_xref')}
        WHERE problem_id = $1
          AND category_id = $2
      `, [row.problem_id, row.category_id]);

        if (exists.length > 0) {
          continue;
        }

        const inserted = await this.executeDw(`
        INSERT INTO ${this.tbl(this.DW_SCHEMA, 'problem_category_xref')} (
          problem_id,
          category_id
        )
        VALUES ($1,$2)
      `, [row.problem_id, row.category_id]);

        if (inserted !== 1) {
          throw new Error(
            `loadProblemCategory expected one inserted row for (${row.problem_id},${row.category_id}), got ${inserted}`
          );
        }
        count += inserted;
        logger.info(`... loaded ${count} rows for problem_category_xref table ...`);
      }

      logger.info(`problem_category_xref records copied = ${count}`);
    } catch (error) {
      logger.error(`load of problem problem_category_xref failed for round ${roundId}`, { error });
    }
  }

  private async loadProblemSubmission(roundId: number): Promise<void> {
    logger.info(`=== start: loadProblemSubmission (${roundId}) ===`);
    try {
      const exclusion = await this.buildAdminExclusionClause('cs.coder_id');

      const rows = await this.queryPublicRows<{
        round_id: number;
        coder_id: number;
        component_id: number;
        final_points: unknown;
        status_id: number | null;
        cs_submission_number: number | null;
        s_submission_number: number | null;
        submission_text: string | null;
        submission_points: unknown;
        submission_open_time: Date | null;
        submit_time: Date | null;
        s_language_id: number | null;
        status_desc: string | null;
        example: number | null;
        c_language_id: number | null;
        compilation_text: string | null;
      }>(`
      SELECT
        cs.round_id,
        cs.coder_id,
        cs.component_id,
        cs.points AS final_points,
        cs.status_id,
        cs.submission_number AS cs_submission_number,
        s.submission_number AS s_submission_number,
        s.submission_text,
        s.submission_points,
        s.open_time AS submission_open_time,
        s.submit_time,
        s.language_id AS s_language_id,
        (
          SELECT psl.problem_status_desc
          FROM ${this.tbl(this.PUBLIC_SCHEMA, 'problem_status_lu')} psl
          WHERE psl.id = cs.status_id
        ) AS status_desc,
        s.example,
        c.language_id AS c_language_id,
        c.compilation_text
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'long_component_state')} cs
      LEFT JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'long_submission')} s
        ON s.round_id = cs.round_id
       AND s.coder_id = cs.coder_id
       AND s.component_id = cs.component_id
       AND s.submission_number = cs.submission_number
      LEFT JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'long_compilation')} c
        ON c.round_id = cs.round_id
       AND c.coder_id = cs.coder_id
       AND c.component_id = cs.component_id
       AND c.submission_number = cs.submission_number
      WHERE cs.round_id = $1
        ${exclusion}
      ORDER BY
        cs.coder_id,
        cs.component_id,
        cs.submission_number,
        s.example
    `, [roundId]);

      let count = 0;
      for (const row of rows) {
        const submissionNumber = row.s_submission_number ?? 0;
        const csSubmissionNumber = row.cs_submission_number ?? 0;
        const lastSubmission = csSubmissionNumber > 0 && csSubmissionNumber === submissionNumber ? 1 : 0;
        const statusId = this.toNumber(row.status_id ?? 0);
        const example = this.toNumber(row.example ?? 0);
        const submissionText = !row.submission_text || row.submission_text.length === 0
          ? row.compilation_text
          : row.submission_text;
        const languageId = row.s_language_id ?? row.c_language_id;

        await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'long_problem_submission')}
        WHERE round_id = $1
          AND coder_id = $2
          AND component_id = $3
          AND submission_number = $4
          AND example = $5
      `, [row.round_id, row.coder_id, row.component_id, submissionNumber, example]);

        // Java parity: persist final_points/status_desc/last_submission in DW output row.
        const inserted = await this.executeDw(`
        INSERT INTO ${this.tbl(this.DW_SCHEMA, 'long_problem_submission')} (
          round_id,
          coder_id,
          component_id,
          submission_number,
          final_points,
          status_id,
          submission_text,
          open_time,
          submit_time,
          submission_points,
          status_desc,
          last_submission,
          language_id,
          example
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `, [
          row.round_id,
          row.coder_id,
          row.component_id,
          submissionNumber,
          row.final_points,
          statusId,
          submissionText,
          row.submission_open_time,
          row.submit_time,
          row.submission_points,
          row.status_desc,
          lastSubmission,
          languageId,
          example
        ]);

        if (inserted !== 1) {
          throw new Error(
            `loadProblemSubmission expected one inserted row for (${row.round_id},${row.coder_id},${row.component_id},${submissionNumber},${example}), got ${inserted}`
          );
        }
        count += inserted;
        logger.info(`... loaded ${count} rows for long_problem_submission table ...`);
      }

      logger.info(`long_problem_submission records copied = ${count}`);
    } catch (error) {
      logger.error(`load of problem_submission failed for round ${roundId}`, { error });
    }
  }

  private async loadSystemTestCase(roundId: number): Promise<void> {
    logger.info(`=== start: loadSystemTestCase (${roundId}) ===`);
    try {
      const rows = await this.queryPublicRows<{
        component_id: number;
        test_case_id: number;
        args: string | null;
        expected_result: string | null;
        modify_date: Date | null;
        example: number | null;
        system_flag: number | null;
      }>(`
        SELECT
          stc.component_id,
          stc.test_case_id,
          stc.args,
          stc.expected_result,
          stc.modify_date,
          stc.example,
          stc.system_flag
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'system_test_case')} stc
        JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'round_component')} rc
          ON rc.component_id = stc.component_id
        WHERE rc.round_id = $1
          AND stc.status = 1
        ORDER BY stc.component_id, stc.test_case_id
      `, [roundId]);

      let count = 0;
      for (const row of rows) {
        const example = this.toNumber(row.example ?? 0);
        const systemFlag = this.toNumber(row.system_flag ?? 0);

        await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'system_test_case')}
        WHERE component_id = $1
          AND test_case_id = $2
      `, [row.component_id, row.test_case_id]);

        const inserted = await this.executeDw(`
        INSERT INTO ${this.tbl(this.DW_SCHEMA, 'system_test_case')} (
          component_id,
          test_case_id,
          args,
          expected_result,
          modify_date,
          example_flag,
          system_flag
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
          row.component_id,
          row.test_case_id,
          row.args,
          row.expected_result,
          row.modify_date,
          example,
          systemFlag
        ]);

        if (inserted !== 1) {
          throw new Error(`loadSystemTestCase expected one inserted row for (${row.component_id},${row.test_case_id}), got ${inserted}`);
        }
        count += inserted;
        logger.info(`... loaded ${count} rows for system_test_case table ...`);
      }

      logger.info(`system_test_case records copied = ${count}`);
    } catch (error) {
      logger.error(`load of system_test_case failed for round ${roundId}`, { error });
    }
  }

  private async loadSystemTestResult(roundId: number): Promise<void> {
    logger.info(`=== start: loadSystemTestResult (${roundId}) ===`);
    try {
      const exclusion = await this.buildAdminExclusionClause('str.coder_id');

      const rows = await this.queryPublicRows<{
        round_id: number;
        coder_id: number;
        component_id: number;
        test_case_id: number;
        submission_number: number;
        example: number | null;
        test_action: string | number | null;
        fatal_errors: Buffer | null;
        score: unknown;
        processing_time: number | null;
        timestamp: Date | null;
      }>(`
      SELECT
        str.round_id,
        str.coder_id,
        str.component_id,
        str.test_case_id,
        str.submission_number,
        str.example,
        str.test_action,
        str.fatal_errors,
        str.score,
        str.processing_time,
        str.timestamp
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'long_system_test_result')} str
      WHERE str.round_id = $1
        ${exclusion}
      ORDER BY str.coder_id, str.component_id, str.test_case_id, str.submission_number, str.example
    `, [roundId]);

      let count = 0;
      for (const row of rows) {
        const example = this.toNumber(row.example ?? 0);

        await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'long_system_test_result')}
        WHERE round_id = $1
          AND coder_id = $2
          AND component_id = $3
          AND test_case_id = $4
          AND submission_number = $5
          AND example = $6
      `, [row.round_id, row.coder_id, row.component_id, row.test_case_id, row.submission_number, example]);

        const fatal = row.fatal_errors === null ? 0 : 1;
        const testAction = row.test_action === null ? null : String(row.test_action);

        const inserted = await this.executeDw(`
        INSERT INTO ${this.tbl(this.DW_SCHEMA, 'long_system_test_result')} (
          round_id,
          coder_id,
          component_id,
          test_case_id,
          submission_number,
          example,
          processing_time,
          timestamp,
          fatal_errors,
          score,
          test_action,
          fatal
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
          row.round_id,
          row.coder_id,
          row.component_id,
          row.test_case_id,
          row.submission_number,
          example,
          row.processing_time,
          row.timestamp,
          row.fatal_errors,
          row.score,
          testAction,
          fatal
        ]);

        if (inserted !== 1) {
          throw new Error(
            `loadSystemTestResult expected one inserted row for (${row.round_id},${row.coder_id},${row.component_id},${row.test_case_id},${row.submission_number}), got ${inserted}`
          );
        }
        count += inserted;
        logger.info(`... loaded ${count} rows for long_system_test_result table ...`);
      }

      logger.info(`long_system_test_result records copied = ${count}`);
    } catch (error) {
      logger.error(`load of long_system_test_result failed for round ${roundId}`, { error });
    }
  }

  private async resolveRoundComponentId(roundId: number): Promise<number> {
    const rows = await this.queryPublicRows<{ component_id: number }>(`
      SELECT DISTINCT rc.component_id
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'round_component')} rc
      WHERE rc.round_id = $1
      ORDER BY rc.component_id
    `, [roundId]);

    if (rows.length !== 1) {
      throw new Error(
        `loadResult expected exactly one round_component for round ${roundId}, found ${rows.length}`
      );
    }

    return this.toNumber(rows[0].component_id);
  }

  private async loadResult(roundId: number): Promise<void> {
    logger.info(`=== start: loadResult (${roundId}) ===`);
    try {
      const exclusion = await this.buildAdminExclusionClause('rr.coder_id');
      const componentId = await this.resolveRoundComponentId(roundId);

      const previousNumRatingsByCoder = new Map<number, number>();
      const previousNumRatingRows = await this.queryPublicRows<{
        coder_id: number;
        prev_num_ratings: number | null;
      }>(`
      SELECT
        lcr.coder_id,
        MAX(COALESCE(lcr.num_ratings, 0))::int AS prev_num_ratings
      FROM ${this.tbl(this.DW_SCHEMA, 'round')} r1
      JOIN ${this.tbl(this.DW_SCHEMA, 'round')} r2
        ON r2.rating_order < r1.rating_order
      JOIN ${this.tbl(this.DW_SCHEMA, 'round_type_lu')} rt1
        ON rt1.id = r1.round_type_id
      JOIN ${this.tbl(this.DW_SCHEMA, 'round_type_lu')} rt2
        ON rt2.id = r2.round_type_id
      JOIN ${this.tbl(this.DW_SCHEMA, 'long_comp_result')} lcr
        ON lcr.round_id = r2.id
      WHERE r1.id = $1
        AND rt1.algo_rating_type_id = rt2.algo_rating_type_id
      GROUP BY lcr.coder_id
    `, [roundId]);

      for (const row of previousNumRatingRows) {
        previousNumRatingsByCoder.set(this.toNumber(row.coder_id), this.toNumber(row.prev_num_ratings ?? 0));
      }

      const sourceRows = await this.queryPublicRows<{
        round_id: number;
        coder_id: number;
        placed: number | null;
        point_total: unknown;
        system_point_total: unknown;
        num_submissions: number | null;
        attended: string | null;
        old_rating: number | null;
        new_rating: number | null;
        old_vol: number | null;
        new_vol: number | null;
        rated: number | null;
        advanced: string | null;
      }>(`
      SELECT
        rr.round_id,
        rr.coder_id,
        rr.placed,
        rr.point_total,
        rr.system_point_total,
        lcs.submission_number AS num_submissions,
        rr.attended,
        rr.old_rating,
        rr.new_rating,
        rr.old_vol,
        rr.new_vol,
        rr.rated,
        rr.advanced
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'long_comp_result')} rr
      JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'long_component_state')} lcs
        ON lcs.round_id = rr.round_id
       AND lcs.coder_id = rr.coder_id
       AND lcs.component_id = $2
      WHERE rr.round_id = $1
        ${exclusion}
      ORDER BY rr.point_total DESC NULLS LAST, rr.coder_id
    `, [roundId, componentId]);

      const sourceUserIds = [...new Set(sourceRows.map((row) => this.toNumber(row.coder_id)))];
      const coderByUser = await this.mapUserIdsToCoderIds(sourceUserIds);

      // Java parity note:
      // - old_rating_id/new_rating_id are legacy mirrors of old/new rating (0 -> -2)
      // - provisional_placed follows Java tie logic on point_total among attended coders
      // - num_ratings is previous max + 1 when current row is rated
      let count = 0;
      let provisionalRank = 0;
      let provisionalRankNoTie = 0;
      let provisionalScore: number | null = null;

      for (const row of sourceRows) {
        const sourceUserId = this.toNumber(row.coder_id);
        const coderId = coderByUser.get(sourceUserId);
        if (!coderId) {
          logger.warn(`Skipping loadResult row for user ${sourceUserId}: no public.coder row found.`);
          continue;
        }
        const attended = (row.attended ?? '').toUpperCase();
        const pointTotal = row.point_total === null ? null : this.toNumber(row.point_total);
        const rated = this.toNumber(row.rated ?? 0);

        let provisionalPlaced: number | null = null;
        if (attended === 'Y') {
          provisionalRankNoTie += 1;
          if (provisionalScore === null || pointTotal !== provisionalScore) {
            provisionalRank = provisionalRankNoTie;
          }
          provisionalScore = pointTotal;
          provisionalPlaced = provisionalRank;
        }

        const oldRating = row.old_rating ?? null;
        const newRating = row.new_rating ?? null;
        const oldRatingId = (oldRating ?? 0) === 0 ? -2 : oldRating;
        const newRatingId = (newRating ?? 0) === 0 ? -2 : newRating;

        const previousNumRatings = previousNumRatingsByCoder.get(coderId) ?? 0;
        const numRatings = previousNumRatings + (rated === 1 ? 1 : 0);
        const numSubmissions = row.num_submissions;

        const inserted = await this.executeDw(`
        INSERT INTO ${this.tbl(this.DW_SCHEMA, 'long_comp_result')} (
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
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `, [
          row.round_id,
          coderId,
          row.placed,
          row.point_total,
          row.system_point_total,
          numSubmissions,
          row.attended,
          oldRating,
          newRating,
          oldRatingId,
          newRatingId,
          row.old_vol,
          row.new_vol,
          rated,
          row.advanced,
          provisionalPlaced,
          numRatings
        ]);

        if (inserted !== 1) {
          throw new Error(`loadResult expected one inserted row for (${row.round_id},${coderId}), got ${inserted}`);
        }
        count += inserted;
        logger.info(`... loaded ${count} rows for long_comp_result table ...`);
      }

      logger.info(`long_comp_result records copied = ${count}`);
    } catch (error) {
      logger.error(`load of long_comp_result failed for round ${roundId}`, { error });
    }
  }

  private async isRated(roundId: number): Promise<boolean> {
    try {
      const rows = await this.queryPublicRows<{ is_rated: number }>(`
        SELECT 1 AS is_rated
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'round')}
        WHERE id = $1
          AND rated_ind = 1
      `, [roundId]);

      return rows.length > 0;
    } catch (error) {
      logger.error(`could not check if round ${roundId} was rated or not`, { error });
      return false;
    }
  }

  private async loadRating(roundId: number): Promise<void> {
    logger.info(`=== start: loadRating (${roundId}) ===`);
    try {
      const ratedRound = await this.isRated(roundId);
      if (!ratedRound) {
        logger.info(`Round ${roundId} is not rated. Skipping loadRating.`);
        return;
      }

      const exclusion = await this.buildAdminExclusionClause('lcr.coder_id');

      const participants = await this.queryPublicRows<{ coder_id: number }>(`
        SELECT lcr.coder_id
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'long_comp_result')} lcr
        WHERE lcr.round_id = $1
          AND lcr.attended = 'Y'
          AND lcr.rated = 1
          ${exclusion}
      `, [roundId]);

      if (participants.length === 0) {
        logger.info(`No rated participants found for round ${roundId}.`);
        return;
      }

      const userIds = participants.map((entry) => this.toNumber(entry.coder_id));
      const coderByUser = await this.mapUserIdsToCoderIds(userIds);

      let count = 0;
      for (const participant of participants) {
        const userId = this.toNumber(participant.coder_id);
        const dwCoderId = coderByUser.get(userId);

        if (!dwCoderId) {
          logger.warn(`Skipping loadRating update for user ${userId}: no public.coder row found.`);
          continue;
        }

        const ratedRoundRows = await this.queryPublicRows<{
          first_rated_round_id: number | null;
          last_rated_round_id: number | null;
        }>(`
          SELECT
            ar.first_rated_round_id,
            ar.last_rated_round_id
          FROM ${this.tbl(this.DW_SCHEMA, 'algo_rating')} ar
          WHERE ar.coder_id = $1
            AND ar.algo_rating_type_id = $2
        `, [dwCoderId, MARATHON_RATING_TYPE_ID]);

        let firstRatedRoundId = ratedRoundRows[0]?.first_rated_round_id ?? null;
        let lastRatedRoundId = ratedRoundRows[0]?.last_rated_round_id ?? null;

        const numCompetitionRows = await this.queryPublicRows<{ num_competitions: number }>(`
          SELECT COUNT(*)::int AS num_competitions
          FROM ${this.tbl(this.DW_SCHEMA, 'long_comp_result')}
          WHERE coder_id = $1
            AND attended = 'Y'
        `, [dwCoderId]);
        const numCompetitions = numCompetitionRows[0]?.num_competitions ?? 0;

        const minMaxRows = await this.queryPublicRows<{
          lowest_rating: number | null;
          highest_rating: number | null;
        }>(`
          SELECT
            MIN(new_rating) AS lowest_rating,
            MAX(new_rating) AS highest_rating
          FROM ${this.tbl(this.DW_SCHEMA, 'long_comp_result')}
          WHERE coder_id = $1
            AND attended = 'Y'
            AND rated = 1
            AND new_rating > 0
        `, [dwCoderId]);

        const lowestRating = minMaxRows[0]?.lowest_rating ?? null;
        const highestRating = minMaxRows[0]?.highest_rating ?? null;

        if (firstRatedRoundId === null || (await this.compareRoundStart(roundId, firstRatedRoundId)) < 0) {
          firstRatedRoundId = roundId;
        }

        if (lastRatedRoundId === null || (await this.compareRoundStart(roundId, lastRatedRoundId)) > 0) {
          lastRatedRoundId = roundId;
        }

        const updated = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'algo_rating')}
          SET
            first_rated_round_id = $1,
            last_rated_round_id = $2,
            lowest_rating = $3,
            highest_rating = $4,
            num_competitions = $5
          WHERE coder_id = $6
            AND algo_rating_type_id = $7
        `, [
          firstRatedRoundId,
          lastRatedRoundId,
          lowestRating,
          highestRating,
          numCompetitions,
          dwCoderId,
          MARATHON_RATING_TYPE_ID
        ]);

        if (updated === 0) {
          throw new Error(
            `loadRating: no algo_rating row found for coder ${dwCoderId} (user ${userId}), ` +
            `algo_rating_type_id ${MARATHON_RATING_TYPE_ID}. ` +
            `Row must exist before loadRatingsToDW is called — verify coder seeding.`
          );
        }

        count += updated;
      }

      logger.info(`rating records updated = ${count}`);
    } catch (error) {
      logger.error(`load of algo_rating failed for round ${roundId}`, { error });
    }
  }

  private async clearHistory(roundId: number): Promise<void> {
    try {
      await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'algo_rating_history')}
        WHERE round_id = $1
      `, [roundId]);
    } catch (error) {
      logger.error(`error in clearHistory for round ${roundId}`, { error });
      throw error;
    }
  }

  private async getPreviousRound(roundId: number): Promise<number | null> {
    try {
      const previousRows = await this.queryPublicRows<{ round_id: number }>(`
        SELECT r1.id AS round_id
        FROM ${this.tbl(this.DW_SCHEMA, 'round')} r1
        JOIN ${this.tbl(this.DW_SCHEMA, 'round_type_lu')} rt1
          ON rt1.id = r1.round_type_id
        JOIN ${this.tbl(this.DW_SCHEMA, 'round')} r2
          ON r1.rating_order = r2.rating_order - 1
        WHERE rt1.algo_rating_type_id = $1
          AND r2.id = $2
        LIMIT 1
      `, [MARATHON_RATING_TYPE_ID, roundId]);

      if (previousRows.length === 0) {
        return null;
      }

      return this.toNumber(previousRows[0].round_id);
    } catch (error) {
      logger.error(`error in getPreviousRound for round ${roundId}`, { error });
      throw error;
    }
  }

  private async copyHistory(previousRoundId: number, roundId: number): Promise<void> {
    logger.info(`Copying algo_rating_history from round ${previousRoundId} to round ${roundId}`);
    try {
      const sourceRows = await this.queryPublicRows<{
        coder_id: number;
        algo_rating_type_id: number;
        rating: number;
        vol: number;
        num_ratings: number;
      }>(`
        SELECT
          coder_id,
          algo_rating_type_id,
          rating,
          vol,
          num_ratings
        FROM ${this.tbl(this.DW_SCHEMA, 'algo_rating_history')}
        WHERE round_id = $1
      `, [previousRoundId]);

      let count = 0;
      for (const row of sourceRows) {
        const inserted = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'algo_rating_history')} (
            coder_id,
            round_id,
            algo_rating_type_id,
            rating,
            vol,
            num_ratings
          )
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [
          row.coder_id,
          roundId,
          row.algo_rating_type_id,
          row.rating,
          row.vol,
          row.num_ratings
        ]);

        if (inserted !== 1) {
          throw new Error(
            `copyHistory expected one inserted row for coder ${row.coder_id}, round ${roundId}, got ${inserted}`
          );
        }
        count += inserted;
      }

      logger.info(`algo_rating_history copied rows: ${count}`);
    } catch (error) {
      logger.error(`error in copyHistory for round ${roundId}`, { error });
      throw error;
    }
  }

  private async loadHistory(roundId: number): Promise<void> {
    logger.info(`=== start: loadHistory (${roundId}) ===`);
    try {
      const rows = await this.queryPublicRows<{
        coder_id: number;
        new_rating: number | null;
        new_vol: number | null;
      }>(`
        SELECT
          lcr.coder_id,
          lcr.new_rating,
          lcr.new_vol
        FROM ${this.tbl(this.DW_SCHEMA, 'long_comp_result')} lcr
        WHERE lcr.round_id = $1
          AND lcr.rated = 1
      `, [roundId]);

      if (rows.length === 0) {
        logger.info(`No rated rows found in dw.long_comp_result for round ${roundId}.`);
        return;
      }

      let count = 0;
      for (const row of rows) {
        // Java parity: JDBC getInt() returns 0 for NULL, so we must process all rows
        const newRating = row.new_rating ?? 0;
        const newVol = row.new_vol ?? 0;
        const dwCoderId = this.toNumber(row.coder_id);

        const updated = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'algo_rating_history')}
          SET
            rating = $1,
            vol = $2,
            num_ratings = num_ratings + 1
          WHERE round_id = $3
            AND coder_id = $4
        `, [newRating, newVol, roundId, dwCoderId]);

        if (updated === 0) {
          await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'algo_rating_history')} (
              coder_id,
              round_id,
              algo_rating_type_id,
              rating,
              vol,
              num_ratings
            )
            VALUES ($1,$2,$3,$4,$5,1)
          `, [dwCoderId, roundId, MARATHON_RATING_TYPE_ID, newRating, newVol]);
        }

        count += 1;
      }

      logger.info(`algo_rating_history inserted/updated rows: ${count}`);
    } catch (error) {
      logger.error('error in loadHistory', { error });
      throw error;
    }
  }

  private async getRatingsForRound(roundId: number, algoTypeId: number): Promise<CoderRatingRow[]> {
    try {
      const currentRoundRows = await this.queryPublicRows<{ round_date: Date | null }>(`
        SELECT cal.date AS round_date
        FROM ${this.tbl(this.DW_SCHEMA, 'round')} r
        LEFT JOIN ${this.tbl(this.DW_SCHEMA, 'calendar')} cal
          ON cal.calendar_id = r.calendar_id
        WHERE r.id = $1
      `, [roundId]);
      const currentRoundDate = currentRoundRows[0]?.round_date ?? null;

      const rows = await this.queryPublicRows<{
        coder_id: number;
        rating: number;
        school_id: number | null;
        coder_type_id: number | null;
        country_code: string | null;
        state_code: string | null;
      }>(`
        SELECT
          arh.coder_id,
          arh.rating,
          cs.school_id,
          c.coder_type_id,
          c.comp_country_code AS country_code,
          c.state_code
        FROM ${this.tbl(this.DW_SCHEMA, 'algo_rating_history')} arh
        JOIN ${this.tbl(this.DW_SCHEMA, 'coder')} c
          ON c.id = arh.coder_id
        LEFT JOIN ${this.tbl(this.DW_SCHEMA, 'current_school')} cs
          ON cs.coder_id = arh.coder_id
        JOIN ${this.tbl(this.DW_SCHEMA, 'user')} u
          ON u.id = c.user_id
        WHERE arh.round_id = $1
          AND arh.algo_rating_type_id = $2
          AND arh.num_ratings > 0
          AND u.status = 'A'
      `, [roundId, algoTypeId]);

      const result: CoderRatingRow[] = [];
      for (const row of rows) {
        const activeRows = await this.queryPublicRows<{ marker: number }>(`
          SELECT 1 AS marker
          FROM ${this.tbl(this.DW_SCHEMA, 'long_comp_result')} lcr
          JOIN ${this.tbl(this.DW_SCHEMA, 'round')} r
            ON r.id = lcr.round_id
          JOIN ${this.tbl(this.DW_SCHEMA, 'round_type_lu')} rt
            ON rt.id = r.round_type_id
          LEFT JOIN ${this.tbl(this.DW_SCHEMA, 'calendar')} cal
            ON cal.calendar_id = r.calendar_id
          WHERE lcr.coder_id = $1
            AND lcr.attended = 'Y'
            AND lcr.rated = 1
            AND rt.algo_rating_type_id = $2
            AND (
              $3::date IS NULL
              OR (
                cal.date <= $3::date
                AND cal.date >= ($3::date - INTERVAL '180 days')
              )
            )
          LIMIT 1
        `, [row.coder_id, algoTypeId, currentRoundDate]);

        result.push({
          coderId: this.toNumber(row.coder_id),
          rating: this.toNumber(row.rating),
          schoolId: this.toNumber(row.coder_type_id) === 2 ? 0 : this.toNumber(row.school_id ?? 0),
          active: activeRows.length > 0,
          countryCode: row.country_code,
          stateCode: row.state_code
        });
      }

      return result;
    } catch (error) {
      logger.error(`get list of current ratings failed for round ${roundId}`, { error });
      return [];
    }
  }

  private async loadRatingRank(
    roundId: number,
    rankType: RankType,
    ratingType: number,
    list: CoderRatingRow[]
  ): Promise<void> {
    logger.info(`loadRatingRank called for round ${roundId}, rankType ${rankType}`);
    try {
      const ratings = this.filterAndSortRatings(list, rankType);

      await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'coder_rank')}
        WHERE coder_rank_type_id = $1
          AND algo_rating_type_id = $2
      `, [rankType, ratingType]);

      let count = 0;
      const coderCount = ratings.length;
      let rank = 0;
      let currentRating = Number.NaN;

      for (let i = 0; i < ratings.length; i += 1) {
        const row = ratings[i];
        if (row.rating !== currentRating) {
          currentRating = row.rating;
          rank = i + 1;
        }

        const percentile = coderCount === 0 ? 0 : 100 * ((coderCount - rank) / coderCount);

        await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'coder_rank')} (
            coder_id,
            percentile,
            rank,
            coder_rank_type_id,
            algo_rating_type_id
          )
          VALUES ($1,$2,$3,$4,$5)
        `, [row.coderId, percentile, rank, rankType, ratingType]);
        count += 1;
      }

      logger.info(`records loaded for coder_rank: ${count}`);
    } catch (error) {
      logger.error(`load of 'coder_rank' table failed for overall rating rank for round ${roundId}`, { error });
    }
  }

  private async loadRatingRankHistory(
    roundId: number,
    rankType: RankType,
    ratingType: number,
    list: CoderRatingRow[]
  ): Promise<void> {
    logger.info(`loadRatingRankHistory called for round ${roundId}, rankType ${rankType}`);
    try {
      const ratings = this.filterAndSortRatings(list, rankType);

      await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'coder_rank_history')}
        WHERE round_id = $1
          AND coder_rank_type_id = $2
          AND algo_rating_type_id = $3
      `, [roundId, rankType, ratingType]);

      let count = 0;
      const coderCount = ratings.length;
      let rank = 0;
      let currentRating = Number.NaN;

      for (let i = 0; i < ratings.length; i += 1) {
        const row = ratings[i];
        if (row.rating !== currentRating) {
          currentRating = row.rating;
          rank = i + 1;
        }

        const percentile = coderCount === 0 ? 0 : 100 * ((coderCount - rank) / coderCount);

        await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'coder_rank_history')} (
            coder_id,
            round_id,
            percentile,
            rank,
            coder_rank_type_id,
            algo_rating_type_id
          )
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [row.coderId, roundId, percentile, rank, rankType, ratingType]);
        count += 1;
      }

      logger.info(`records loaded for coder_rank_history: ${count}`);
    } catch (error) {
      logger.error(`load of 'coder_rank_history' table failed for rating rank for round ${roundId}`, { error });
    }
  }

  private async loadCountryRatingRank(
    roundId: number,
    rankType: RankType,
    ratingType: number,
    list: CoderRatingRow[]
  ): Promise<void> {
    try {
      await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'country_coder_rank')}
        WHERE coder_rank_type_id = $1
          AND algo_rating_type_id = $2
      `, [rankType, ratingType]);

      const sourceRatings = rankType === ACTIVE_RATING_RANK_TYPE_ID ? list.filter((entry) => entry.active) : list;

      const byCountry = new Map<string | null, CoderRatingRow[]>();
      for (const row of sourceRatings) {
        const entries = byCountry.get(row.countryCode) ?? [];
        entries.push(row);
        byCountry.set(row.countryCode, entries);
      }

      let count = 0;
      for (const [countryCode, ratings] of byCountry.entries()) {
        const sorted = this.sortRatings(ratings);
        let rank = 0;
        let currentRating = Number.NaN;
        const coderCount = sorted.length;

        for (let i = 0; i < sorted.length; i += 1) {
          const row = sorted[i];
          if (row.rating !== currentRating) {
            currentRating = row.rating;
            rank = i + 1;
          }

          const rankNoTie = i + 1;
          const percentile = coderCount === 0 ? 0 : 100 * ((coderCount - rank) / coderCount);

          await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'country_coder_rank')} (
              coder_id,
              country_code,
              percentile,
              rank,
              rank_no_tie,
              coder_rank_type_id,
              algo_rating_type_id
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `, [row.coderId, countryCode, percentile, rank, rankNoTie, rankType, ratingType]);
          count += 1;
        }
      }

      logger.info(`records loaded for country_coder_rank: ${count}`);
    } catch (error) {
      logger.error(`load of 'country_coder_rank' table failed for round ${roundId}`, { error });
    }
  }

  private async loadStateRatingRank(
    roundId: number,
    rankType: RankType,
    ratingType: number,
    list: CoderRatingRow[]
  ): Promise<void> {
    try {
      await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'state_coder_rank')}
        WHERE coder_rank_type_id = $1
          AND algo_rating_type_id = $2
      `, [rankType, ratingType]);

      const sourceRatings = rankType === ACTIVE_RATING_RANK_TYPE_ID ? list.filter((entry) => entry.active) : list;

      const byState = new Map<string, CoderRatingRow[]>();
      for (const row of sourceRatings) {
        if (!row.stateCode || row.stateCode.trim().length === 0) {
          continue;
        }
        const entries = byState.get(row.stateCode) ?? [];
        entries.push(row);
        byState.set(row.stateCode, entries);
      }

      let count = 0;
      for (const [stateCode, ratings] of byState.entries()) {
        const sorted = this.sortRatings(ratings);
        let rank = 0;
        let currentRating = Number.NaN;
        const coderCount = sorted.length;

        for (let i = 0; i < sorted.length; i += 1) {
          const row = sorted[i];
          if (row.rating !== currentRating) {
            currentRating = row.rating;
            rank = i + 1;
          }

          const rankNoTie = i + 1;
          const percentile = coderCount === 0 ? 0 : 100 * ((coderCount - rank) / coderCount);

          await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'state_coder_rank')} (
              coder_id,
              state_code,
              percentile,
              rank,
              rank_no_tie,
              coder_rank_type_id,
              algo_rating_type_id
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `, [row.coderId, stateCode, percentile, rank, rankNoTie, rankType, ratingType]);
          count += 1;
        }
      }

      logger.info(`records loaded for state_coder_rank: ${count}`);
    } catch (error) {
      logger.error(`load of 'state_coder_rank' table failed for rating rank for round ${roundId}`, { error });
    }
  }

  private async loadSchoolRatingRank(
    roundId: number,
    rankType: RankType,
    ratingType: number,
    list: CoderRatingRow[]
  ): Promise<void> {
    try {
      await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'school_coder_rank')}
        WHERE coder_rank_type_id = $1
          AND algo_rating_type_id = $2
      `, [rankType, ratingType]);

      const sourceRatings = rankType === ACTIVE_RATING_RANK_TYPE_ID ? list.filter((entry) => entry.active) : list;

      const bySchool = new Map<number, CoderRatingRow[]>();
      for (const row of sourceRatings) {
        if (row.schoolId <= 0) {
          continue;
        }
        const entries = bySchool.get(row.schoolId) ?? [];
        entries.push(row);
        bySchool.set(row.schoolId, entries);
      }

      let count = 0;
      for (const [schoolId, ratings] of bySchool.entries()) {
        const sorted = this.sortRatings(ratings);
        let rank = 0;
        let currentRating = Number.NaN;
        const coderCount = sorted.length;

        for (let i = 0; i < sorted.length; i += 1) {
          const row = sorted[i];
          if (row.rating !== currentRating) {
            currentRating = row.rating;
            rank = i + 1;
          }

          const rankNoTie = i + 1;
          const percentile = coderCount === 0 ? 0 : 100 * ((coderCount - rank) / coderCount);

          await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'school_coder_rank')} (
              coder_id,
              school_id,
              percentile,
              rank,
              rank_no_tie,
              coder_rank_type_id,
              algo_rating_type_id
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `, [row.coderId, schoolId, percentile, rank, rankNoTie, rankType, ratingType]);
          count += 1;
        }
      }

      logger.info(`records loaded for school_coder_rank: ${count}`);
    } catch (error) {
      logger.error(`load of 'school_coder_rank' table failed for rating rank for round ${roundId}`, { error });
    }
  }

  private async loadStreaks(): Promise<void> {
    logger.info('=== start: loadStreaks ===');
    try {
      await this.executeDw(`
        DELETE FROM ${this.tbl(this.DW_SCHEMA, 'streak')}
        WHERE streak_type_id IN ($1,$2,$3,$4)
      `, [
        MARATHON_RATING_INCREASE,
        MARATHON_RATING_INCREASE_ALL,
        MARATHON_CONSECUTIVE_TOP_5,
        MARATHON_CONSECUTIVE_TOP_10
      ]);

      const rows = await this.queryPublicRows<{
        coder_id: number;
        round_id: number;
        placed: number | null;
        new_rating: number | null;
        round_type_id: number;
      }>(`
        SELECT
          lcr.coder_id,
          lcr.round_id,
          lcr.placed,
          lcr.new_rating,
          r.round_type_id
        FROM ${this.tbl(this.DW_SCHEMA, 'long_comp_result')} lcr
        JOIN ${this.tbl(this.DW_SCHEMA, 'round')} r
          ON r.id = lcr.round_id
        WHERE r.round_type_id IN ($1,$2)
          AND lcr.attended = 'Y'
          AND lcr.rated = 1
        ORDER BY lcr.coder_id, r.calendar_id
      `, [ROUND_TYPE_MARATHON, ROUND_TYPE_MARATHON_TOURNAMENT]);

      const streaks: AlgoStreak[] = [
        new RatingIncreaseStreak(),
        new RatingIncreaseAllStreak(),
        new Top5Streak(),
        new Top10Streak()
      ];

      const inserts: StreakRow[] = [];

      const normalizedRows: StreakInputRow[] = rows.map((row) => ({
        coderId: this.toNumber(row.coder_id),
        roundId: this.toNumber(row.round_id),
        placed: this.toNumber(row.placed ?? 0),
        newRating: this.toNumber(row.new_rating ?? 0),
        roundTypeId: this.toNumber(row.round_type_id)
      }));

      for (const row of normalizedRows) {
        for (const streak of streaks) {
          const flushed = streak.add(row.coderId, row.roundId, row.placed, row.newRating, row.roundTypeId);
          if (flushed) {
            inserts.push(flushed);
          }
        }
      }

      for (const streak of streaks) {
        const flushed = streak.flush();
        if (flushed) {
          inserts.push(flushed);
        }
      }

      let count = 0;
      for (const streak of inserts) {
        await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'streak')} (
            coder_id,
            streak_type_id,
            start_round_id,
            end_round_id,
            length,
            is_active
          )
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [
          streak.coderId,
          streak.streakTypeId,
          streak.startRoundId,
          streak.endRoundId,
          streak.length,
          streak.isCurrent ? 1 : 0
        ]);
        count += 1;
      }

      logger.info(`loaded ${count} records for streaks`);
    } catch (error) {
      logger.error("load of 'streak' table failed", { error });
    }
  }

  private async setLastUpdateTime(startedAt: Date): Promise<void> {
    try {
      const calendarId = await this.lookupCalendarId(startedAt);

      await this.executeDw(`
        INSERT INTO ${this.tbl(this.DW_SCHEMA, 'update_log')} (
          calendar_id,
          timestamp,
          log_type_id
        )
        VALUES ($1,$2,$3)
      `, [calendarId, startedAt, ROUND_LOG_TYPE_ID]);
    } catch (error) {
      logger.error('failed to set last log time', { error });
    }
  }

  private filterAndSortRatings(list: CoderRatingRow[], rankType: RankType): CoderRatingRow[] {
    if (rankType === ACTIVE_RATING_RANK_TYPE_ID) {
      return this.sortRatings(list.filter((row) => row.active));
    }

    return this.sortRatings(list);
  }

  private sortRatings(list: CoderRatingRow[]): CoderRatingRow[] {
    return [...list].sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return a.coderId - b.coderId;
    });
  }

  private async compareRoundStart(roundA: number, roundB: number): Promise<number> {
    const startA = await this.getRoundStart(roundA);
    const startB = await this.getRoundStart(roundB);

    if (startA.getTime() < startB.getTime()) {
      return -1;
    }
    if (startA.getTime() > startB.getTime()) {
      return 1;
    }
    if (roundA < roundB) {
      return -1;
    }
    if (roundA > roundB) {
      return 1;
    }
    return 0;
  }

  private async getRoundStart(roundId: number): Promise<Date> {
    const cached = this.roundStartCache.get(roundId);
    if (cached) {
      return cached;
    }

    const rows = await this.queryPublicRows<{ start_date: Date | null }>(`
      SELECT c.start_date
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'contest')} c
      JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'round')} r
        ON r.contest_id = c.id
      WHERE r.id = $1
    `, [roundId]);

    const value = rows[0]?.start_date;
    if (!value) {
      throw new Error(`Unable to determine contest start date for round ${roundId}`);
    }

    this.roundStartCache.set(roundId, value);
    return value;
  }

  private async mapUserIdsToCoderIds(userIds: number[]): Promise<Map<number, number>> {
    if (userIds.length === 0) {
      return new Map<number, number>();
    }

    const distinct = [...new Set(userIds)];

    const rows = await this.queryPublicRows<{ id: number; user_id: number }>(`
      SELECT c.id, c.user_id
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'coder')} c
      WHERE c.user_id = ANY($1::int[])
    `, [distinct]);

    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(this.toNumber(row.user_id), this.toNumber(row.id));
    }

    return map;
  }

  private async lookupCalendarId(timestamp: Date): Promise<number> {
    const rows = await this.queryPublicRows<{ calendar_id: number }>(`
      SELECT cal.calendar_id
      FROM ${this.tbl(this.DW_SCHEMA, 'calendar')} cal
      WHERE cal.date::date = $1::date
      LIMIT 1
    `, [timestamp]);

    if (rows.length === 0) {
      throw new Error(`Unable to locate calendar_id for ${timestamp.toISOString()}`);
    }

    return this.toNumber(rows[0].calendar_id);
  }

  private async lookupTimeId(timestamp: Date): Promise<number> {
    const localMinute = timestamp.getMinutes();
    const localHour = timestamp.getHours();
    const utcMinute = timestamp.getUTCMinutes();
    const utcHour = timestamp.getUTCHours();

    // Java parity intent is time-dimension lookup by contest start time.
    // In Node/Postgres timestamp parsing, local/UTC interpretation can differ by environment.
    // Try local first, then UTC fallback to keep lookup deterministic across runtimes.
    const rows = await this.queryPublicRows<{ time_id: number }>(`
      SELECT t.time_id
      FROM ${this.tbl(this.DW_SCHEMA, 'time')} t
      WHERE (t.minute = $1 AND t.hour_24 = $2)
         OR (t.minute = $3 AND t.hour_24 = $4)
      ORDER BY CASE
        WHEN t.minute = $1 AND t.hour_24 = $2 THEN 0
        ELSE 1
      END
      LIMIT 1
    `, [localMinute, localHour, utcMinute, utcHour]);

    if (rows.length === 0) {
      throw new Error(
        `Unable to locate time_id for ${timestamp.toISOString()} (local ${localHour}:${localMinute}, utc ${utcHour}:${utcMinute})`
      );
    }

    return this.toNumber(rows[0].time_id);
  }

  private async resolveRatingOrder(roundId: number, rated: boolean, newRound: boolean): Promise<number | null> {
    if (newRound) {
      const rows = await this.queryPublicRows<{ max_rating_order: number | null }>(`
        SELECT MAX(r.rating_order)::int AS max_rating_order
        FROM ${this.tbl(this.DW_SCHEMA, 'round')} r
        JOIN ${this.tbl(this.DW_SCHEMA, 'round_type_lu')} rt
          ON rt.id = r.round_type_id
        WHERE r.rated_ind = 1
          AND rt.algo_rating_type_id = $1
      `, [MARATHON_RATING_TYPE_ID]);
      const maxRatingOrder = this.toNumber(rows[0]?.max_rating_order ?? 0);
      return rated ? maxRatingOrder + 1 : maxRatingOrder;
    }

    const rows = await this.queryPublicRows<{ max_rating_order: number | null }>(`
      SELECT MAX(r1.rating_order)::int AS max_rating_order
      FROM ${this.tbl(this.DW_SCHEMA, 'round')} r1
      JOIN ${this.tbl(this.DW_SCHEMA, 'round')} r2
        ON r2.id = $1
      JOIN ${this.tbl(this.DW_SCHEMA, 'round_type_lu')} rt1
        ON rt1.id = r1.round_type_id
      JOIN ${this.tbl(this.DW_SCHEMA, 'round_type_lu')} rt2
        ON rt2.id = r2.round_type_id
      WHERE r1.rated_ind = 1
        AND r2.rated_ind = 1
        AND rt1.algo_rating_type_id = rt2.algo_rating_type_id
        AND (
          r1.calendar_id < r2.calendar_id
          OR (
            r1.calendar_id = r2.calendar_id
            AND r1.time_id < r2.time_id
          )
          OR (
            r1.calendar_id = r2.calendar_id
            AND r1.time_id = r2.time_id
            AND r1.id < r2.id
          )
        )
    `, [roundId]);

    const maxRatingOrder = this.toNumber(rows[0]?.max_rating_order ?? 0);
    if (rated) {
      return maxRatingOrder + 1;
    }

    return maxRatingOrder > 0 ? maxRatingOrder : null;
  }

  private async buildAdminExclusionClause(userIdExpression: string): Promise<string> {
    const clauses = [
      `AND NOT EXISTS (`,
      `  SELECT 1`,
      `  FROM ${this.tbl(this.PUBLIC_SCHEMA, 'user_group_xref')} ugx`,
      `  WHERE ugx.user_id = ${userIdExpression}`,
      `    AND ugx.group_id IN (2000115, 13)`,
      `)`
    ];

    return clauses.join('\n');
  }

  private async queryPublicRows<T>(query: string, params: unknown[] = []): Promise<T[]> {
    return this.publicPrisma.$queryRawUnsafe<T[]>(query, ...params);
  }

  private async queryDwRows<T>(query: string, params: unknown[] = []): Promise<T[]> {
    return this.dwPrisma.$queryRawUnsafe<T[]>(query, ...params);
  }

  private async executePublic(query: string, params: unknown[] = []): Promise<number> {
    return this.publicPrisma.$executeRawUnsafe(query, ...params);
  }

  private async executeDw(query: string, params: unknown[] = []): Promise<number> {
    return this.dwPrisma.$executeRawUnsafe(query, ...params);
  }

  private tbl(schema: string, tableName: string): string {
    return `${schema}."${tableName}"`;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'string') {
      return Number(value);
    }
    if (value === null || value === undefined) {
      return 0;
    }
    return Number(value);
  }
}

const marathonLoadRatingsToDWService = new MarathonLoadRatingsToDWService();

export async function loadRatingsToDW(roundId: number): Promise<void> {
  await marathonLoadRatingsToDWService.loadRatingsToDW(roundId);
}

export type {
  CoderRatingRow,
  RankType,
  RoundOrderRef,
  StreakState
};

export default marathonLoadRatingsToDWService;
