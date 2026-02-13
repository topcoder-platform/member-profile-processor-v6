/**
 * Application entry point for Member Profile Processor
 */

// Load environment variables from .env file
import 'dotenv/config';

import { Kafka, Consumer } from 'kafkajs';
import config from './config/default';
import * as KafkaHandlerService from './services/KafkaHandlerService';
import * as helper from './common/helper';
import logger from './common/logger';
import database from './common/database';

// Global Promise enhancement
global.Promise = require('bluebird');

let consumer: Consumer;

/**
 * Initialize and start Kafka consumer
 */
async function startKafkaConsumer(): Promise<void> {
  try {
    logger.info('=== Starting Kafka consumer ===');

    const kafkaOptions = helper.getKafkaOptions();
    const kafka = new Kafka(kafkaOptions);

    consumer = kafka.consumer({ groupId: config.KAFKA_GROUP_ID });

    // Subscribe to topics
    await consumer.subscribe({ 
      topics: [
        config.KAFKA_AUTOPILOT_NOTIFICATIONS_TOPIC,
        config.KAFKA_RATING_SERVICE_TOPIC
      ],
      fromBeginning: false 
    });

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageValue = message.value?.toString('utf8');
          if (!messageValue) {
            logger.warn('Received empty message', { topic, partition, offset: message.offset });
            return;
          }

          logger.info(
            `Handle kafka event message; Topic: ${topic}; Partition: ${partition}; Offset: ${message.offset}; Message: ${messageValue}`
          );

          let messageJSON: KafkaHandlerService.KafkaMessage;
          try {
            messageJSON = JSON.parse(messageValue);
          } catch (error) {
            logger.error('Invalid message JSON', { messageValue, error });
            return;
          }

          logger.debug('Parsed message', { messageJSON });

          // Process the message
          await KafkaHandlerService.handle(messageJSON);
          
          logger.info('Successfully processed message', { topic, partition, offset: message.offset });

        } catch (error) {
          logger.error('Error processing Kafka message', { 
            topic, 
            partition, 
            offset: message.offset, 
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack,
              name: error.name
            } : error
          });
          // Don't rethrow to avoid stopping the consumer
        }
      },
    });

    logger.info('Kafka consumer started successfully');

  } catch (error) {
    logger.error('Failed to start Kafka consumer', { error });
    throw error;
  }
}

/**
 * Health check function for monitoring
 */
function healthCheck(): boolean {
  try {
    // Basic health check - ensure consumer is connected
    return consumer !== undefined;
  } catch (error) {
    logger.error('Health check failed', { error });
    return false;
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');
  
  try {
    if (consumer) {
      await consumer.disconnect();
      logger.info('Kafka consumer disconnected');
    }
    
    await database.disconnect();
    logger.info('Database connection closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

/**
 * Main application startup
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting Member Profile Processor...');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Start Kafka consumer
    await startKafkaConsumer();
    
    // Setup graceful shutdown handlers
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGUSR2', shutdown); // For nodemon
    
    logger.info('Member Profile Processor started successfully');
    
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start the application
if (require.main === module) {
  main().catch((error) => {
    logger.error('Application startup failed', { error });
    process.exit(1);
  });
}

export { healthCheck, shutdown };
export default main; 