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
      logger.info('Skipping rating-service Kafka handling for load-ratings flow; calculate path is canonical');
      break;

    default:
      logger.warn('Unknown topic received', { topic: message.topic });
  }
}

// Build service with logger methods (same as original)
buildService({ handle }); 
