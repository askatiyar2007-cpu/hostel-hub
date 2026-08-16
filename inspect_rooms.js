const supabaseUrl = 'https://pcwlceklvjuddghogfbf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjd2xjZWtsdmp1ZGRnaG9nZmJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MDQzMDMsImV4cCI6MjA5NjQ4MDMwM30.Q9-7lBpjbwC8rNq01_SNEPHHs0R03FzSSaeb2UlNZuM';

async function inspect() {
  try {
    // 1. Sign in as askatiyar2007@gmail.com
    const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'askatiyar2007@gmail.com',
        password: 'Test123456'
      })
    });

    if (!loginRes.ok) {
      const errText = await loginRes.text();
      console.log('Failed to log in:', errText);
      return;
    }

    const loginData = await loginRes.json();
    const token = loginData.access_token;
    console.log('Successfully logged in! Token acquired.');

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log('--- Room Allocations ---');
    const aRes = await fetch(`${supabaseUrl}/rest/v1/room_allocations?select=*`, { headers });
    const allocations = await aRes.json();
    console.log(JSON.stringify(allocations, null, 2));

    console.log('--- Room Requests ---');
    const rqRes = await fetch(`${supabaseUrl}/rest/v1/room_requests?select=*`, { headers });
    const requests = await rqRes.json();
    console.log(JSON.stringify(requests, null, 2));

  } catch (err) {
    console.error(err);
  }
}

inspect();
