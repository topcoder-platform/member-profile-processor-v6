/**
 * Check Database Data Script (new schema)
 *
 * This script connects to the database and extracts real values
 * to use in Kafka test messages.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabaseData() {
  try {
    console.log('🔍 Checking database for existing data...\n');

    // Check rounds
    const rounds = await prisma.round.findMany({
      take: 5,
      orderBy: { id: 'desc' }
    });

    console.log('📊 Rounds found:', rounds.length);
    if (rounds.length > 0) {
      console.log('Sample rounds:');
      rounds.forEach(round => {
        console.log(`- ID: ${round.id}, Name: ${round.name || 'N/A'}, Rated: ${round.ratedInd ?? 'N/A'}`);
      });
    }

    // Check project_info mappings used for round lookup
    const projectMappings = await prisma.projectInfo.findMany({
      where: { projectInfoTypeId: 56 },
      take: 5,
      orderBy: { projectId: 'desc' }
    });

    console.log('\n🗺️ Project mappings found:', projectMappings.length);
    if (projectMappings.length > 0) {
      console.log('Sample project mappings:');
      projectMappings.forEach(mapping => {
        console.log(`- Project ID: ${mapping.projectId} -> Round ID: ${mapping.value} (type ${mapping.projectInfoTypeId})`);
      });
    }

    // Check users
    const users = await prisma.user.findMany({
      take: 5,
      orderBy: { id: 'desc' }
    });

    console.log('\n👥 Users found:', users.length);
    if (users.length > 0) {
      console.log('Sample users:');
      users.forEach(user => {
        console.log(`- ID: ${user.id}, Handle: ${user.handle}`);
      });
    }

    // Check coders
    const coders = await prisma.coder.findMany({
      take: 5,
      orderBy: { id: 'desc' }
    });

    console.log('\n🧑‍💻 Coders found:', coders.length);
    if (coders.length > 0) {
      console.log('Sample coders:');
      coders.forEach(coder => {
        console.log(`- ID: ${coder.id}, User ID: ${coder.userId}`);
      });
    }

    // Check long comp results
    const longCompResults = await prisma.longCompResult.findMany({
      take: 10,
      orderBy: { id: 'desc' }
    });

    console.log('\n🏅 Long Comp Results found:', longCompResults.length);
    if (longCompResults.length > 0) {
      console.log('Sample long comp results:');
      longCompResults.forEach(lcr => {
        const ratingState = lcr.newRating !== null || lcr.newVol !== null ? 'rated' : 'unrated';
        console.log(`- Round: ${lcr.roundId} | User: ${lcr.coderId} | Attended: ${lcr.attended || 'N/A'} | Score: ${lcr.systemPointTotal ?? 'N/A'} | ${ratingState}`);
      });
    }

    // Check algo ratings (type 3 = Marathon Match)
    const algoRatings = await prisma.algoRating.findMany({
      where: { algoRatingTypeId: 3 },
      take: 5,
      orderBy: { coderId: 'desc' }
    });

    console.log('\n📈 Algo Ratings (MM) found:', algoRatings.length);
    if (algoRatings.length > 0) {
      console.log('Sample algo ratings:');
      algoRatings.forEach(ar => {
        console.log(`- Coder: ${ar.coderId} | Rating: ${ar.rating} | Vol: ${ar.vol} | NumRatings: ${ar.numRatings}`);
      });
    }

    // Extract sample data for Kafka messages
    console.log('\n🎯 Sample Data for Kafka Messages:');
    console.log('=====================================');

    if (projectMappings.length > 0) {
      const sampleMapping = projectMappings[0];
      console.log(`Project ID (legacyId): ${sampleMapping.projectId}`);
      console.log(`Mapped Round ID: ${sampleMapping.value}`);
    }

    if (users.length > 0) {
      const sampleUser = users[0];
      console.log(`User Handle: ${sampleUser.handle}`);
      console.log(`User ID: ${sampleUser.id}`);
    }

    if (longCompResults.length > 0) {
      const sampleLcr = longCompResults[0];
      console.log(`Sample LongCompResult: User ${sampleLcr.coderId} in Round ${sampleLcr.roundId}`);
    }

    console.log('\n💡 Use these values in your Kafka test messages.');

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  checkDatabaseData();
}

module.exports = { checkDatabaseData };
