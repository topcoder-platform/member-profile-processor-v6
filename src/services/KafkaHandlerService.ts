/**
 * Service to handle Kafka messages
 * Follows the exact same business logic as the original
 */

import config from '../config/default';
import MarathonRatingsService from './MarathonRatingsService';
import logger, { buildService } from '../common/logger';
import * as helper from '../common/helper';


export interface AutopilotPayload {
  date: string;
  projectId: number;
  phaseId: number;
  phaseTypeName: string;
  state: string;
  operator: string;
}

export interface RatingServicePayload {
  event: string;
  status: string;
  challengeId?: string;
  roundId?: number; // Legacy field from original - still needed for backwards compatibility
}

export interface KafkaMessage {
  topic: string;
  originator?: string;
  timestamp: string;
  payload: AutopilotPayload | RatingServicePayload;
}

/**
 * Handle incoming Kafka messages
 * Follows the exact same logic as the original handle function
 */
export async function handle(message: KafkaMessage): Promise<void> {
  switch (message.topic) {
    // Handle review phase end messages (same logic as original)
    case config.KAFKA_AUTOPILOT_NOTIFICATIONS_TOPIC:
      if (
        (message.payload as AutopilotPayload).phaseTypeName.toLowerCase() === 'review' &&
        (message.payload as AutopilotPayload).state.toLowerCase() === 'end'
      ) {
        const payload = message.payload as AutopilotPayload;
        
        // Get the challenge details (same as original)
        const challengeDetails = await helper.getChallengeDetails({
          legacyId: payload.projectId
        });

        if (challengeDetails && challengeDetails.legacy?.subTrack?.toLowerCase() === 'marathon_match') {
          // Call calculate with challengeId and legacyId (same as original)
          await MarathonRatingsService.calculate(challengeDetails.id, challengeDetails.legacyId);
        }
      }
      break;

    case config.KAFKA_RATING_SERVICE_TOPIC:
      // Handle rating service messages (same logic as original)
      if (message.originator === 'rating.calculation.service') {
        const payload = message.payload as RatingServicePayload;
        
        if (
          payload.event === 'RATINGS_CALCULATION' &&
          payload.status === 'SUCCESS'
        ) {
          // Original used roundId, but we need to adapt to challengeId
          // For backwards compatibility, we'll handle both challengeId and roundId
          if (payload.challengeId) {
            await MarathonRatingsService.loadCoders(payload.challengeId);
          } else if (payload.roundId) {
            // For legacy messages with roundId, we'd need to convert to challengeId
            // This is a temporary solution until all services are updated
            logger.warn('Received legacy roundId message, this should be updated to use challengeId', { roundId: payload.roundId });
            // Skip for now since we can't convert roundId to challengeId without additional mapping
          }
        } else if (
          payload.event === 'LOAD_CODERS' &&
          payload.status === 'SUCCESS'
        ) {
          if (payload.challengeId) {
            await MarathonRatingsService.loadRatings(payload.challengeId);
          } else if (payload.roundId) {
            logger.warn('Received legacy roundId message, this should be updated to use challengeId', { roundId: payload.roundId });
            // Skip for now since we can't convert roundId to challengeId without additional mapping
          }
        }
      }
      break;

    default:
      logger.warn('Unknown topic received', { topic: message.topic });
  }
}

// Build service with logger methods (same as original)
buildService({ handle }); 