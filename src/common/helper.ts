/**
 * Contains common helper methods for API calls and utilities
 */

import _ from 'lodash';
import axios, { AxiosInstance } from 'axios';
import config from '../config/default';
import logger from './logger';

// Import m2m auth from tc-core-library-js
const m2mAuth = require('tc-core-library-js').auth.m2m;

const m2m = m2mAuth(
  _.pick(config, ['AUTH0_URL', 'AUTH0_AUDIENCE', 'AUTH0_PROXY_SERVER_URL'])
);

export interface ChallengeDetails {
  id: string;
  legacyId: number;
  name?: string;
  type?: string;
  status?: string;
  legacy?: {
    subTrack?: string;
  };
}

export interface Submission {
  id: string;
  challengeId: string;
  memberId: string; // Keep as string for API compatibility
  type?: string;
  url?: string;
  created: string;
  updated: string;
  reviewSummation?: unknown;
}

export interface KafkaOptions {
  clientId: string;
  brokers: string[];
  ssl?: {
    cert: string;
    key: string;
  };
}

/**
 * Function to get M2M token
 */
export async function getM2MToken(): Promise<string> {
  logger.info('Getting M2M token');
  if (!config.AUTH0_CLIENT_ID || !config.AUTH0_CLIENT_SECRET) {
    throw new Error('AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET are required');
  }

  // TODO: Remove this once we have real credentials
  if (config.AUTH0_CLIENT_ID === 'mock-client-id' || config.AUTH0_CLIENT_SECRET === 'mock-client-secret') {
    logger.warn('Using mock Auth0 credentials, returning mock token for development');
    return 'mock-token-for-development';
  }
  return m2m.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET);
}

/**
 * Function to get challenge details with provided query
 * from the v5 API endpoint
 */
export async function getChallengeDetails(queryParams: { legacyId: number }): Promise<ChallengeDetails | null> {
  const token = await getM2MToken();
  logger.info(`Fetching v5 challenge detail using query params: ${JSON.stringify(queryParams)}`);
  logger.info(`Using V5_API_URL: ${config.V5_API_URL}`);

  try {
    const response = await getV5Api(token).get('/challenges', { params: queryParams });
    const content = _.get(response.data, '[0]');

    if (content) {
      return content as ChallengeDetails;
    }

    return null;
  } catch (error) {
    logger.error('Error fetching challenge details', { queryParams, error });
    throw error;
  }
}

/**
 * Function to fetch all the submissions for a given challenge
 */
export async function getSubmissions(challengeId: string): Promise<Submission[]> {
  const token = await getM2MToken();
  logger.info(`Fetching v5 submissions for a given challenge: ${challengeId}`);

  let allSubmissions: Submission[] = [];
  let response: Record<string, unknown> = {};

  const queryParams = {
    challengeId,
    perPage: 500,
    page: 1
  };

  try {
    do {
      response = await getV5Api(token).get('/submissions', { params: queryParams });
      queryParams.page++;
      allSubmissions = _.concat(allSubmissions, response.data as Submission[]);
    } while ((response.headers as Record<string, string>)['x-total-pages'] !== (response.headers as Record<string, string>)['x-page']);

    return allSubmissions;
  } catch (error) {
    logger.error('Error fetching submissions', { challengeId, error });
    throw error;
  }
}

/**
 * Function to get latest submissions of each member
 */
export async function getFinalSubmissions(submissions: Submission[]): Promise<Submission[]> {
  const uniqMembers = _.uniq(_.map(submissions, 'memberId'));

  const latestSubmissions: Submission[] = [];
  uniqMembers.forEach((memberId: string) => {
    const memberSubmissions = _.filter(submissions, { memberId });
    const sortedSubs = _.sortBy(memberSubmissions, [function (i: Submission) { return new Date(i.created); }]);
    const lastSubmission = _.last(sortedSubs);

    if (lastSubmission && lastSubmission.hasOwnProperty('reviewSummation')) {
      latestSubmissions.push(lastSubmission);
    }
  });

  return latestSubmissions;
}

/**
 * Function to initiate loadRatings
 * Stub implementation - to be implemented later
 */
export async function initiateLoadRatings(challengeId: string): Promise<void> {
  logger.debug(`Load ratings stub for challengeId: ${challengeId}`);
  // TODO: Implement load ratings functionality
}

/**
 * Function to initiate loadCoders
 * Stub implementation - to be implemented later
 */
export async function initiateLoadCoders(challengeId: string): Promise<void> {
  logger.debug(`Load coders stub for challengeId: ${challengeId}`);
  // TODO: Implement load coders functionality
}

/**
 * Helper function returning prepared axios instance for using with v5 challenge API
 */
function getV5Api(token: string): AxiosInstance {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  headers['Authorization'] = `Bearer ${token}`;

  return axios.create({
    baseURL: config.V5_API_URL,
    timeout: 30000,
    headers
  });
}

/**
 * Get Kafka options from configuration
 */
export function getKafkaOptions(): KafkaOptions {
  const options: KafkaOptions = {
    clientId: 'member-profile-processor',
    brokers: [config.KAFKA_URL]
  };

  if (config.KAFKA_CLIENT_CERT && config.KAFKA_CLIENT_CERT_KEY) {
    options.ssl = {
      cert: config.KAFKA_CLIENT_CERT,
      key: config.KAFKA_CLIENT_CERT_KEY
    };
  }

  return options;
} 
