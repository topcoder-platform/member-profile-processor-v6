import { PrismaClient } from '@prisma/client';
import database from '../common/database';
import logger from '../common/logger';

const CODER_LOG_TYPE_ID = 2;
const HIGH_SCHOOL_TEAM_TYPE = 4;

interface LastLogWindow {
  lastLogTime: Date | null;
}

interface CoderRowNormalized {
  coder_id: number;
  user_id: number;
  state_code: string | null;
  country_code: string | null;
  comp_country_code: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  zip: string | null;
  quote: string | null;
  language_id: number | null;
  coder_type_id: number | null;
  handle: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  email: string | null;
  status: string | null;
  activation_code: string | null;
  member_since: Date | null;
  last_site_hit_date: Date | null;
  reg_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  create_date: Date | null;
}

interface SkillRow {
  skill_id: number;
  skill_type_id: number;
  skill_desc: string | null;
  status: string | null;
  skill_order: number | null;
  modify_date: Date | null;
}

interface AchievementRow {
  user_id: number;
  achievement_type_id: number;
  achievement_date: Date | null;
  description: string | null;
  achievement_type_desc: string | null;
}

interface EventRow {
  event_id: number;
  event_type_id: number;
  event_type_desc: string | null;
  event_desc: string | null;
}

class MarathonLoadCodersToDWService {
  private readonly publicPrisma: PrismaClient;
  private readonly dwPrisma: PrismaClient;

  private readonly PUBLIC_SCHEMA = 'public';
  private readonly DW_SCHEMA = 'dw';

  private readonly lastLogWindow: LastLogWindow = { lastLogTime: null };

  constructor(prismaClient?: PrismaClient) {
    this.publicPrisma = prismaClient ?? database.getPublicClient();
    this.dwPrisma = database.getDwClient();
  }

  async loadCodersToDW(roundId: number): Promise<void> {
    const startedAt = new Date();
    try {
      logger.info(`=== start load coders to DW for round ${roundId} ===`);
      await this.getLastUpdateTime();
      await this.loadState();
      await this.loadCountry();
      await this.loadCoder();
      await this.loadSkillType();
      await this.loadSkill();
      await this.loadCoderSkill();
      await this.loadRating();
      await this.loadPath();
      await this.loadImage();
      await this.loadCoderImageXref();
      await this.loadSchool();
      await this.loadCurrentSchool();
      await this.loadAchievements();
      await this.loadTeam();
      await this.loadTeamCoderXref();
      await this.loadEvent();
      await this.loadEventRegistration();
      await this.setLastUpdateTime(startedAt);
      logger.info(`=== complete load coders to DW for round ${roundId} ===`);
    } catch (error) {
      logger.error(`Failed to run the Coder load for round ${roundId}`, { error });
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
      `, [CODER_LOG_TYPE_ID]);

      if (!rows[0]?.timestamp) {
        throw new Error('Last log time not found in dw.update_log for coder load');
      }

      this.lastLogWindow.lastLogTime = rows[0].timestamp;
      logger.info(`Coder last update_log timestamp found: ${rows[0].timestamp.toISOString()}`);
    } catch (error) {
      logger.error('Failed to retrieve coder last log time', { error });
    }
  }

  private async loadState(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
        state_code: string;
        state_name: string;
      }>(`
        SELECT
          s.state_code,
          s.state_name
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'state')} s
        WHERE s.modify_date > $1
        ORDER BY s.state_code
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
        let affected = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'state')}
          SET
            state_name = $1
          WHERE state_code = $2
        `, [row.state_name, row.state_code]);

        if (affected === 0) {
          affected = await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'state')} (
              state_code,
              state_name
            ) VALUES ($1,$2)
          `, [row.state_code, row.state_name]);
        }

        if (affected !== 1) {
          throw new Error(`loadState expected one affected row for ${row.state_code}, got ${affected}`);
        }
        count += 1;
      }

      logger.info(`state records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'state' table failed", { error });
    }
  }

  private async loadCountry(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
        country_code: string;
        country_name: string;
        participating: number | null;
      }>(`
        SELECT
          c.country_code,
          c.country_name,
          c.participating
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'country')} c
        WHERE c.modify_date > $1
        ORDER BY c.country_code
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
        let affected = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'country')}
          SET
            country_name = $1,
            participating = $2
          WHERE country_code = $3
        `, [row.country_name, row.participating, row.country_code]);

        if (affected === 0) {
          affected = await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'country')} (
              country_code,
              country_name,
              participating
            ) VALUES ($1,$2,$3)
          `, [row.country_code, row.country_name, row.participating]);
        }

        if (affected !== 1) {
          throw new Error(`loadCountry expected one affected row for ${row.country_code}, got ${affected}`);
        }
        count += 1;
      }

      logger.info(`country records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'country' table failed", { error });
    }
  }

  private async loadCoder(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<CoderRowNormalized>(`
        SELECT
          c.id AS coder_id,
          c.user_id,
          c.state_code,
          c.country_code,
          c.comp_country_code,
          c.address1,
          c.address2,
          c.city,
          c.zip,
          c.quote,
          c.language_id,
          c.coder_type_id,
          u.handle,
          u.first_name,
          u.last_name,
          u.middle_name,
          u.email,
          u.status,
          u.activation_code,
          u.member_since,
          u.last_site_hit_date,
          u.reg_source,
          u.utm_source,
          u.utm_medium,
          u.utm_campaign,
          u.created_at AS create_date
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'coder')} c
        JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'user')} u
          ON u.id = c.user_id
        WHERE u.updated_at > $1
           OR c.updated_at > $1
           OR u.created_at > $1
           OR c.created_at > $1
        ORDER BY c.id
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
        const userUpdated = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'user')}
          SET
            handle = $1,
            first_name = $2,
            last_name = $3,
            middle_name = $4,
            email = $5,
            status = $6,
            activation_code = $7,
            member_since = $8,
            last_site_hit_date = $9,
            reg_source = $10,
            utm_source = $11,
            utm_medium = $12,
            utm_campaign = $13,
            create_date = $14
          WHERE id = $15
        `, [
          row.handle,
          row.first_name,
          row.last_name,
          row.middle_name,
          row.email,
          row.status,
          row.activation_code,
          row.member_since,
          row.last_site_hit_date,
          row.reg_source,
          row.utm_source,
          row.utm_medium,
          row.utm_campaign,
          row.create_date,
          row.user_id
        ]);

        if (userUpdated === 0) {
          await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'user')} (
              id,
              handle,
              first_name,
              last_name,
              middle_name,
              email,
              status,
              activation_code,
              member_since,
              last_site_hit_date,
              reg_source,
              utm_source,
              utm_medium,
              utm_campaign,
              create_date
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          `, [
            row.user_id,
            row.handle,
            row.first_name,
            row.last_name,
            row.middle_name,
            row.email,
            row.status,
            row.activation_code,
            row.member_since,
            row.last_site_hit_date,
            row.reg_source,
            row.utm_source,
            row.utm_medium,
            row.utm_campaign,
            row.create_date
          ]);
        }

        let coderAffected = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'coder')}
          SET
            user_id = $1,
            state_code = $2,
            country_code = $3,
            comp_country_code = $4,
            address1 = $5,
            address2 = $6,
            city = $7,
            zip = $8,
            quote = $9,
            language_id = $10,
            coder_type_id = $11
          WHERE id = $12
        `, [
          row.user_id,
          row.state_code,
          row.country_code,
          row.comp_country_code,
          row.address1,
          row.address2,
          row.city,
          row.zip,
          row.quote,
          row.language_id,
          row.coder_type_id,
          row.coder_id
        ]);

        if (coderAffected === 0) {
          coderAffected = await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'coder')} (
              id,
              user_id,
              state_code,
              country_code,
              comp_country_code,
              address1,
              address2,
              city,
              zip,
              quote,
              language_id,
              coder_type_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          `, [
            row.coder_id,
            row.user_id,
            row.state_code,
            row.country_code,
            row.comp_country_code,
            row.address1,
            row.address2,
            row.city,
            row.zip,
            row.quote,
            row.language_id,
            row.coder_type_id
          ]);
        }

        if (coderAffected !== 1) {
          throw new Error(`loadCoder expected one affected row for coder ${row.coder_id}, got ${coderAffected}`);
        }
        count += 1;
      }

      logger.info(`coder records updated/inserted = ${count}`);
    } catch (error) {
      logger.error("load of 'coder' table failed", { error });
    }
  }

  private async loadSkillType(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
      skill_type_id: number;
      skill_type_desc: string | null;
      skill_type_order: number | null;
      status: string | null;
      modify_date: Date | null;
    }>(`
      SELECT
        st.skill_type_id,
        st.skill_type_desc,
        st.skill_type_order,
        st.status,
        CURRENT_TIMESTAMP AS modify_date
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'skill_type_lu')} st
      WHERE st.modify_date > $1
      ORDER BY st.skill_type_id
    `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
      let affected = await this.executeDw(`
        UPDATE ${this.tbl(this.DW_SCHEMA, 'skill_type_lu')}
        SET
          skill_type_desc = $1,
          skill_type_order = $2,
          status = $3,
          modify_date = $4
        WHERE skill_type_id = $5
      `, [row.skill_type_desc, row.skill_type_order, row.status, row.modify_date, row.skill_type_id]);

      if (affected === 0) {
        affected = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'skill_type_lu')} (
            skill_type_id,
            skill_type_desc,
            skill_type_order,
            status,
            modify_date
          ) VALUES ($1,$2,$3,$4,$5)
        `, [row.skill_type_id, row.skill_type_desc, row.skill_type_order, row.status, row.modify_date]);
      }

      if (affected !== 1) {
        throw new Error(`loadSkillType expected one affected row for ${row.skill_type_id}, got ${affected}`);
      }
        count += 1;
      }

      logger.info(`skill_type records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'skill_type_lu' table failed", { error });
    }
  }

  private async loadSkill(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<SkillRow>(`
        SELECT
          s.skill_id,
          s.skill_type_id,
          s.skill_desc,
          s.status,
          s.skill_order,
          CURRENT_TIMESTAMP AS modify_date
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'skill')} s
        WHERE s.modify_date > $1
        ORDER BY s.skill_id
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
      let affected = await this.executeDw(`
        UPDATE ${this.tbl(this.DW_SCHEMA, 'skill')}
        SET
          skill_type_id = $1,
          skill_desc = $2,
          status = $3,
          skill_order = $4,
          modify_date = $5
        WHERE skill_id = $6
      `, [row.skill_type_id, row.skill_desc, row.status, row.skill_order, row.modify_date, row.skill_id]);

      if (affected === 0) {
        affected = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'skill')} (
            skill_id,
            skill_type_id,
            skill_desc,
            status,
            skill_order,
            modify_date
          ) VALUES ($1,$2,$3,$4,$5,$6)
        `, [row.skill_id, row.skill_type_id, row.skill_desc, row.status, row.skill_order, row.modify_date]);
      }

      if (affected !== 1) {
        throw new Error(`loadSkill expected one affected row for ${row.skill_id}, got ${affected}`);
      }
        count += 1;
      }

      logger.info(`skill records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'skill' table failed", { error });
    }
  }

  private async loadCoderSkill(): Promise<void> {
    try {
      const exclusion = this.buildCoderAdminExclusionClause('cs.coder_id');
      const rows = await this.queryPublicRows<{
        coder_id: number;
        skill_id: number;
        ranking: number | null;
        modify_date: Date | null;
        skill_type_id: number | null;
      }>(`
        SELECT
          cs.coder_id,
          cs.skill_id,
          cs.ranking,
          CURRENT_TIMESTAMP AS modify_date,
          s.skill_type_id
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'coder_skill_xref')} cs
        JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'skill')} s
          ON s.skill_id = cs.skill_id
        WHERE cs.modify_date > $1
          ${exclusion}
        ORDER BY cs.coder_id, cs.skill_id
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
        await this.executeDw(`
          DELETE FROM ${this.tbl(this.DW_SCHEMA, 'coder_skill_xref')}
          WHERE coder_id = $1
            AND skill_id = $2
        `, [row.coder_id, row.skill_id]);

        const inserted = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'coder_skill_xref')} (
            coder_id,
            skill_id,
            ranking,
            modify_date,
            skill_type_id
          ) VALUES ($1,$2,$3,$4,$5)
        `, [
          row.coder_id,
          row.skill_id,
          row.ranking,
          row.modify_date,
          row.skill_type_id
        ]);

        if (inserted !== 1) {
          throw new Error(`loadCoderSkill expected one inserted row for (${row.coder_id}, ${row.skill_id}), got ${inserted}`);
        }
        count += 1;
      }

      logger.info(`coder_skill records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'coder_skill_xref' table failed", { error });
    }
  }

  private async loadRating(): Promise<void> {
    try {
      const exclusion = this.buildCoderAdminExclusionClause('r.coder_id');
      const rows = await this.queryPublicRows<{
        coder_id: number;
        rating: number | null;
        num_ratings: number | null;
        vol: number | null;
        algo_rating_type_id: number;
      }>(`
        SELECT
          r.coder_id,
          r.rating,
          r.num_ratings,
          r.vol,
          r.algo_rating_type_id
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'algo_rating')} r
        WHERE r.modify_date > $1
          ${exclusion}
        ORDER BY r.coder_id, r.algo_rating_type_id
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
        const existing = await this.queryPublicRows<{
          first_rated_round_id: number | null;
          last_rated_round_id: number | null;
          lowest_rating: number | null;
          highest_rating: number | null;
          num_competitions: number | null;
        }>(`
          SELECT
            first_rated_round_id,
            last_rated_round_id,
            lowest_rating,
            highest_rating,
            num_competitions
          FROM ${this.tbl(this.DW_SCHEMA, 'algo_rating')}
          WHERE coder_id = $1
            AND algo_rating_type_id = $2
        `, [row.coder_id, row.algo_rating_type_id]);

        const keep = existing[0];

        await this.executeDw(`
          DELETE FROM ${this.tbl(this.DW_SCHEMA, 'algo_rating')}
          WHERE coder_id = $1
            AND algo_rating_type_id = $2
        `, [row.coder_id, row.algo_rating_type_id]);

        const inserted = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'algo_rating')} (
            coder_id,
            rating,
            num_ratings,
            vol,
            highest_rating,
            lowest_rating,
            first_rated_round_id,
            last_rated_round_id,
            num_competitions,
            algo_rating_type_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [
          row.coder_id,
          this.toNumber(row.rating ?? 0),
          this.toNumber(row.num_ratings ?? 0),
          this.toNumber(row.vol ?? 0),
          this.toNumber(keep?.highest_rating ?? 0),
          this.toNumber(keep?.lowest_rating ?? 0),
          keep?.first_rated_round_id ?? null,
          keep?.last_rated_round_id ?? null,
          this.toNumber(keep?.num_competitions ?? 0),
          row.algo_rating_type_id
        ]);

        if (inserted !== 1) {
          throw new Error(`loadRating expected one inserted row for (${row.coder_id},${row.algo_rating_type_id}), got ${inserted}`);
        }
        count += 1;
      }

      logger.info(`rating records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'algo_rating' table failed", { error });
    }
  }

  private async loadPath(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
        path_id: number;
        path: string;
      }>(`
        SELECT
          p.path_id,
          p.path
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'path')} p
        WHERE p.modify_date > $1
        ORDER BY p.path_id
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
        let affected = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'path')}
          SET
            path = $1
          WHERE path_id = $2
        `, [row.path, row.path_id]);

        if (affected === 0) {
          affected = await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'path')} (
              path_id,
              path
            ) VALUES ($1,$2)
          `, [row.path_id, row.path]);
        }

        if (affected !== 1) {
          throw new Error(`loadPath expected one affected row for path_id ${row.path_id}, got ${affected}`);
        }
        count += 1;
      }

      logger.info(`path records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'path' table failed", { error });
    }
  }

  private async loadImage(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
      image_id: number;
      file_name: string | null;
      image_type_id: number;
      path_id: number | null;
      link: string | null;
      height: number | null;
      width: number | null;
    }>(`
      SELECT
        i.image_id,
        i.file_name,
        i.image_type_id,
        i.path_id,
        i.link,
        i.height,
        i.width
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'image')} i
      WHERE i.modify_date > $1
        AND i.image_type_id = 1
      ORDER BY i.image_id
    `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
      let affected = await this.executeDw(`
        UPDATE ${this.tbl(this.DW_SCHEMA, 'image')}
        SET
          file_name = $1,
          image_type_id = $2,
          path_id = $3,
          link = $4,
          height = $5,
          width = $6
        WHERE image_id = $7
      `, [
        row.file_name,
        row.image_type_id,
        row.path_id,
        row.link,
        row.height,
        row.width,
        row.image_id
      ]);

      if (affected === 0) {
        affected = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'image')} (
            image_id,
            file_name,
            image_type_id,
            path_id,
            link,
            height,
            width
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [
          row.image_id,
          row.file_name,
          row.image_type_id,
          row.path_id,
          row.link,
          row.height,
          row.width
        ]);
      }

      if (affected !== 1) {
        throw new Error(`loadImage expected one affected row for image_id ${row.image_id}, got ${affected}`);
      }
        count += 1;
      }

      logger.info(`image records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'image' table failed", { error });
    }
  }

  private async loadCoderImageXref(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
        coder_id: number;
        image_id: number;
        display_flag: number | null;
      }>(`
        SELECT
          cix.coder_id,
          cix.image_id,
          cix.display_flag
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'coder_image_xref')} cix
        JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'image')} i
          ON i.image_id = cix.image_id
        WHERE cix.modify_date > $1
          AND i.image_type_id = 1
        ORDER BY cix.coder_id, cix.image_id
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
        let affected = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'coder_image_xref')}
          SET
            display_flag = $1
          WHERE coder_id = $2
            AND image_id = $3
        `, [row.display_flag, row.coder_id, row.image_id]);

        if (affected === 0) {
          affected = await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'coder_image_xref')} (
              coder_id,
              image_id,
              display_flag
            ) VALUES ($1,$2,$3)
          `, [
            row.coder_id,
            row.image_id,
            row.display_flag
          ]);
        }

        if (affected !== 1) {
          throw new Error(
            `loadCoderImageXref expected one affected row for (${row.coder_id},${row.image_id}), got ${affected}`
          );
        }
        count += 1;
      }

      logger.info(`coder_image_xref records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'coder_image_xref' table failed", { error });
    }
  }

  private async loadSchool(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
      school_id: number;
      sort_letter: string | null;
      city: string | null;
      state_code: string | null;
      country_code: string | null;
      name: string | null;
      short_name: string | null;
    }>(`
      SELECT
        s.school_id,
        s.sort_letter,
        s.city,
        s.state_code,
        s.country_code,
        s.name,
        s.short_name
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'school')} s
      WHERE s.modify_date > $1
      ORDER BY s.school_id
    `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
      let affected = await this.executeDw(`
        UPDATE ${this.tbl(this.DW_SCHEMA, 'school')}
        SET
          sort_letter = $1,
          city = $2,
          state_code = $3,
          country_code = $4,
          name = $5,
          short_name = $6
        WHERE school_id = $7
      `, [
        row.sort_letter,
        row.city,
        row.state_code,
        row.country_code,
        row.name,
        row.short_name,
        row.school_id
      ]);

      if (affected === 0) {
        affected = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'school')} (
            school_id,
            sort_letter,
            city,
            state_code,
            country_code,
            name,
            short_name
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [
          row.school_id,
          row.sort_letter,
          row.city,
          row.state_code,
          row.country_code,
          row.name,
          row.short_name
        ]);
      }

      if (affected !== 1) {
        throw new Error(`loadSchool expected one affected row for school ${row.school_id}, got ${affected}`);
      }
        count += 1;
      }

      logger.info(`school records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'school' table failed", { error });
    }
  }

  private async loadCurrentSchool(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
      coder_id: number;
      school_id: number;
      gpa: unknown;
      gpa_scale: unknown;
      viewable: number | null;
    }>(`
      SELECT
        cs.coder_id,
        cs.school_id,
        cs.gpa,
        cs.gpa_scale,
        cs.viewable
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'current_school')} cs
      WHERE cs.modify_date > $1
      ORDER BY cs.coder_id
    `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
      let affected = await this.executeDw(`
        UPDATE ${this.tbl(this.DW_SCHEMA, 'current_school')}
        SET
          school_id = $1,
          gpa = $2,
          gpa_scale = $3,
          viewable = $4
        WHERE coder_id = $5
      `, [row.school_id, row.gpa, row.gpa_scale, row.viewable, row.coder_id]);

      if (affected === 0) {
        affected = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'current_school')} (
            coder_id,
            school_id,
            gpa,
            gpa_scale,
            viewable
          ) VALUES ($1,$2,$3,$4,$5)
        `, [
          row.coder_id,
          row.school_id,
          row.gpa,
          row.gpa_scale,
          row.viewable
        ]);
      }

      if (affected !== 1) {
        throw new Error(`loadCurrentSchool expected one affected row for coder ${row.coder_id}, got ${affected}`);
      }
        count += 1;
      }

      logger.info(`current_school records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'current_school' table failed", { error });
    }
  }

  private async loadAchievements(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<AchievementRow>(`
        SELECT
          ua.user_id,
          ua.achievement_type_id,
          ua.achievement_date,
          ua.description,
          at.achievement_type_desc
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'user_achievement')} ua
        JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'achievement_type_lu')} at
          ON at.achievement_type_id = ua.achievement_type_id
        WHERE ua.created_at > $1
        ORDER BY ua.user_id, ua.achievement_type_id
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
        // Java parity note:
        // CoderService.loadAchievements does not upsert achievement_type_lu in this method.
        // Lookup rows are expected to be pre-seeded in DW.
        /*
        let typeAffected = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'achievement_type_lu')}
          SET achievement_type_desc = $1
          WHERE achievement_type_id = $2
        `, [row.achievement_type_desc, row.achievement_type_id]);

        if (typeAffected === 0) {
          typeAffected = await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'achievement_type_lu')} (
              achievement_type_id,
              achievement_type_desc
            ) VALUES ($1,$2)
          `, [row.achievement_type_id, row.achievement_type_desc]);
        }

        if (typeAffected !== 1) {
          throw new Error(`loadAchievements expected one affected type row for ${row.achievement_type_id}, got ${typeAffected}`);
        }
        */

        const inserted = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'user_achievement')} (
            user_id,
            achievement_date,
            achievement_type_id,
            description,
            achievement_type_desc
          ) VALUES ($1,$2,$3,$4,$5)
        `, [
          row.user_id,
          row.achievement_date,
          row.achievement_type_id,
          row.description,
          row.achievement_type_desc
        ]);

        if (inserted !== 1) {
          throw new Error(`loadAchievements expected one inserted row for user ${row.user_id}, got ${inserted}`);
        }
        count += 1;
      }

      logger.info(`user_achievement records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'user_achievement' table failed", { error });
    }
  }

  private async loadTeam(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
      team_id: number;
      team_name: string | null;
      team_type: number | null;
      school_id: number | null;
    }>(`
      SELECT
        t.team_id,
        t.name AS team_name,
        t.team_type,
        t.school_id
      FROM ${this.tbl(this.PUBLIC_SCHEMA, 'team')} t
      WHERE t.modify_date > $1
        AND t.team_type = $2
      ORDER BY t.team_id
    `, [this.lastLogWindow.lastLogTime, HIGH_SCHOOL_TEAM_TYPE]);

      let count = 0;
      for (const row of rows) {
      let affected = await this.executeDw(`
        UPDATE ${this.tbl(this.DW_SCHEMA, 'team')}
        SET
          name = $1,
          team_type = $2,
          school_id = $3
        WHERE team_id = $4
      `, [row.team_name, row.team_type, row.school_id, row.team_id]);

      if (affected === 0) {
        affected = await this.executeDw(`
          INSERT INTO ${this.tbl(this.DW_SCHEMA, 'team')} (
            name,
            team_type,
            school_id,
            team_id
          ) VALUES ($1,$2,$3,$4)
        `, [row.team_name, row.team_type, row.school_id, row.team_id]);
      }

      if (affected !== 1) {
        throw new Error(`loadTeam expected one affected row for team ${row.team_id}, got ${affected}`);
      }
        count += 1;
      }

      logger.info(`team records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'team' table failed", { error });
    }
  }

  private async loadTeamCoderXref(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
        team_id: number;
        coder_id: number;
      }>(`
        SELECT
          tc.team_id,
          tc.coder_id
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'team_coder_xref')} tc
        JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'team')} t
          ON t.team_id = tc.team_id
        WHERE t.team_type = $2
          AND tc.created_at > $1
        ORDER BY tc.coder_id, tc.team_id
      `, [this.lastLogWindow.lastLogTime, HIGH_SCHOOL_TEAM_TYPE]);

      let count = 0;
      for (const row of rows) {
        await this.executeDw(`
          DELETE FROM ${this.tbl(this.DW_SCHEMA, 'team_coder_xref')}
          WHERE coder_id = $1
        `, [row.coder_id]);

        try {
          const inserted = await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'team_coder_xref')} (
              team_id,
              coder_id
            ) VALUES ($1,$2)
          `, [row.team_id, row.coder_id]);

          if (inserted !== 1) {
            throw new Error(`loadTeamCoderXref expected one inserted row for coder ${row.coder_id}, got ${inserted}`);
          }
          count += 1;
        } catch (error) {
          // Java parity: duplicate team_coder_xref inserts are ignored and processing continues.
          if (this.isDuplicateInsertError(error)) {
            logger.warn(`Ignoring duplicate team_coder_xref for coder ${row.coder_id}, team ${row.team_id}`);
            continue;
          }
          throw error;
        }
      }

      logger.info(`team_coder_xref records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'team_coder_xref' table failed", { error });
    }
  }

  private async loadEvent(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<EventRow>(`
        SELECT
          e.event_id,
          e.event_type_id,
          et.event_type_desc,
          e.event_desc
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'event')} e
        JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'event_type_lu')} et
          ON et.event_type_id = e.event_type_id
        WHERE e.modify_date > $1
        ORDER BY e.event_id
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
        // Java parity note:
        // CoderService.loadEvent does not upsert event_type_lu in this method.
        // Lookup rows are expected to be pre-seeded in DW.
        /*
        let typeAffected = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'event_type_lu')}
          SET event_type_desc = $1
          WHERE event_type_id = $2
        `, [row.event_type_desc, row.event_type_id]);

        if (typeAffected === 0) {
          typeAffected = await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'event_type_lu')} (
              event_type_id,
              event_type_desc
            ) VALUES ($1,$2)
          `, [row.event_type_id, row.event_type_desc]);
        }

        if (typeAffected !== 1) {
          throw new Error(`loadEvent expected one affected event_type row for ${row.event_type_id}, got ${typeAffected}`);
        }
        */

        let affected = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'event')}
          SET
            event_type_id = $1,
            event_type_desc = $2,
            event_desc = $3
          WHERE event_id = $4
        `, [row.event_type_id, row.event_type_desc, row.event_desc, row.event_id]);

        if (affected === 0) {
          affected = await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'event')} (
              event_id,
              event_type_id,
              event_type_desc,
              event_desc
            ) VALUES ($1,$2,$3,$4)
          `, [row.event_id, row.event_type_id, row.event_type_desc, row.event_desc]);
        }

        if (affected !== 1) {
          throw new Error(`loadEvent expected one affected event row for ${row.event_id}, got ${affected}`);
        }
        count += 1;
      }

      logger.info(`event records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'event' table failed", { error });
    }
  }

  private async loadEventRegistration(): Promise<void> {
    try {
      const rows = await this.queryPublicRows<{
        event_id: number;
        user_id: number;
        eligible_ind: number | null;
        notes: string | null;
        create_date: Date | null;
        modify_date: Date | null;
      }>(`
        SELECT
          er.event_id,
          er.user_id,
          er.eligible_ind,
          er.notes,
          er.created_at AS create_date,
          er.modify_date
        FROM ${this.tbl(this.PUBLIC_SCHEMA, 'event_registration')} er
        WHERE er.modify_date > $1
        ORDER BY er.event_id, er.user_id
      `, [this.lastLogWindow.lastLogTime]);

      let count = 0;
      for (const row of rows) {
        let affected = await this.executeDw(`
          UPDATE ${this.tbl(this.DW_SCHEMA, 'event_registration')}
          SET
            eligible_ind = $1,
            notes = $2,
            create_date = $3,
            modify_date = $4
          WHERE event_id = $5
            AND user_id = $6
        `, [
          row.eligible_ind,
          row.notes,
          row.create_date,
          row.modify_date,
          row.event_id,
          row.user_id
        ]);

        if (affected === 0) {
          affected = await this.executeDw(`
            INSERT INTO ${this.tbl(this.DW_SCHEMA, 'event_registration')} (
              event_id,
              user_id,
              eligible_ind,
              notes,
              create_date,
              modify_date
            ) VALUES ($1,$2,$3,$4,$5,$6)
          `, [
            row.event_id,
            row.user_id,
            row.eligible_ind,
            row.notes,
            row.create_date,
            row.modify_date
          ]);
        }

        if (affected !== 1) {
          throw new Error(
            `loadEventRegistration expected one affected row for (${row.event_id},${row.user_id}), got ${affected}`
          );
        }
        count += 1;
      }

      logger.info(`event_registration records copied = ${count}`);
    } catch (error) {
      logger.error("load of 'event_registration' table failed", { error });
    }
  }

  private async setLastUpdateTime(startedAt: Date): Promise<void> {
    try {
      const calendarId = await this.lookupCalendarId(startedAt);
      const inserted = await this.executeDw(`
        INSERT INTO ${this.tbl(this.DW_SCHEMA, 'update_log')} (
          calendar_id,
          timestamp,
          log_type_id
        ) VALUES ($1,$2,$3)
      `, [calendarId, startedAt, CODER_LOG_TYPE_ID]);

      if (inserted !== 1) {
        throw new Error(`setLastUpdateTime expected one inserted row, got ${inserted}`);
      }
    } catch (error) {
      logger.error('failed to set coder last log time', { error });
    }
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

  private buildCoderAdminExclusionClause(coderIdExpression: string): string {
    return `
        AND NOT EXISTS (
          SELECT 1
          FROM ${this.tbl(this.PUBLIC_SCHEMA, 'coder')} c_admin
          JOIN ${this.tbl(this.PUBLIC_SCHEMA, 'user_group_xref')} ugx
            ON ugx.user_id = c_admin.user_id
          WHERE c_admin.id = ${coderIdExpression}
            AND ugx.group_id IN (2000115, 13)
        )
    `;
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

  private isDuplicateInsertError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as {
      code?: string;
      meta?: { code?: string; message?: string };
      message?: string;
    };

    if (candidate.code === 'P2002' || candidate.code === '23505') {
      return true;
    }

    if (candidate.code === 'P2010' && candidate.meta?.code === '23505') {
      return true;
    }

    return typeof candidate.message === 'string' && candidate.message.toLowerCase().includes('duplicate key');
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

const marathonLoadCodersToDWService = new MarathonLoadCodersToDWService();

export async function loadCodersToDW(roundId: number): Promise<void> {
  await marathonLoadCodersToDWService.loadCodersToDW(roundId);
}

export type {
  CoderRowNormalized,
  SkillRow,
  AchievementRow,
  EventRow,
  LastLogWindow
};

export default marathonLoadCodersToDWService;
