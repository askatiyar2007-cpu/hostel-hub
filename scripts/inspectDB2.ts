import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_URL';
const supabaseKey = 'YOUR_KEY';

// I shouldn't put credentials here, I should read from .env.local without dotenv, just using fs
import * as fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabase = createClient(urlMatch![1].trim(), keyMatch![1].trim());

async function inspect() {
  console.log('Inspecting students table...');
  const { data: reqs, error: err1 } = await supabase.from('students').select('*').limit(1);
  if (err1) console.error(err1);
  else console.log(reqs?.[0] ? Object.keys(reqs[0]) : 'No reqs found');
}

inspect();
