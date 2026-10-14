import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('Inspecting students table...');
  const { data: students, error: err1 } = await supabase.from('students').select('*').limit(1);
  if (err1) console.error(err1);
  else console.log(students?.[0] ? Object.keys(students[0]) : 'No students found');

  console.log('\nInspecting room_requests table...');
  const { data: requests, error: err2 } = await supabase.from('room_requests').select('*').limit(1);
  if (err2) console.error(err2);
  else console.log(requests?.[0] ? Object.keys(requests[0]) : 'No room_requests found');
  
  console.log('\nInspecting room_allocations table...');
  const { data: allocs, error: err3 } = await supabase.from('room_allocations').select('*').limit(1);
  if (err3) console.error(err3);
  else console.log(allocs?.[0] ? Object.keys(allocs[0]) : 'No room_allocations found');
}

inspect();
