const puppeteer = require('c:\\Users\\BIT\\Downloads\\hostelhub combine\\files\\node_modules\\puppeteer');
const path = require('path');
const artifactDir = 'C:\\Users\\BIT\\.gemini\\antigravity\\brain\\ca1e17d1-f2a7-4336-a588-890b56601168';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/preview-student', { waitUntil: 'networkidle0' });

  // 1. Click Pending tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const pendingBtn = btns.find(b => b.textContent && b.textContent.includes('Pending Request'));
    if (pendingBtn) pendingBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, 'verified_student_pending_request.png'), fullPage: true });
  console.log('Pending request screenshot saved!');

  // 2. Click Empty / Onboarding tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const emptyBtn = btns.find(b => b.textContent && b.textContent.includes('New Student'));
    if (emptyBtn) emptyBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, 'verified_student_onboarding.png'), fullPage: true });
  console.log('Onboarding screenshot saved!');

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
