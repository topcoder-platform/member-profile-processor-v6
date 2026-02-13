/**
 * The configuration file for Member Profile Processor
 */

export interface Config {
  LOG_LEVEL: string;
  PORT: number;
  
  // Database
  DATABASE_URL: string;
  
  // Kafka configs
  KAFKA_URL: string;
  KAFKA_CLIENT_CERT?: string;
  KAFKA_CLIENT_CERT_KEY?: string;
  KAFKA_GROUP_ID: string;
  
  // Kafka topics to listen
  KAFKA_AUTOPILOT_NOTIFICATIONS_TOPIC: string;
  KAFKA_RATING_SERVICE_TOPIC: string;
  
  // OAuth details
  AUTH0_URL?: string;
  AUTH0_AUDIENCE?: string;
  AUTH0_CLIENT_ID?: string;
  AUTH0_CLIENT_SECRET?: string;
  AUTH0_PROXY_SERVER_URL?: string;
  
  // API endpoints
  V5_API_URL: string;
  
  // Testing/Mock mode
  USE_MOCK_HELPER: boolean;
}

const config: Config = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  PORT: parseInt(process.env.PORT || '3000', 10),
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/member_profile_processor',
  
  // Kafka configs
  KAFKA_URL: process.env.KAFKA_URL || 'localhost:9092',
  KAFKA_CLIENT_CERT: process.env.KAFKA_CLIENT_CERT,
  KAFKA_CLIENT_CERT_KEY: process.env.KAFKA_CLIENT_CERT_KEY,
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'member-profile-processor-group-consumer',
  
  // Kafka topics to listen
  KAFKA_AUTOPILOT_NOTIFICATIONS_TOPIC: process.env.KAFKA_AUTOPILOT_NOTIFICATIONS_TOPIC || 'notifications.autopilot.events',
  KAFKA_RATING_SERVICE_TOPIC: process.env.KAFKA_RATING_SERVICE_TOPIC || 'notification.rating.calculation',
  
  // OAuth details
  AUTH0_URL: process.env.AUTH0_URL,
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
  AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL,
  
  // API endpoints
  V5_API_URL: process.env.V5_API_URL || 'https://api.topcoder-dev.com/v5',
  
  // Testing/Mock mode
  USE_MOCK_HELPER: process.env.USE_MOCK_HELPER === 'true',
};

export default config; 