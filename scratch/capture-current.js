const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Homepage
  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'scratch/current-homepage-1440.png', fullPage: true });
  console.log('Saved scratch/current-homepage-1440.png');

  // 2. Login
  console.log('Navigating to http://localhost:3000/auth/login ...');
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'scratch/current-login.png' });
  console.log('Saved scratch/current-login.png');

  await browser.close();
})();
