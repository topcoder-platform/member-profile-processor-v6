/**
 * Database Seed Script for Member Profile Processor (new schema)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Static test data
const STATIC_DATA = {
  rounds: [
    { id: 30000001, name: 'Marathon Match Round 1', ratedInd: 1, tcDirectProjectId: 30000001 },
    { id: 30000002, name: 'Marathon Match Round 2', ratedInd: 1, tcDirectProjectId: 30000002 },
    { id: 30000003, name: 'Marathon Match Round 3 (Single Competitor)', ratedInd: 1, tcDirectProjectId: 30000003 }
  ],

  users: [
    { handle: 'alice_coder' },
    { handle: 'bob_hacker' },
    { handle: 'charlie_newbie' },
    { handle: 'no_coder_user' }
  ]
};

/**
 * Generate long comp result entries
 *
 * Includes:
 * - 2 experienced users (alice, bob) - have algo_rating entries
 * - 1 provisional/new user (charlie) - no prior algo_rating
 */
function generateLongCompResults(roundIds, userIds) {
  const results = [];

  for (let i = 0; i < userIds.length; i++) {
    const roundId = roundIds[0];
    const userId = userIds[i];

    results.push({
      roundId,
      coderId: userId,
      attended: i === 2 ? 'N' : 'Y',
      placed: i < 10 ? i + 1 : null,
      systemPointTotal: 82.0 - (i * 5.0),
      pointTotal: 82.0 - (i * 5.0),
      rated: 0,
      newRating: null,
      newVol: null
    });
  }

  // Already-rated entry (should be skipped) on a different round
  results.push({
    roundId: roundIds[1],
    coderId: userIds[0],
    attended: 'Y',
    placed: 1,
    systemPointTotal: 95.0,
    pointTotal: 95.0,
    rated: 1,
    newRating: 1600,
    newVol: 300
  });

  // Single competitor round (roundIds[2])
  results.push({
    roundId: roundIds[2],
    coderId: userIds[0],
    attended: 'Y',
    placed: 1,
    systemPointTotal: 90.0,
    pointTotal: 90.0,
    rated: 0
  });

  return results;
}

/**
 * Generate algo_rating entries for experienced users only
 */
function generateAlgoRatings(coderIds) {
  const algoRatings = [];

  // Only create ratings for first 2 coders (experienced users)
  for (let i = 0; i < Math.min(2, coderIds.length); i++) {
    const coderId = coderIds[i];

    algoRatings.push({
      coderId,
      algoRatingTypeId: 3,
      rating: 1400 + (i * 100),
      vol: 200 + (i * 50),
      numRatings: 5,
      roundId: 30000001
    });
  }

  return algoRatings;
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding with static data...\n');

    // Clear existing data (order matters for FK constraints)
    console.log('🧹 Clearing existing data...');
    await prisma.longCompResult.deleteMany();
    await prisma.algoRating.deleteMany();
    await prisma.coder.deleteMany();
    await prisma.user.deleteMany();
    await prisma.round.deleteMany();
    await prisma.algoRatingType.deleteMany();

    console.log('✅ Database cleared\n');

    // Insert algo rating type (Marathon Match = 3)
    console.log('🏷️  Inserting algo rating types...');
    await prisma.algoRatingType.create({
      data: { id: 3, algoRatingTypeDesc: 'Marathon Match' }
    });
    console.log('✅ Inserted algo rating types\n');

    // Insert rounds
    console.log('🏁 Inserting rounds...');
    const createdRounds = await Promise.all(
      STATIC_DATA.rounds.map(round => prisma.round.create({ data: round }))
    );
    console.log(`✅ Inserted ${createdRounds.length} rounds\n`);

    // Insert users
    console.log('👥 Inserting users...');
    const createdUsers = await Promise.all(
      STATIC_DATA.users.map(user => prisma.user.create({ data: user }))
    );
    console.log(`✅ Inserted ${createdUsers.length} users\n`);

    // Insert coders (1:1 with users), skip one user to test missing coder handling
    console.log('🧑‍💻 Inserting coders...');
    const createdCoders = await Promise.all(
      createdUsers
        .filter(user => user.handle !== 'no_coder_user')
        .map(user => prisma.coder.create({ data: { userId: user.id } }))
    );
    console.log(`✅ Inserted ${createdCoders.length} coders\n`);

    // Insert long comp results
    console.log('🏅 Inserting long comp results...');
    const roundIds = createdRounds.map(r => r.id);
    const userIds = createdUsers.map(u => u.id);
    const longCompResults = generateLongCompResults(roundIds, userIds);

    await Promise.all(
      longCompResults.map(lcr => prisma.longCompResult.create({ data: lcr }))
    );
    console.log(`✅ Inserted ${longCompResults.length} long comp results\n`);

    // Insert algo ratings for experienced users
    console.log('📈 Inserting algo ratings...');
    const coderIds = createdCoders.map(c => c.id);
    const algoRatings = generateAlgoRatings(coderIds);

    await Promise.all(
      algoRatings.map(ar => prisma.algoRating.create({ data: ar }))
    );
    console.log(`✅ Inserted ${algoRatings.length} algo ratings\n`);

    // Summary
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Rounds: ${createdRounds.length}`);
    console.log(`   - Users: ${createdUsers.length}`);
    console.log(`   - Coders: ${createdCoders.length}`);
    console.log(`   - Long Comp Results: ${longCompResults.length}`);
    console.log(`   - Algo Ratings: ${algoRatings.length}`);

    // Sample data for testing
    console.log('\n🎯 Sample Data for Testing:');
    console.log('============================');
    console.log(`Sample Round ID (legacyId): ${createdRounds[0].id}`);
    console.log(`Single Competitor Round ID: ${createdRounds[2].id}`);
    console.log(`Sample User Handle: ${createdUsers[0].handle}`);
    console.log(`User Without Coder: ${createdUsers.find(u => u.handle === 'no_coder_user').handle}`);

    console.log('\n🧪 Seed Scenarios:');
    console.log(' - One attendee starts as attended=N (should be updated)');
    console.log(' - One entry has newRating/newVol already set (should be skipped)');
    console.log(' - One user is missing a coder row (should be created)');
    console.log(' - One round has a single competitor (should be skipped by algorithm)');

    console.log('\n💡 You can now run your Kafka tests with this data!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Add specific test data for known test scenarios
 */
async function addTestScenarioData() {
  try {
    console.log('\n🧪 Adding specific test scenario data...');

    // Add the specific round used in testing (legacyId: 30054163)
    const testRound = await prisma.round.create({
      data: {
        id: 30054163,
        name: 'Test Marathon Match Round',
        ratedInd: 1
      }
    });

    // Add a test user + coder
    const testUser = await prisma.user.create({
      data: { handle: 'test_user_marathon' }
    });
    const testCoder = await prisma.coder.create({
      data: { userId: testUser.id }
    });

    // Add long comp result entry
    await prisma.longCompResult.create({
      data: {
        roundId: testRound.id,
        coderId: testUser.id,
        attended: 'N',
        placed: null,
        systemPointTotal: 85.5,
        pointTotal: 85.5,
        rated: 1
      }
    });

    // Add algo rating entry
    await prisma.algoRating.create({
      data: {
        coderId: testCoder.id,
        algoRatingTypeId: 3,
        rating: 1500,
        vol: 250,
        numRatings: 5,
        roundId: testRound.id
      }
    });

    console.log('✅ Test scenario data added');
    console.log(`   - Test Round: ${testRound.id}`);
    console.log(`   - Test User: ${testUser.handle}`);
  } catch (error) {
    console.error('❌ Error adding test scenario data:', error);
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => addTestScenarioData())
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase, addTestScenarioData };
