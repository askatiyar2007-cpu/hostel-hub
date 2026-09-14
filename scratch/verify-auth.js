/* HostelHub auth UI verification — real browser checks. */
const puppeteer = require('puppeteer');

const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function log(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
}

async function getCardRect(page) {
  return page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(
      (d) => typeof d.className === 'string' && d.className.includes('rounded-[28px]')
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, width: r.width, height: r.height };
  });
}

async function getTransformX(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const tf = getComputedStyle(el).transform;
    if (!tf || tf === 'none') return 0;
    const m = tf.match(/matrix\(([^)]+)\)/);
    return m ? parseFloat(m[1].split(',')[4]) : null;
  }, selector);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + String(err).slice(0, 200)));

  // ---------- 1365x768 ----------
  await page.setViewport({ width: 1365, height: 768 });
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle2', timeout: 180000 });
  await sleep(2000);

  // TEST A: card stationary across Login -> Signup -> Login
  const r1 = await getCardRect(page);
  if (!r1) { log('card found', false, 'no card'); await browser.close(); return; }
  log('card found', true, JSON.stringify(r1));

  const tabs = 'button[role="tab"]';
  await page.evaluate((sel) => {
    Array.from(document.querySelectorAll(sel)).find((b) => b.textContent.trim() === 'Sign Up').click();
  }, tabs);
  await sleep(900); // crossfade 300ms + settle
  const r2 = await getCardRect(page);

  await page.evaluate((sel) => {
    Array.from(document.querySelectorAll(sel)).find((b) => b.textContent.trim() === 'Sign In').click();
  }, tabs);
  await sleep(900);
  const r3 = await getCardRect(page);

  await page.evaluate((sel) => {
    Array.from(document.querySelectorAll(sel)).find((b) => b.textContent.trim() === 'Sign Up').click();
  }, tabs);
  await sleep(900);
  const r4 = await getCardRect(page);

  const tol = 0.51;
  const stableTop = Math.abs(r1.top - r2.top) < tol && Math.abs(r1.top - r3.top) < tol && Math.abs(r1.top - r4.top) < tol;
  const stableLeft = Math.abs(r1.left - r2.left) < tol && Math.abs(r1.left - r3.left) < tol && Math.abs(r1.left - r4.left) < tol;
  const stableW = Math.abs(r1.width - r2.width) < tol && Math.abs(r1.width - r3.width) < tol && Math.abs(r1.width - r4.width) < tol;
  const sameH = Math.abs(r1.height - r2.height) < tol && Math.abs(r1.height - r4.height) < tol;
  log('TEST1 card top stable (1365x768)', stableTop, `tops: ${r1.top.toFixed(1)}, ${r2.top.toFixed(1)}, ${r3.top.toFixed(1)}, ${r4.top.toFixed(1)}`);
  log('TEST1 card left stable', stableLeft, `lefts: ${r1.left.toFixed(1)}, ${r2.left.toFixed(1)}, ${r3.left.toFixed(1)}, ${r4.left.toFixed(1)}`);
  log('TEST1 card width stable', stableW, `widths: ${r1.width}, ${r2.width}, ${r3.width}, ${r4.width}`);
  log('TEST1 card height stable (login vs signup)', sameH, `heights: ${r1.height.toFixed(0)}, ${r2.height.toFixed(0)}, ${r3.height.toFixed(0)}, ${r4.height.toFixed(0)}`);

  // framer-motion must not touch the card: no motion inline transform on card or ancestors
  const cardTransform = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(
      (d) => typeof d.className === 'string' && d.className.includes('rounded-[28px]')
    );
    let node = el;
    while (node && node !== document.body) {
      const t = getComputedStyle(node).transform;
      if (t && t !== 'none') return t;
      node = node.parentElement;
    }
    return 'none';
  });
  log('TEST1 no transform on card or ancestors', cardTransform === 'none', String(cardTransform));

  // TEST 5: password placeholders fully visible — measure on signup STEP 2
  await page.evaluate(() => {
    const roleCard = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Find rooms, manage bills'));
    if (roleCard) roleCard.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Continue to Details'));
    if (btn) btn.click();
  });
  await sleep(900);
  const ph = await page.evaluate(() => {
    const measure = (el) => {
      const cs = getComputedStyle(el);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const w = ctx.measureText(el.placeholder).width;
      const rect = el.getBoundingClientRect();
      // text starts after left icon (~40px), must end before right eye button (~44px)
      return { placeholder: el.placeholder, inputW: rect.width, textW: w, fits: 40 + w < rect.width - 44 };
    };
    const pw = document.getElementById('signup-password');
    const cpw = document.getElementById('signup-confirmPassword');
    if (!pw || !cpw) return null;
    return [measure(pw), measure(cpw)];
  });
  if (ph) {
    ph.forEach((p) => log(`TEST5 placeholder fits: "${p.placeholder}"`, p.fits, `input ${p.inputW.toFixed(0)}px, text ${p.textW.toFixed(0)}px`));
  } else {
    log('TEST5 password fields present', false, 'signup-password inputs not found');
  }

  // TEST 6: all login options
  const loginOpts = await page.evaluate((sel) => {
    const clickBtn = (name) => Array.from(document.querySelectorAll(sel)).find((b) => b.textContent.trim() === name)?.click();
    return true;
  }, tabs);
  await page.evaluate((sel) => {
    Array.from(document.querySelectorAll(sel)).find((b) => b.textContent.trim() === 'Sign In').click();
  }, tabs);
  await sleep(700);
  const loginContent = await page.evaluate(() => document.body.innerText);
  const hasLogin = (s) => loginContent.includes(s);
  log('TEST6 login: Google button', hasLogin('Continue with Google'), '');
  log('TEST6 login: OR divider', hasLogin('OR CONTINUE WITH EMAIL') || hasLogin('Or continue with email'), '');
  log('TEST6 login: Remember me', hasLogin('Remember me'), '');
  log('TEST6 login: Forgot password', hasLogin('Forgot password?'), '');
  log('TEST6 login: LOGIN button', hasLogin('LOGIN'), '');
  log('TEST6 login: Welcome Back', hasLogin('Welcome Back'), '');
  log('TEST6 login: switch to Sign Up', hasLogin("Don't have an account?"), '');

  // Signup step 1 & 2 content
  await page.evaluate((sel) => {
    Array.from(document.querySelectorAll(sel)).find((b) => b.textContent.trim() === 'Sign Up').click();
  }, tabs);
  await sleep(700);
  // we may already be on signup step 2 (from TEST5) — go back to step 1 first
  await page.evaluate(() => {
    const back = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Back');
    if (back) back.click();
  });
  await sleep(700);
  const signup1 = await page.evaluate(() => document.body.innerText);
  log('TEST6 signup: Student & Owner roles', signup1.includes('Student') && signup1.includes('Hostel Owner'), '');
  log('TEST6 signup: Google signup', signup1.includes('Sign up with Google'), '');
  // go to step 2
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('button')).filter((b) => b.textContent.includes('Find rooms, manage bills'));
    cards[0]?.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Continue to Details'));
    btn?.click();
  });
  await sleep(900);
  const signup2 = await page.evaluate(() => document.body.innerText);
  const ids2 = await page.evaluate(() => ({
    fullName: !!document.getElementById('signup-fullName'),
    email: !!document.getElementById('signup-email'),
    phone: !!document.getElementById('signup-phone'),
    pw: !!document.getElementById('signup-password'),
    cpw: !!document.getElementById('signup-confirmPassword'),
  }));
  log('TEST6 signup step2 fields', ids2.fullName && ids2.email && ids2.phone && ids2.pw && ids2.cpw, JSON.stringify(ids2));
  log('TEST6 signup step2 labels', ['Full Name', 'Email Address', 'Phone Number', 'Password', 'Confirm Password'].every((l) => signup2.toLowerCase().includes(l.toLowerCase())), '');
  // card still stationary after step change
  const r5 = await getCardRect(page);
  log('TEST1 card top stable after signup step change', Math.abs(r1.top - r5.top) < tol && Math.abs(r1.left - r5.left) < tol, `top ${r5.top.toFixed(1)} left ${r5.left.toFixed(1)} h ${r5.height.toFixed(0)}`);
  // back to step 1 then login: card must return to identical geometry
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Back');
    btn?.click();
  });
  await sleep(700);
  await page.evaluate((sel) => {
    Array.from(document.querySelectorAll(sel)).find((b) => b.textContent.trim() === 'Sign In').click();
  }, 'button[role="tab"]');
  await sleep(700);
  const r6 = await getCardRect(page);
  log('TEST1 card returns to exact geometry', Math.abs(r1.top - r6.top) < tol && Math.abs(r1.height - r6.height) < tol, `top ${r6.top.toFixed(1)} h ${r6.height.toFixed(0)}`);

  // TEST 2: clouds actually move (transform x over ~14s)
  const cx1 = await getTransformX(page, '.animate-cloud-drift-1');
  const cy1 = await getTransformX(page, '.animate-cloud-drift-2');
  await sleep(14000);
  const cx2 = await getTransformX(page, '.animate-cloud-drift-1');
  const cy2 = await getTransformX(page, '.animate-cloud-drift-2');
  log('TEST2 cloud 1 moving', cx1 !== null && cx2 !== null && Math.abs(cx2 - cx1) >= 4, `dx=${(cx2 - cx1).toFixed(1)}px over 14s (x: ${cx1?.toFixed(1)} -> ${cx2?.toFixed(1)})`);
  log('TEST2 cloud 2 moving', cy1 !== null && cy2 !== null && Math.abs(cy2 - cy1) >= 4, `dx=${(cy2 - cy1).toFixed(1)}px over 14s`);

  // ambient glow moves too
  const g1 = await getTransformX(page, '.animate-ambient-glow');
  await sleep(8000);
  const g2 = await getTransformX(page, '.animate-ambient-glow');
  log('TEST2 ambient glow moving', g1 !== null && g2 !== null && (Math.abs(g2 - g1) >= 1 || g2 !== g1), `dx=${(g2 - g1).toFixed(2)}px over 8s`);

  // TEST 3: campus buildings recognizable — count windows/rects, roofs, balconies
  const scene = await page.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll('svg'));
    const campus = svgs.find((s) => s.querySelector('polygon') && s.querySelectorAll('rect').length > 40);
    if (!campus) return null;
    return {
      rects: campus.querySelectorAll('rect').length,
      windows: campus.querySelectorAll('rect[fill="#FFFFFF"]').length,
      roofs: campus.querySelectorAll('polygon').length,
      balconies: campus.querySelectorAll('rect[fill="#4F8296"]').length,
      trees: campus.querySelectorAll('circle').length,
      trunkBrown: campus.querySelectorAll('rect[fill="#8A6F5B"]').length,
      lawn: campus.querySelectorAll('path[fill="url(#lawn)"]').length,
    };
  });
  if (scene) {
    log('TEST3 buildings present', scene.rects > 60 && scene.windows > 60, JSON.stringify(scene));
    log('TEST3 roofs', scene.roofs >= 4, `${scene.roofs} roof polygons`);
    log('TEST3 balconies', scene.balconies >= 8, `${scene.balconies} balcony slabs`);
    log('TEST4 trees/greenery', scene.trees >= 20 && scene.trunkBrown >= 6 && scene.lawn >= 1, `${scene.trees} canopy circles, ${scene.trunkBrown} trunks, lawn:${scene.lawn}`);
  } else {
    log('TEST3 campus scene found', false, 'campus svg missing');
  }

  // screenshots
  await page.screenshot({ path: 'scratch/shot-login-1365.png' });
  await page.evaluate((sel) => {
    Array.from(document.querySelectorAll(sel)).find((b) => b.textContent.trim() === 'Sign Up').click();
  }, 'button[role="tab"]');
  await sleep(900);
  await page.screenshot({ path: 'scratch/shot-signup-1365.png' });

  // ---------- 1440x900 ----------
  await page.setViewport({ width: 1440, height: 900 });
  await sleep(1200);
  const r7 = await getCardRect(page);
  log('1440x900 card visible', r7 && r7.height < 900 && r7.top >= 0, JSON.stringify(r7));
  await page.evaluate((sel) => {
    Array.from(document.querySelectorAll(sel)).find((b) => b.textContent.trim() === 'Sign In').click();
  }, 'button[role="tab"]');
  await sleep(900);
  const r8 = await getCardRect(page);
  log('1440x900 card stable across tabs', r7 && r8 && Math.abs(r7.top - r8.top) < 0.51 && Math.abs(r7.left - r8.left) < 0.51, `top ${r7?.top.toFixed(1)} -> ${r8?.top.toFixed(1)}`);
  await page.screenshot({ path: 'scratch/shot-login-1440.png' });

  // TEST 7: forgot password page
  await page.goto(BASE + '/auth/forgot-password', { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(1500);
  const fp = await page.evaluate(() => ({
    text: document.body.innerText,
    card: !!Array.from(document.querySelectorAll('div')).find((d) => typeof d.className === 'string' && d.className.includes('rounded-[28px]')),
    cloud: !!document.querySelector('.animate-cloud-drift-1'),
    campus: Array.from(document.querySelectorAll('svg')).some((s) => s.querySelectorAll('rect').length > 40),
    email: !!document.getElementById('email'),
  }));
  log('TEST7 forgot-password page', fp.card && fp.cloud && fp.campus && fp.email && fp.text.includes('Forgot Password?'), `card:${fp.card} bg:${fp.cloud && fp.campus} input:${fp.email}`);
  await page.screenshot({ path: 'scratch/shot-forgot.png' });

  // TEST 8: reset password page
  await page.goto(BASE + '/auth/reset-password', { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(1500);
  const rp = await page.evaluate(() => ({
    text: document.body.innerText,
    card: !!Array.from(document.querySelectorAll('div')).find((d) => typeof d.className === 'string' && d.className.includes('rounded-[28px]')),
    cloud: !!document.querySelector('.animate-cloud-drift-1'),
    pw: !!document.getElementById('password'),
    cpw: !!document.getElementById('confirmPassword'),
  }));
  log('TEST8 reset-password page', rp.card && rp.cloud && rp.pw && rp.cpw && rp.text.includes('Create New Password'), `card:${rp.card} bg:${rp.cloud} inputs:${rp.pw && rp.cpw}`);
  await page.screenshot({ path: 'scratch/shot-reset.png' });

  const relevantErrors = consoleErrors.filter(
    (e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('supabase') && !e.includes('Failed to load resource')
  );
  log('no page errors', relevantErrors.length === 0, relevantErrors.slice(0, 3).join(' || ') || 'clean');

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== SUMMARY: ${results.length - failed.length}/${results.length} passed ====`);
  if (failed.length) { failed.forEach((f) => console.log('FAILED: ' + f.name)); process.exit(1); }
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
