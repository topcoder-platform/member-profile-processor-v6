/**
 * RatingData model
 * Represents the data needed to rate an individual performance
 */

export interface RatingData {
  coderId: number;
  userId?: number;
  rating: number;
  vol: number; // Volatility
  numRatings: number;
  score: number;

  // Additional fields for algorithm computation
  expectedRank?: number;
  expectedPerformance?: number;
  actualRank?: number;
  actualPerformance?: number;
}

/**
 * Create a new RatingData instance
 */
export function createRatingData(): RatingData {
  return {
    coderId: 0,
    rating: 0,
    vol: 0,
    numRatings: 0,
    score: 0,
    expectedRank: 0,
    expectedPerformance: 0,
    actualRank: 0,
    actualPerformance: 0
  };
}

/**
 * Create RatingData from raw values
 */
export function createRatingDataFromValues(
  coderId: number,
  score: number,
  rating: number = 1200,
  vol: number = 300,
  numRatings: number = 0
): RatingData {
  return {
    coderId,
    rating,
    vol,
    numRatings,
    score,
    expectedRank: 0,
    expectedPerformance: 0,
    actualRank: 0,
    actualPerformance: 0
  };
}
