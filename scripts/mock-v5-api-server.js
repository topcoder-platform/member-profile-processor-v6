/**
 * Mock V5 API Server for Topcoder Member Profile Processor
 * This server mocks all the V5 API endpoints used in the helper functions
 */

const http = require('http');
const url = require('url');
const querystring = require('querystring');

// Mock data for challenges
const challenge1 = {
  id: '30000001-1234-5678-9abc-def123456789',
  legacyId: 30000001,
  name: 'Marathon Match Challenge 1',
  type: 'Code',
  status: 'Active',
  attended : 'N',
  legacy: {
    subTrack: 'MARATHON_MATCH'
  }
};

const challenge2 = {
  id: '30000002-1234-5678-9abc-def123456789',
  legacyId: 30000002,
  name: 'Marathon Match Challenge 2',
  type: 'Code',
  status: 'Active',
  legacy: {
    subTrack: 'MARATHON_MATCH'
  }
};

const challenge3 = {
  id: '30054163-1234-5678-9abc-def123456789',
  legacyId: 30054163,
  name: 'Test Scenario Challenge',
  type: 'Code',
  status: 'Completed',
  legacy: {
    subTrack: 'MARATHON_MATCH'
  }
};

const challenges = [challenge1, challenge2, challenge3];

// Mock data for submissions
const submission1 = {
  id: '14a1b211-283b-4f9a-809f-71e200646560',
  challengeId: '30000001-1234-5678-9abc-def123456789',
  memberId: '2', // alice_coder (User ID 2) - matches database
  legacySubmissionId: 2001,
  resource: 'submission',
  url: 'http://content.topcoder.com/some/path',
  type: 'Contest Submission',
  submissionPhaseId: 95245,
  created: '2024-01-01T10:00:00.000Z',
  updated: '2024-01-01T10:00:00.000Z',
  reviewSummation: {
    id: 'review-summation-1',
    score: 75.0, // matches database score
    status: 'completed'
  }
};

const submission2 = {
  id: '14a1b211-283b-4f9a-809f-71e200646561',
  challengeId: '30000002-1234-5678-9abc-def123456789',
  memberId: '1', // bob_hacker (User ID 1) - matches database
  legacySubmissionId: 2002,
  resource: 'submission',
  url: 'http://content.topcoder.com/some/path',
  type: 'Contest Submission',
  submissionPhaseId: 95245,
  created: '2024-01-01T10:00:00.000Z',
  updated: '2024-01-01T10:00:00.000Z',
  reviewSummation: {
    id: 'review-summation-2',
    score: 77.5, // matches database score
    status: 'completed'
  }
};

const submission3 = {
  id: '14a1b211-283b-4f9a-809f-71e200646562',
  challengeId: '30054163-1234-5678-9abc-def123456789',
  memberId: '3', // test_user_marathon (User ID 3) - matches database
  legacySubmissionId: 2003,
  resource: 'submission',
  url: 'http://content.topcoder.com/some/path',
  type: 'Contest Submission',
  submissionPhaseId: 95245,
  created: '2024-01-01T10:00:00.000Z',
  updated: '2024-01-01T10:00:00.000Z',
  reviewSummation: {
    id: 'review-summation-3',
    score: 92.5, // matches database score
    status: 'completed'
  }
};

const submissions = [submission1, submission2, submission3];

// Mock response for rating calculation
const ratingCalculationResponse = {
  id: 'rating-calculation-1',
  challengeId: '30000001-1234-5678-9abc-def123456789',
  status: 'completed',
  message: 'Rating calculation initiated successfully'
};

// Mock response for load ratings
const loadRatingsResponse = {
  id: 'load-ratings-1',
  challengeId: '30000001-1234-5678-9abc-def123456789',
  status: 'completed',
  message: 'Ratings loaded successfully'
};

// Mock response for load coders
const loadCodersResponse = {
  id: 'load-coders-1',
  challengeId: '30000001-1234-5678-9abc-def123456789',
  status: 'completed',
  message: 'Coders loaded successfully'
};

// Helper function to send JSON response
function sendJsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Helper function to parse request body
function parseRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        resolve({});
      }
    });
  });
}

// Create the mock server
const mockApi = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const query = parsedUrl.query;
  
  console.log(`Mock V5 API Request: ${req.method} ${path}`, query);

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // GET /challenges - Get challenge details
    if (req.method === 'GET' && path === '/challenges') {
      if (query.legacyId) {
        const challenge = challenges.find(c => c.legacyId === parseInt(query.legacyId));
        if (challenge) {
          return sendJsonResponse(res, 200, [challenge]);
        } else {
          return sendJsonResponse(res, 200, []);
        }
      }
      return sendJsonResponse(res, 200, challenges);
    }

    // GET /submissions - Get submissions for a challenge
    if (req.method === 'GET' && path === '/submissions') {
      if (query.challengeId) {
        const challengeSubmissions = submissions.filter(s => s.challengeId === query.challengeId);
        
        // Handle pagination
        const perPage = parseInt(query.perPage) || 500;
        const page = parseInt(query.page) || 1;
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const paginatedSubmissions = challengeSubmissions.slice(startIndex, endIndex);
        
        // Set pagination headers
        const totalPages = Math.ceil(challengeSubmissions.length / perPage);
        res.setHeader('x-total-pages', totalPages.toString());
        res.setHeader('x-page', page.toString());
        res.setHeader('x-per-page', perPage.toString());
        res.setHeader('x-total', challengeSubmissions.length.toString());
        
        return sendJsonResponse(res, 200, paginatedSubmissions);
      }
      return sendJsonResponse(res, 200, submissions);
    }

    // POST /ratings/mm/calculate - Initiate rating calculation
    if (req.method === 'POST' && path === '/ratings/mm/calculate') {
      const body = await parseRequestBody(req);
      console.log('Rating calculation request body:', body);
      
      if (body.challengeId) {
        return sendJsonResponse(res, 200, [ratingCalculationResponse]);
      } else {
        return sendJsonResponse(res, 400, { error: 'challengeId is required' });
      }
    }

    // POST /ratings/mm/load - Load ratings
    if (req.method === 'POST' && path === '/ratings/mm/load') {
      const body = await parseRequestBody(req);
      console.log('Load ratings request body:', body);
      
      if (body.challengeId) {
        return sendJsonResponse(res, 200, [loadRatingsResponse]);
      } else {
        return sendJsonResponse(res, 400, { error: 'challengeId is required' });
      }
    }

    // POST /ratings/coders/load - Load coders
    if (req.method === 'POST' && path === '/ratings/coders/load') {
      const body = await parseRequestBody(req);
      console.log('Load coders request body:', body);
      
      if (body.challengeId) {
        return sendJsonResponse(res, 200, [loadCodersResponse]);
      } else {
        return sendJsonResponse(res, 400, { error: 'challengeId is required' });
      }
    }

    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', path, method: req.method }));

  } catch (error) {
    console.error('Mock server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

// Start the server if run directly
if (require.main === module) {
  const port = process.env.MOCK_V5_API_PORT || 3001;
  mockApi.listen(port, () => {
    console.log(`Mock V5 API Server is listening on port ${port}`);
    console.log(`Set V5_API_URL=http://localhost:${port} to use this mock server`);
    console.log('\nAvailable endpoints:');
    console.log('  GET  /challenges?legacyId=<id>');
    console.log('  GET  /submissions?challengeId=<id>&page=<page>&perPage=<perPage>');
    console.log('  POST /ratings/mm/calculate');
    console.log('  POST /ratings/mm/load');
    console.log('  POST /ratings/coders/load');
  });
}

// Export for use in other files
module.exports = {
  mockApi,
  challenges,
  submissions
}; 