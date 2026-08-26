const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
const env = {};
envLines.forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#') && line.includes('=')) {
    const parts = line.split('=');
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  try {
    // 1. Sign in as owner
    console.log('Logging in as askatiyar2007@gmail.com...');
    const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        email: 'askatiyar2007@gmail.com',
        password: 'Test123456'
      })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error('Login failed:', loginData);
      return;
    }

    const accessToken = loginData.access_token;
    const userId = loginData.user.id;
    console.log('Login successful. User ID:', userId);

    // 2. Fetch owner's hostels
    console.log('Fetching owner hostels...');
    const hostelsRes = await fetch(`${supabaseUrl}/rest/v1/hostels?owner_id=eq.${userId}&select=id,name`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const hostels = await hostelsRes.json();
    if (!hostelsRes.ok) {
      console.error('Failed to fetch hostels:', hostels);
      return;
    }

    console.log('Hostels:', hostels);
    if (hostels.length === 0) {
      console.log('No hostels found.');
      return;
    }

    const testHostel = hostels[0];
    console.log('Using hostel:', testHostel.name, testHostel.id);

    // 3. Attempt INSERT
    console.log('Attempting INSERT to notices...');
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/notices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        hostel_id: testHostel.id,
        title: 'Test RLS Notice',
        body: 'This is a test notice message to verify RLS write access.',
        notice_type: 'general'
      })
    });

    const insertData = await insertRes.json();
    console.log('INSERT response status:', insertRes.status);
    console.log('INSERT response body:', insertData);

    if (!insertRes.ok) {
      console.error('INSERT failed');
      return;
    }

    const createdNotice = insertData[0];
    console.log('INSERT successful. Notice ID:', createdNotice.id);

    // 4. Attempt UPDATE
    console.log('Attempting UPDATE...');
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/notices?id=eq.${createdNotice.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        title: 'Test RLS Notice (Updated)'
      })
    });

    const updateData = await updateRes.json();
    console.log('UPDATE response status:', updateRes.status);
    console.log('UPDATE response body:', updateData);

    // 5. Attempt DELETE
    console.log('Attempting DELETE...');
    const deleteRes = await fetch(`${supabaseUrl}/rest/v1/notices?id=eq.${createdNotice.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('DELETE response status:', deleteRes.status);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
