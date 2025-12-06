/**
 * Test QA API endpoint
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wuxhiuoxnwsqpcmjowse.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1eGhpdW94bndzcXBjbWpvd3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjQ4NjMsImV4cCI6MjA4MDI0MDg2M30.QIIN9wFw8savCnD3xWW8Tv67A2px4dEv3u9pt6kFYp0';

async function main() {
  console.log('=== Testing QA API ===\n');

  // 1. Login
  console.log('1. Logging in...\n');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'qatest@test.local',
    password: 'testpassword123',
  });

  if (authError || !authData.session) {
    console.error('Login failed:', authError);
    return;
  }

  console.log('Login successful!');
  console.log('User ID:', authData.user?.id);
  console.log('');

  const accessToken = authData.session.access_token;

  // 2. Create a new session
  console.log('2. Creating new chat session...\n');

  const createSessionResponse = await fetch('http://localhost:3000/api/qa/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ title: 'テストセッション' }),
  });

  if (!createSessionResponse.ok) {
    const errorText = await createSessionResponse.text();
    console.error('Failed to create session:', createSessionResponse.status, errorText);
    return;
  }

  const sessionData = await createSessionResponse.json();
  console.log('Session created:', sessionData.session?.id || sessionData.id);
  const sessionId = sessionData.session?.id || sessionData.id;
  console.log('');

  // 3. Send a question
  console.log('3. Sending question: "有給休暇の付与日数を教えてください"\n');

  const chatResponse = await fetch('http://localhost:3000/api/qa/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      sessionId: sessionId,
      message: '有給休暇の付与日数を教えてください',
    }),
  });

  if (!chatResponse.ok) {
    const errorText = await chatResponse.text();
    console.error('Chat request failed:', chatResponse.status, errorText);
    return;
  }

  const chatData = await chatResponse.json();

  console.log('=== Response ===\n');
  console.log('Answer:', chatData.message?.content || chatData.answer);
  console.log('');
  console.log('Sources:', JSON.stringify(chatData.sources, null, 2));

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
