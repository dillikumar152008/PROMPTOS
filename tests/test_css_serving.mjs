import http from 'http';

http.get('http://localhost:3000/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTML response status:', res.statusCode);
    const match = data.match(/href="(\/_next\/static\/css\/[^"]+)"/);
    if (match) {
      const cssPath = match[1];
      console.log('Found CSS link:', cssPath);
      http.get('http://localhost:3000' + cssPath, (cssRes) => {
        console.log('CSS file status code:', cssRes.statusCode);
        let cssData = '';
        cssRes.on('data', c => cssData += c);
        cssRes.on('end', () => {
          console.log('CSS file byte length:', cssData.length);
          console.log('CSS includes background color:', cssData.includes('#09090b'));
          process.exit(cssRes.statusCode === 200 ? 0 : 1);
        });
      });
    } else {
      console.log('No CSS link found in HTML!');
      process.exit(1);
    }
  });
}).on('error', err => {
  console.error('Error:', err.message);
  process.exit(1);
});
