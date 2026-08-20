import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envLocalPath = join(__dirname, '../.env.local');

if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStudentChats() {
  const studentId = 'cca86ded-1c50-4f7d-909c-f3ba2223068e';
  
  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', studentId)
    .single();

  console.log("Student profile:", { name: profile.name, profile_type: profile.profile_type, institution: profile.institution });

  // Fetch unread messages count
  const { data: unreadData } = await supabase
    .from('direct_messages')
    .select('sender_id')
    .eq('receiver_id', studentId)
    .eq('is_read', false);

  const unreadMessages = {};
  if (unreadData) {
    unreadData.forEach((m) => {
      unreadMessages[m.sender_id] = (unreadMessages[m.sender_id] || 0) + 1;
    });
  }
  console.log("Unread messages counts:", unreadMessages);

  // Fetch latest messages
  const { data: lastMsgs } = await supabase
    .from('direct_messages')
    .select('id, sender_id, receiver_id, content, created_at')
    .or(`sender_id.eq.${studentId},receiver_id.eq.${studentId}`)
    .order('created_at', { ascending: false });

  const latestMessages = {};
  if (lastMsgs) {
    lastMsgs.forEach((msg) => {
      const partnerId = msg.sender_id === studentId ? msg.receiver_id : msg.sender_id;
      if (!latestMessages[partnerId]) {
        latestMessages[partnerId] = msg;
      }
    });
  }
  console.log("Latest messages map:", latestMessages);

  // Fetch chat history senders
  const { data: chatHistory } = await supabase
    .from('direct_messages')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${studentId},receiver_id.eq.${studentId}`);

  const historyIds = new Set();
  if (chatHistory) {
    chatHistory.forEach((msg) => {
      if (msg.sender_id !== studentId) historyIds.add(msg.sender_id);
      if (msg.receiver_id !== studentId) historyIds.add(msg.receiver_id);
    });
  }
  console.log("History IDs:", Array.from(historyIds));

  // Query contacts
  let query = supabase
    .from('profiles')
    .select('*')
    .neq('id', studentId);

  const userType = profile.profile_type.toLowerCase();
  const userInstitution = (profile.institution || '').toLowerCase().trim();

  if (historyIds.size > 0) {
    const idsList = Array.from(historyIds).join(',');
    query = query.or(`id.in.(${idsList}),profile_type.eq.teacher,profile_type.eq.staff`);
  } else {
    query = query.or('profile_type.eq.teacher,profile_type.eq.staff');
  }

  const { data: contacts } = await query.order('name', { ascending: true });

  const filteredByPolo = contacts?.filter(mentor => {
    if (historyIds.has(mentor.id)) return true;
    if (mentor.profile_type === 'staff' || mentor.profile_type === 'admin') return true;
    if (['admin', 'teacher', 'staff'].includes(userType)) return true;
    
    const mentorInstitution = (mentor.institution || '').toLowerCase();
    
    if (!userInstitution) {
      return !mentorInstitution || mentorInstitution.includes('geral');
    }
    return mentorInstitution.includes(userInstitution) || mentorInstitution.includes('geral') || !mentorInstitution;
  }) || [];

  const filteredContacts = filteredByPolo; // activeCategory is "Todos", searchTerm is ""

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const unreadA = unreadMessages[a.id] || 0;
    const unreadB = unreadMessages[b.id] || 0;
    if (unreadA !== unreadB) {
      return unreadB - unreadA;
    }
    const dateA = latestMessages[a.id]?.created_at || '';
    const dateB = latestMessages[b.id]?.created_at || '';
    if (dateA || dateB) {
      return dateB.localeCompare(dateA);
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  const activeChats = sortedContacts.filter(
    (c) => (unreadMessages[c.id] || 0) > 0 || latestMessages[c.id]
  );
  const directoryContacts = sortedContacts.filter(
    (c) => !((unreadMessages[c.id] || 0) > 0) && !latestMessages[c.id]
  );

  console.log("\n--- Active Chats (Recent) ---");
  activeChats.forEach(c => console.log(`- ${c.name} (${c.profile_type}) | Last msg: "${latestMessages[c.id]?.content}" | Unread: ${unreadMessages[c.id] || 0}`));

  console.log("\n--- Directory Contacts (Available) ---");
  directoryContacts.forEach(c => console.log(`- ${c.name} (${c.profile_type})`));
}

testStudentChats();
