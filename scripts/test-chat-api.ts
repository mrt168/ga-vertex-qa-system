/**
 * Test QA Chat API with Google Drive integration
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const API_URL = 'http://localhost:3000';

async function main() {
  console.log('=== Testing QA Chat API with Google Drive ===\n');

  // 1. Login
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword123',
  });

  if (authError || !authData.session) {
    console.error('Login failed:', authError);
    return;
  }

  console.log('1. Login successful');
  const token = authData.session.access_token;

  // 2. Create session
  const sessionRes = await fetch(`${API_URL}/api/qa/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!sessionRes.ok) {
    console.error('Failed to create session:', await sessionRes.text());
    return;
  }

  const sessionData = await sessionRes.json();
  console.log('2. Session created:', sessionData.id);

  // 3. Send a question about SEO (should find documents in Google Drive)
  console.log('\n3. Sending question about SEO...');
  const chatRes = await fetch(`${API_URL}/api/qa/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      sessionId: sessionData.id,
      message: 'SEOの基本的な施策について教えてください',
    }),
  });

  if (!chatRes.ok) {
    console.error('Chat failed:', await chatRes.text());
    return;
  }

  const chatData = await chatRes.json();
  console.log('\n=== Response ===');
  console.log('Answer:', chatData.message?.content?.slice(0, 500) + '...');
  console.log('\nSources used:');
  chatData.sources?.forEach((s: { fileName: string; documentId: string }, i: number) => {
    console.log(`  ${i + 1}. ${s.fileName} (${s.documentId})`);
  });

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
