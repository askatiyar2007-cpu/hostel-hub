const puppeteer = require('c:\\Users\\BIT\\Downloads\\hostelhub combine\\files\\node_modules\\puppeteer');
const path = require('path');

const artifactDir = 'C:\\Users\\BIT\\.gemini\\antigravity\\brain\\ca1e17d1-f2a7-4336-a588-890b56601168';

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // 1. Desktop capture (1280x900)
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/preview-student', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(artifactDir, 'verified_student_dashboard_desktop.png'), fullPage: true });
  console.log('Desktop screenshot saved!');

  // 2. Mobile capture (390x844)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(artifactDir, 'verified_student_dashboard_mobile.png'), fullPage: true });
  console.log('Mobile screenshot saved!');

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
