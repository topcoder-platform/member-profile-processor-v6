/**
 * Marathon Match Rating Service
 * Replaces Informix operations with PostgreSQL/Prisma operations
 * Follows the exact same business logic as the original
 */

import * as helper from '../common/helper';
import database from '../common/database';
import logger, { buildService } from '../common/logger';
import { AlgorithmQubits } from '../libs/algorithm/AlgorithmQubits';

/**
 * Calculate ratings for a Marathon Match challenge
 * Follows the exact same logic as the original calculate function
 */
export async function calculate(challengeId: string, legacyId: number): Promise<void> {
  try {
    logger.debug('=== Marathon Match ratings calculation start ===');

    // Get round ID from legacy ID (equivalent to getRoundId in original)
    const dbRoundId = await database.getChallengeId(legacyId);
    if (!dbRoundId) {
      throw new Error(`No round found for legacy ID: ${legacyId}`);
    }

    logger.debug(`round id ${dbRoundId}`);

    // Get LCR entries for the round (equivalent to getLCREntries in original)
    const lcrEntries = await database.getLCREntries(dbRoundId);

    // Get submissions and final submissions (same as original)
    const submissions = await helper.getSubmissions(challengeId);
    const finalSubmissions = await helper.getFinalSubmissions(submissions);

    logger.debug(`Submissions: ${JSON.stringify(submissions)}`);
    logger.debug(`Final submissions: ${JSON.stringify(finalSubmissions)}`);


    // Update LCR entries for members who submitted and have attended='N' (same logic as original)
    // aync to avoid race condition where new attendees can be missed
    await Promise.all(
      finalSubmissions.map(async (submission) => {
        const entry = lcrEntries.find(lcr => lcr.coderId === Number(submission.memberId));
        if (entry && entry.attended === 'N') {
          // Update the attended flag (equivalent to updateLCREntry in original)
          await database.updateLCREntry(dbRoundId, entry.coderId);
        }
      })
    );

    // Run rating calculation
    logger.debug(`=== Initiating rating calculation for roundId: ${dbRoundId} (challengeId: ${challengeId}) ===`);
    const algo = new AlgorithmQubits();
    await algo.runProcess(dbRoundId);

    // After calculation completes, trigger loadCoders and loadRatings
    await loadCoders(challengeId);
    await loadRatings(challengeId);

    logger.debug('=== Marathon Match ratings calculation success ===');
  } catch (error) {
    logger.debug('=== Marathon Match ratings calculation failure ===');
    logger.error('Error in rating calculation', { error });
    throw new Error(error instanceof Error ? error.message : String(error));
  } finally {
    logger.debug('=== Marathon Match ratings calculation end ===');
  }
}

/**
 * Load ratings data to data warehouse
 * Follows the exact same logic as the original loadRatings function
 */
export async function loadRatings(challengeId: string): Promise<void> {
  try {
    logger.debug('=== Load Ratings start ===');

    await helper.initiateLoadRatings(challengeId);

    logger.debug('=== Load Ratings end ===');
  } catch (error) {
    logger.error('Error in load ratings', { error });
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Load coders data to data warehouse
 * Follows the exact same logic as the original loadCoders function
 */
export async function loadCoders(challengeId: string): Promise<void> {
  try {
    logger.debug('=== Load Coders start ===');

    await helper.initiateLoadCoders(challengeId);

    logger.debug('=== Load Coders end ===');
  } catch (error) {
    logger.error('Error in load coders', { error });
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

const MarathonRatingsService = {
  calculate,
  loadCoders,
  loadRatings
};

// Build service with logger methods (same as original)
buildService(MarathonRatingsService);

export default MarathonRatingsService; 
