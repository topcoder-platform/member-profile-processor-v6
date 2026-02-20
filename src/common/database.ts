/**
 * Database service using Prisma for PostgreSQL operations
 * Replaces Informix operations with equivalent PostgreSQL operations
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { RatingData } from '../libs/model/RatingData';
import logger from './logger';

class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  /**
   * Get Prisma client instance
   */
  getClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Get round ID for the given legacy challenge ID
   * Replaces the original getRoundId function
   * @param legacyId - Legacy challenge/project ID
   * @returns roundId corresponding to the legacy ID
   */
  async getChallengeId(legacyId: number): Promise<number | null> {
    try {
      logger.info(`Getting round information for legacy ID via project_info: ${legacyId}`);

      const projectInfo = await this.prisma.projectInfo.findFirst({
        where: {
          projectId: legacyId,
          projectInfoTypeId: 56
        },
        select: { value: true }
      });

      return projectInfo?.value ? Number(projectInfo.value) : null;
    } catch (error) {
      logger.error('Error getting round ID', { legacyId, error });
      throw error;
    }
  }

  /**
   * Get long comp result entries for the given round ID
   * Replaces the original getLCREntries function (long_comp_result → user_challenges)
   * @param roundId - Round ID
   * @returns long comp result entries
   */
  async getLCREntries(roundId: number) {
    try {
      return await this.prisma.longCompResult.findMany({
        where: { roundId },
      });
    } catch (error) {
      logger.error('Error getting LCR entries', { roundId, error });
      throw error;
    }
  }

  /**
   * Update user challenge entry to mark attendance
   * Replaces the original updateLCREntry function
   * @param roundId - Round ID
   * @param userId - User ID (equivalent to coderId in original)
   */
  async updateLCREntry(roundId: number, userId: number): Promise<void> {
    try {
      await this.prisma.longCompResult.updateMany({
        where: {
          roundId,
          coderId: userId,
        },
        data: {
          attended: 'Y',
        },
      });
    } catch (error) {
      logger.error('Error updating LCR entry', { roundId, userId, error });
      throw error;
    }
  }

  /**
   * Load rating data for a round
   * Gets long comp results with current ratings from algo_rating
   * @param roundId - Round ID
   * @returns Array of RatingData for algorithm processing
   */
  async loadRatingData(roundId: number): Promise<RatingData[]> {
    try {
      logger.info(`Loading rating data for round: ${roundId}`);

      // Get long comp results for this round (attended + not already rated)
      const longCompResults = await this.prisma.longCompResult.findMany({
        where: {
          roundId,
          attended: 'Y',
          newRating: null,
          newVol: null
        }
      });

      if (longCompResults.length === 0) {
        logger.info(`Loaded 0 rating entries for round ${roundId}`);
        return [];
      }

      const userIds = longCompResults.map(lcr => lcr.coderId);

      const coders = await this.prisma.coder.findMany({
        where: { userId: { in: userIds } },
        select: { id: true, userId: true }
      });

      const coderIdByUserId = new Map<number, number>();
      for (const coder of coders) {
        coderIdByUserId.set(coder.userId, coder.id);
      }

      const coderIds = coders.map(c => c.id);
      const algoRatings = await this.prisma.algoRating.findMany({
        where: {
          algoRatingTypeId: 3,
          coderId: { in: coderIds }
        },
        select: {
          coderId: true,
          rating: true,
          vol: true,
          numRatings: true
        }
      });

      const algoRatingByCoderId = new Map<number, { rating: number; vol: number; numRatings: number }>();
      for (const ar of algoRatings) {
        algoRatingByCoderId.set(ar.coderId, { rating: ar.rating, vol: ar.vol, numRatings: ar.numRatings });
      }

      const toNumber = (value: Prisma.Decimal | number | null | undefined): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        return value.toNumber();
      };

      const ratingData: RatingData[] = [];
      for (const lcr of longCompResults) {
        let coderId = coderIdByUserId.get(lcr.coderId);

        // If no coder record exists, create one (data integrity issue, but handle gracefully)
        if (!coderId) {
          logger.warn(`No coder found for user ${lcr.coderId}, creating default coder record`);
          try {
            const newCoder = await this.prisma.coder.create({
              data: {
                userId: lcr.coderId
              },
              select: { id: true }
            });
            coderId = newCoder.id;
          } catch (e) {
            logger.error(`Failed to create coder record for user ${lcr.coderId}, skipping`, { error: e });
            continue;
          }
        }

        const existing = algoRatingByCoderId.get(coderId);
        const score = toNumber(lcr.systemPointTotal);

        // Validate score is a valid number (not NaN/Infinity)
        if (!Number.isFinite(score)) {
          logger.warn(`Invalid score for coder ${coderId} in round ${roundId}: ${score}, skipping`);
          continue;
        }

        ratingData.push({
          coderId,
          userId: lcr.coderId,
          rating: existing?.rating ?? 0,
          vol: existing?.vol ?? 0,
          numRatings: existing?.numRatings ?? 0,
          score,
          expectedRank: 0,
          expectedPerformance: 0,
          actualRank: 0,
          actualPerformance: 0
        });
      }

      logger.info(`Loaded ${ratingData.length} rating entries for round ${roundId}`);
      return ratingData;
    } catch (error) {
      logger.error('Error loading rating data', { roundId, error });
      throw error;
    }
  }

  /**
   * Persist calculated rating results to database
   * Updates LongCompResult and AlgoRating
   * @param roundId - Round ID
   * @param ratingData - Array of RatingData with calculated ratings
   */
  async persistRatingResults(roundId: number, ratingData: RatingData[]): Promise<void> {
    try {
      logger.info(`Persisting rating results for round: ${roundId}`);

      if (ratingData.length === 0) {
        logger.info('No rating results to persist, skipping challenge rated flag update');
        return;
      }

      // Validate no NaN values in rating data
      const validRatingData = ratingData.filter(data => {
        if (!Number.isFinite(data.rating) || !Number.isFinite(data.vol)) {
          logger.warn(`Skipping invalid rating data for coder ${data.coderId}: rating=${data.rating}, vol=${data.vol}`);
          return false;
        }
        return true;
      });

      if (validRatingData.length === 0) {
        logger.error('All rating results contain invalid values (NaN/Infinity)');
        return;
      }

      for (const data of validRatingData) {
        const coder = await this.prisma.coder.findUnique({
          where: { id: data.coderId },
          select: { id: true, userId: true }
        });

        if (!coder) {
          logger.warn(`Coder ${data.coderId} not found, skipping`);
          continue;
        }

        const currentAlgoRating = await this.prisma.algoRating.findUnique({
          where: {
            coderId_algoRatingTypeId: {
              coderId: data.coderId,
              algoRatingTypeId: 3
            }
          },
          select: { rating: true, vol: true }
        });

        const userId = data.userId ?? coder.userId;

        if (!userId) {
          logger.warn(`No userId available for coder ${data.coderId}, skipping LongCompResult update`);
          continue;
        }

        // Update LongCompResult with old and new ratings
        await this.prisma.longCompResult.updateMany({
          where: {
            roundId,
            coderId: userId
          },
          data: {
            oldRating: currentAlgoRating?.rating ?? null,
            oldVol: currentAlgoRating?.vol ?? null,
            newRating: data.rating,
            newVol: data.vol,
            rated: 1
          }
        });

        await this.prisma.algoRating.upsert({
          where: {
            coderId_algoRatingTypeId: {
              coderId: data.coderId,
              algoRatingTypeId: 3
            }
          },
          update: {
            rating: data.rating,
            vol: data.vol,
            roundId,
            numRatings: { increment: 1 }
          },
          create: {
            coderId: data.coderId,
            algoRatingTypeId: 3,
            rating: data.rating,
            vol: data.vol,
            roundId,
            numRatings: 1
          }
        });

        logger.debug(`Updated ratings for coder ${data.coderId}: ${currentAlgoRating?.rating ?? 0} → ${data.rating}`);
      }

      logger.info(`Persisted rating results for ${validRatingData.length} coders in round ${roundId}`);

      // Mark round as rated, mirroring round.rated_ind update in the original flow
      await this.prisma.round.update({
        where: { id: roundId },
        data: { ratedInd: 1 }
      });
    } catch (error) {
      logger.error('Error persisting rating results', { roundId, error });
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

export default new DatabaseService(); 
