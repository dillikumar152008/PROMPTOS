// PromptOS DLP API Endpoints Integration Test

import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runApiTests() {
  console.log('\n======================================================');
  console.log('   PROMPTOS DLP API INTEGRATION VERIFICATION');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(cond, name, info = '') {
    total++;
    if (cond) {
      passed++;
      console.log(`  ✓ PASS: ${name}`);
    } else {
      console.error(`  ✗ FAIL: ${name} ${info}`);
    }
  }

  try {
    // 1. Test POST /api/dlp/scan with synthetic PII
    console.log('[API TEST 1] POST /api/dlp/scan with PII payload');
    const scanRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3001,
        path: '/api/dlp/scan',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        text: 'Employee KYC: Aadhaar 2345 6789 0124 and PAN ABCPE1234F. Email: test@example.com',
        filename: 'kyc_sample.txt',
      }
    );

    assert(scanRes.status === 200, 'POST /api/dlp/scan returns 200 OK');
    assert(scanRes.body.scanId && scanRes.body.scanId.startsWith('scan_'), 'Returns valid scanId');
    assert(scanRes.body.findings.length >= 2, 'Detects PII findings via API');
    assert(scanRes.body.policy.decision === 'WARN', 'Correct policy decision WARN');
    assert(scanRes.body.maskedText.includes('[AADHAAR_1]'), 'Generates masked text with placeholders');

    // 2. Test POST /api/dlp/scan with CRITICAL credentials (BLOCK decision)
    console.log('\n[API TEST 2] POST /api/dlp/scan with Critical Private Key');
    const blockRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3001,
        path: '/api/dlp/scan',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        text: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Y1m9...\n-----END RSA PRIVATE KEY-----',
      }
    );

    assert(blockRes.status === 200, 'POST /api/dlp/scan returns 200 for critical scan');
    assert(blockRes.body.policy.decision === 'BLOCK', 'Evaluates decision as BLOCK for Private Key');
    assert(blockRes.body.risk.level === 'CRITICAL', 'Risk level is CRITICAL');

    // 3. Test GET /api/dlp/audit
    console.log('\n[API TEST 3] GET /api/dlp/audit Log Retrieval');
    const auditRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/dlp/audit',
      method: 'GET',
    });

    assert(auditRes.status === 200, 'GET /api/dlp/audit returns 200 OK');
    assert(Array.isArray(auditRes.body.logs), 'Returns logs array');
    assert(auditRes.body.logs.length >= 2, 'Audit logs recorded past scans');
    assert(auditRes.body.stats && auditRes.body.stats.totalScans >= 2, 'Stats calculation working');

    // 4. Test GET /api/dlp/policies
    console.log('\n[API TEST 4] GET /api/dlp/policies Configuration');
    const policyRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/dlp/policies',
      method: 'GET',
    });

    assert(policyRes.status === 200, 'GET /api/dlp/policies returns 200 OK');
    assert(Array.isArray(policyRes.body.policies), 'Returns policies list');
    assert(policyRes.body.config.blockThreshold === 85, 'Returns default blockThreshold');

    console.log('\n------------------------------------------------------');
    console.log(`API TEST SUMMARY: ${passed}/${total} passed`);
    console.log('------------------------------------------------------\n');
  } catch (err) {
    console.error('API Test Error (is server running on port 3001?):', err.message);
  }
}

runApiTests();
