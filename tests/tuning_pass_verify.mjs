import http from 'http';

function check() {
  http.get('http://localhost:3000/', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('HTTP status:', res.statusCode);
      const checks = [
        ['Hero badge removed', !data.includes('Client-Side DLP Protection')],
        ['Privacy Architecture badge removed', !data.includes('Privacy Architecture')],
        ['Active Beta badge removed', !data.includes('Active Beta')],
        ['Hero headline present', data.includes('Private AI chat that protects sensitive data before it leaves your device.')],
        ['DLP Notice restyled text present', data.includes('1 item masked. Aadhaar replaced with')],
        ['DLP Notice has inline mono placeholder', data.includes('[AADHAAR_1]')],
        ['Beta pricing plain text present', data.includes('/ free during beta')],
        ['Canvas background present', data.includes('<canvas aria-hidden="true"')],
        ['Features section present', data.includes('id="features"')],
        ['How it works section present', data.includes('id="how-it-works"')],
        ['Pricing section present', data.includes('id="pricing"')],
      ];
      let allPass = true;
      checks.forEach(([desc, passed]) => {
        if (!passed) allPass = false;
        console.log((passed ? 'PASS: ' : 'FAIL: ') + desc);
      });
      process.exit(allPass ? 0 : 1);
    });
  }).on('error', (err) => {
    console.error('Error fetching landing page:', err.message);
    process.exit(1);
  });
}

check();
