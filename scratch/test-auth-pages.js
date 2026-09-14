const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const viewports = [
    { name: 'desktop-1440x900', width: 1440, height: 900 },
    { name: 'desktop-1365x768', width: 1365, height: 768 },
    { name: 'desktop-1920x1080', width: 1920, height: 1080 },
    { name: 'tablet-768x1024', width: 768, height: 1024 },
    { name: 'mobile-390x844', width: 390, height: 844 },
    { name: 'mobile-375x812', width: 375, height: 812 }
  ];

  // 1. Test Login on all viewports
  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(outDir, `login-${vp.name}.png`) });
    console.log(`Captured: login-${vp.name}.png`);
  }

  // 2. Test Sign Up Step 1 (Role Selection) on 1440x900
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/auth/login?tab=signup', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(outDir, 'signup-step1-1440x900.png') });
  console.log('Captured: signup-step1-1440x900.png');

  // Select Student role and go to Step 2
  const roleButtons = await page.$$('button');
  for (const btn of roleButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Student') && text.includes('Find rooms')) {
      await btn.click();
      console.log('Clicked Student role');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, 'signup-role-selected.png') });

  // Click Continue to Details
  const continueButtons = await page.$$('button');
  for (const btn of continueButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Continue to Details')) {
      await btn.click();
      console.log('Clicked Continue to Details');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, 'signup-step2-details.png') });
  console.log('Captured: signup-step2-details.png');

  // 3. Test Mobile Sign Up Step 1
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/auth/login?tab=signup', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(outDir, 'signup-mobile-390x844.png') });

  // 4. Test Forgot Password
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/auth/forgot-password', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(outDir, 'forgot-password-1440x900.png') });

  // 5. Card position stability test (compare coordinates of card on Login vs Signup)
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle2' });
  const loginCardBox = await page.evaluate(() => {
    const el = document.querySelector('[role="tablist"]')?.closest('.max-w-\\[460px\\], .max-w-\\[476px\\]') || document.querySelector('[role="tablist"]')?.parentElement?.parentElement;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  await page.click('#auth-tab-signup');
  await new Promise(r => setTimeout(r, 300));
  const signupCardBox = await page.evaluate(() => {
    const el = document.querySelector('[role="tablist"]')?.closest('.max-w-\\[460px\\], .max-w-\\[476px\\]') || document.querySelector('[role="tablist"]')?.parentElement?.parentElement;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  console.log('Login Card Box:', loginCardBox);
  console.log('Signup Card Box:', signupCardBox);

  await browser.close();
  console.log('All screenshots and measurements completed successfully');
})();
