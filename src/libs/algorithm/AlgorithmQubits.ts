/**
 * The Qubits Rating Algorithm
 *
 * Ported from Java: com.topcoder.ratings.libs.algorithm.AlgorithmQubits
 *
 * This algorithm calculates rating changes for Marathon Match competitions.
 */

import { RatingData } from '../model/RatingData';
import logger from '../../common/logger';
import database from '../../common/database';

export class AlgorithmQubits {
  private data: RatingData[] = [];

  // Constants
  private static readonly INITIAL_SCORE = 1200.0;
  private static readonly INITIAL_WEIGHT = 0.60;
  private static readonly FINAL_WEIGHT = 0.18;
  private static readonly FIRST_VOLATILITY = 385;

  constructor(data?: RatingData[]) {
    if (data) {
      this.setRatingData(data);
    }
  }

  // Coefficients for normsinv approximation
  private static readonly P_LOW = 0.02425;
  private static readonly P_HIGH = 1.0 - AlgorithmQubits.P_LOW;

  private static readonly NORMINV_A = [
    -3.969683028665376e1, 2.209460984245205e2,
    -2.759285104469687e2, 1.383577518672690e2,
    -3.066479806614716e1, 2.506628277459239e0
  ];

  private static readonly NORMINV_B = [
    -5.447609879822406e1, 1.615858368580409e2,
    -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1
  ];

  private static readonly NORMINV_C = [
    -7.784894002430293e-3, -3.223964580411365e-1,
    -2.400758277161838e0, -2.549732539343734e0,
    4.374664141464968e0, 2.938163982698783e0
  ];

  private static readonly NORMINV_D = [
    7.784695709041462e-3, 3.224671290700398e-1,
    2.445134137142996e0, 3.754408661907416e0
  ];

  /**
   * Set the rating data to be processed
   */
  setRatingData(data: RatingData[]): void {
    this.data = data.map(d => ({ ...d })); // Deep copy
  }

  /**
   * Get the processed rating data
   */
  getRatingData(): RatingData[] {
    return this.data;
  }

  /**
   * Run the Qubits algorithm once
   */
  runRatings(): void {
    if (this.data.length === 0) {
      logger.warn('No rating data to process');
      return;
    }

    logger.info(`Starting rating run for ${this.data.length} entries`);

    // Setup default values for new players
    for (const player of this.data) {
      if (player.numRatings === 0) {
        player.vol = 515;
        player.rating = AlgorithmQubits.INITIAL_SCORE;
      }
    }

    // COMPUTE AVERAGE RATING
    let rave = 0.0;
    for (const player of this.data) {
      rave += player.rating;
    }
    rave /= this.data.length;
    logger.debug(`Average Rating is: ${rave}`);

    // COMPUTE COMPETITION FACTOR
    let rtemp = 0;
    let vtemp = 0;
    for (const player of this.data) {
      vtemp += this.sqr(player.vol);
      rtemp += this.sqr(player.rating - rave);
    }

    const matchStdDevEquals = Math.sqrt(vtemp / this.data.length + rtemp / (this.data.length - 1));
    logger.debug(`Competition Factor is: ${matchStdDevEquals}`);

    // COMPUTE EXPECTED RANKS
    for (let i = 0; i < this.data.length; i++) {
      const player = this.data[i];
      let est = 0.5;

      for (let j = 0; j < this.data.length; j++) {
        const opponent = this.data[j];
        est += this.winprobability(opponent.rating, player.rating, opponent.vol, player.vol);
      }

      player.expectedRank = est;
      player.expectedPerformance = -this.normsinv((est - 0.5) / this.data.length);
    }

    // COMPUTE ACTUAL RANKS
    for (let i = 0; i < this.data.length;) {
      let max = Number.NEGATIVE_INFINITY;
      let count = 0;

      for (let j = 0; j < this.data.length; j++) {
        const player = this.data[j];
        if (player.score >= max && player.actualRank === 0) {
          if (player.score === max) {
            count++;
          } else {
            count = 1;
          }
          max = player.score;
        }
      }

      for (let j = 0; j < this.data.length; j++) {
        const player = this.data[j];
        if (player.score === max) {
          player.actualRank = i + 0.5 + count / 2.0;
          player.actualPerformance = -this.normsinv((i + count / 2.0) / this.data.length);
        }
      }

      i += count;
    }

    // UPDATE RATINGS
    for (const player of this.data) {
      const diff = player.actualPerformance! - player.expectedPerformance!;

      const oldrating = player.rating;
      const performedAs = oldrating + diff * matchStdDevEquals;
      let weight = (AlgorithmQubits.INITIAL_WEIGHT - AlgorithmQubits.FINAL_WEIGHT) /
                   (player.numRatings + 1) + AlgorithmQubits.FINAL_WEIGHT;

      // Get weight - reduce weight for highly rated people
      weight = 1 / (1 - weight) - 1;
      if (oldrating >= 2000 && oldrating < 2500) weight = weight * 4.5 / 5.0;
      if (oldrating >= 2500) weight = weight * 4.0 / 5.0;

      let newrating = (oldrating + weight * performedAs) / (1 + weight);

      // Apply and enforce a cap
      const cap = 150 + 1500 / (2 + player.numRatings);
      if (oldrating - newrating > cap) newrating = oldrating - cap;
      if (newrating - oldrating > cap) newrating = oldrating + cap;
      if (newrating < 1) newrating = 1;

      player.rating = Math.round(newrating);

      // Update volatility
      if (player.numRatings !== 0) {
        const oldVolatility = player.vol;
        const newVol = Math.sqrt((oldVolatility * oldVolatility) / (1 + weight) +
                                ((newrating - oldrating) * (newrating - oldrating)) / weight);
        player.vol = Math.round(newVol);
      } else {
        player.vol = Math.round(AlgorithmQubits.FIRST_VOLATILITY);
      }
    }

    // Increment number of ratings for everyone
    for (const player of this.data) {
      player.numRatings++;
    }

    // Debug output
    for (const player of this.data) {
      logger.debug(`CDR: ${player.coderId}:${player.rating},${player.vol}`);
    }
  }

  /**
   * Run the rating process: provisonal (all users) then non-provisional (experienced only)
   * This is equivalent to MarathonRatingProcess.runProcess() from the original Java implementation
   * Handles data loading, edge cases, dual algorithm runs, filtering, and persistence
   *
   * @param dbChallengeId - Challenge ID for loading and persistence
   */
  async runProcess(dbChallengeId: number): Promise<void> {
    // Load rating data
    const data = await database.loadRatingData(dbChallengeId);
    logger.debug(`Loaded ${data.length} rating entries for calculation`);
    this.setRatingData(data);
    // Edge case: No rating data found (already calculated)
    if (this.data.length === 0) {
      logger.warn('No rating data found for challenge, skipping calculation');
      return;
    }

    // Edge case: Single player challenge
    // The Qubits algorithm requires 2+ competitors to calculate a competition factor
    // With only 1 player: (vtemp / length + rtemp / (length - 1)) produces NaN due to division by zero
    if (this.data.length === 1) {
      logger.warn('Only 1 player in this challenge, skipping rating calculation (need 2+ for competition)');
      return;
    }

    // Split data into provisional (all users) and non-provisional (experienced only) groups
    const provisionalData = this.data.map(d => ({ ...d })); // Deep copy for provisional run
    const nonprovisionalData = this.data.filter(d => d.numRatings > 0).map(d => ({ ...d })); // Deep copy for non-provisional run

    logger.debug(`=== Running Qubits algorithm (provisional pool): ${provisionalData.length} users ===`);

    // 1. Run algorithm on provisional pool (all users)
    const algoProvisional = new AlgorithmQubits(provisionalData);
    algoProvisional.runRatings();
    const provisionalResults = algoProvisional.getRatingData();

    // 2. Filter to keep only NEW users (numRatings == 1 after algorithm increment)
    // The algorithm increments numRatings by 1, so new users will have numRatings == 1
    const provisionalFiltered = provisionalResults.filter(d => d.numRatings === 1);

    logger.debug(`Filtered provisional results: ${provisionalFiltered.length} new users`);

    // 3. Persist provisional ratings (new users only)
    if (provisionalFiltered.length > 0) {
      await database.persistRatingResults(dbChallengeId, provisionalFiltered);
      logger.info(`Persisted ratings for ${provisionalFiltered.length} provisional users`);
    }

    // 4. Run algorithm on non-provisional pool (experienced users only)
    if (nonprovisionalData.length > 1) {
      logger.debug(`=== Running Qubits algorithm (non-provisional pool): ${nonprovisionalData.length} users ===`);

      const algoNonprovisional = new AlgorithmQubits(nonprovisionalData);
      algoNonprovisional.runRatings();
      const nonprovisionalResults = algoNonprovisional.getRatingData();

      logger.debug(`Non-provisional results: ${nonprovisionalResults.length} experienced users`);

      // 5. Persist non-provisional ratings
      await database.persistRatingResults(dbChallengeId, nonprovisionalResults);
      logger.info(`Persisted ratings for ${nonprovisionalResults.length} non-provisional users`);
    } else if (nonprovisionalData.length === 1) {
      logger.warn('Only 1 experienced user in non-provisional pool, skipping non-provisional run');
    }
  }

  // Math utility functions

  private sqr(j: number): number {
    return j * j;
  }

  private winprobability(r1: number, r2: number, v1: number, v2: number): number {
    return (AlgorithmQubits.erf((r1 - r2) / Math.sqrt(2.0 * (v1 * v1 + v2 * v2))) + 1.0) * 0.5;
  }

  private static erf(z: number): number {
    const t = 1.0 / (1.0 + 0.5 * Math.abs(z));

    // Use Horner's method for polynomial approximation
    const poly = 1.00002368 +
      t * (0.37409196 +
        t * (0.09678418 +
          t * (-0.18628806 +
            t * (0.27886807 +
              t * (-1.13520398 +
                t * (1.48851587 +
                  t * (-0.82215223 +
                    t * 0.17087277
                  )
                )
              )
            )
          )
        )
      );

    const ans = 1 - t * Math.exp(-z * z - 1.26551223 + t * poly);
    return z >= 0 ? ans : -ans;
  }

  private static erfc(z: number): number {
    return 1.0 - AlgorithmQubits.erf(z);
  }

  private static refine(x: number, d: number): number {
    if (d > 0 && d < 1) {
      const e = 0.5 * AlgorithmQubits.erfc(-x / Math.sqrt(2.0)) - d;
      const u = e * Math.sqrt(2.0 * Math.PI) * Math.exp((x * x) / 2.0);
      x = x - u / (1.0 + x * u / 2.0);
    }
    return x;
  }

  private normsinv(p: number): number {
    if (p <= 0) return Number.NEGATIVE_INFINITY;
    if (p >= 1) return Number.POSITIVE_INFINITY;

    let z = 0;

    // Rational approximation for lower region
    if (p < AlgorithmQubits.P_LOW) {
      const q = Math.sqrt(-2 * Math.log(p));
      z = (((((AlgorithmQubits.NORMINV_C[0] * q + AlgorithmQubits.NORMINV_C[1]) * q +
               AlgorithmQubits.NORMINV_C[2]) * q + AlgorithmQubits.NORMINV_C[3]) * q +
               AlgorithmQubits.NORMINV_C[4]) * q + AlgorithmQubits.NORMINV_C[5]) /
             ((((AlgorithmQubits.NORMINV_D[0] * q + AlgorithmQubits.NORMINV_D[1]) * q +
                AlgorithmQubits.NORMINV_D[2]) * q + AlgorithmQubits.NORMINV_D[3]) * q + 1);
    }
    // Rational approximation for upper region
    else if (AlgorithmQubits.P_HIGH < p) {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      z = -(((((AlgorithmQubits.NORMINV_C[0] * q + AlgorithmQubits.NORMINV_C[1]) * q +
                AlgorithmQubits.NORMINV_C[2]) * q + AlgorithmQubits.NORMINV_C[3]) * q +
                AlgorithmQubits.NORMINV_C[4]) * q + AlgorithmQubits.NORMINV_C[5]) /
              ((((AlgorithmQubits.NORMINV_D[0] * q + AlgorithmQubits.NORMINV_D[1]) * q +
                 AlgorithmQubits.NORMINV_D[2]) * q + AlgorithmQubits.NORMINV_D[3]) * q + 1);
    }
    // Rational approximation for central region
    else {
      const q = p - 0.5;
      const r = q * q;
      z = (((((AlgorithmQubits.NORMINV_A[0] * r + AlgorithmQubits.NORMINV_A[1]) * r +
               AlgorithmQubits.NORMINV_A[2]) * r + AlgorithmQubits.NORMINV_A[3]) * r +
               AlgorithmQubits.NORMINV_A[4]) * r + AlgorithmQubits.NORMINV_A[5]) * q /
            (((((AlgorithmQubits.NORMINV_B[0] * r + AlgorithmQubits.NORMINV_B[1]) * r +
                AlgorithmQubits.NORMINV_B[2]) * r + AlgorithmQubits.NORMINV_B[3]) * r +
                AlgorithmQubits.NORMINV_B[4]) * r + 1);
    }

    z = AlgorithmQubits.refine(z, p);
    return z;
  }
}

export default AlgorithmQubits;
