import { describe, it } from 'vitest';
import { supabase } from './lib/supabase/client';

describe('supabase notices CRUD test', () => {
  it('attempts login and notice CRUD operations', async () => {
    // 1. Sign in as owner
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'owner@test.com',
      password: 'Test123456'
    });

    if (authError) {
      console.error('Login failed:', authError.message);
      return;
    }
    console.log('Login successful for:', authData.user?.email);

    // 2. Fetch owner's hostels
    const { data: hostels, error: hostelsError } = await supabase
      .from('hostels')
      .select('id, name')
      .eq('owner_id', authData.user.id);

    if (hostelsError) {
      console.error('Failed to fetch hostels:', hostelsError.message);
      return;
    }

    console.log('Owner hostels:', hostels);
    if (!hostels || hostels.length === 0) {
      console.log('No hostels found for this owner.');
      return;
    }

    const testHostel = hostels[0];
    console.log('Using hostel for test:', testHostel.name, testHostel.id);

    // 3. Attempt INSERT
    const { data: insertData, error: insertError } = await supabase
      .from('notices')
      .insert({
        hostel_id: testHostel.id,
        title: 'Test RLS Notice',
        body: 'This is a test notice message to verify RLS write access.',
        notice_type: 'general'
      })
      .select()
      .single();

    if (insertError) {
      console.error('INSERT failed:', insertError.message, insertError.code);
    } else {
      console.log('INSERT successful:', insertData);

      // 4. Attempt UPDATE
      const { data: updateData, error: updateError } = await supabase
        .from('notices')
        .update({
          title: 'Test RLS Notice (Updated)'
        })
        .eq('id', insertData.id)
        .select()
        .single();

      if (updateError) {
        console.error('UPDATE failed:', updateError.message);
      } else {
        console.log('UPDATE successful:', updateData);
      }

      // 5. Attempt DELETE
      const { error: deleteError } = await supabase
        .from('notices')
        .delete()
        .eq('id', insertData.id);

      if (deleteError) {
        console.error('DELETE failed:', deleteError.message);
      } else {
        console.log('DELETE successful');
      }
    }

    // Clean up signout
    await supabase.auth.signOut();
  });
});
