const puppeteer = require('puppeteer');

const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1365x768', width: 1365, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '375x812', width: 375, height: 812 },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const page = await browser.newPage();

  // Listen to console logs and page errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('PAGE CONSOLE ERROR:', msg.text());
  });
  page.on('pageerror', (err) => {
    console.log('PAGE ERROR:', err.message);
  });

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

    // Allow count-up animations & IntersectionObserver to run
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 500));

    // Check horizontal scroll
    const overflow = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    console.log(`Viewport ${vp.name}: hasHorizontalScroll=${overflow.hasHorizontalScroll} (scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth})`);

    const screenshotPath = `scratch/homepage-${vp.name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${screenshotPath}`);

    // If on mobile (390x844), test mobile drawer interaction
    if (vp.name === '390x844') {
      const menuButton = await page.$('button[aria-label="Open main menu"]');
      if (menuButton) {
        await menuButton.click();
        await new Promise((r) => setTimeout(r, 500));
        await page.screenshot({ path: 'scratch/homepage-mobile-drawer-open.png' });
        console.log('Saved screenshot: scratch/homepage-mobile-drawer-open.png');
        const closeButton = await page.$('button[aria-label="Close menu"]');
        if (closeButton) {
          await closeButton.click();
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    }
  }

  await browser.close();
  console.log('All responsive tests completed successfully!');
})();
