/**
 * Setup test user for QA system testing
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wuxhiuoxnwsqpcmjowse.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1eGhpdW94bndzcXBjbWpvd3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjQ4NjMsImV4cCI6MjA4MDI0MDg2M30.QIIN9wFw8savCnD3xWW8Tv67A2px4dEv3u9pt6kFYp0';

async function main() {
  console.log('=== Setting up test user ===\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'testpassword123';

  console.log('Creating user:', testEmail);

  // Sign up new user
  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        name: 'Test User',
      },
    },
  });

  if (error) {
    console.error('Sign up error:', error);
    return;
  }

  console.log('User created!');
  console.log('User ID:', data.user?.id);
  console.log('');
  console.log('Credentials:');
  console.log(`  Email: ${testEmail}`);
  console.log(`  Password: ${testPassword}`);
  console.log('');

  // Try to login immediately
  console.log('Attempting login...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginError) {
    console.error('Login failed (email may need confirmation):', loginError.message);
    console.log('\nNote: You may need to confirm the email address in Supabase dashboard');
  } else {
    console.log('Login successful!');
    console.log('Access token available:', !!loginData.session?.access_token);
  }
}

main().catch(console.error);
