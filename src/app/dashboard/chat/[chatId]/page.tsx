
import { ChatInterface } from '@/components/chat/chat-interface';
import { notFound } from 'next/navigation';

interface ChatPageParams {
  params: {
    chatId: string;
  };
}

export default function ChatPage({ params }: ChatPageParams) {
  const { chatId } = params;

  let chatTitle = '';
  let chatType: 'global' | 'party' | 'dm' | 'ai' = 'global';
  let resolvedChatId = chatId; // Use this for passing to ChatInterface

  if (chatId === 'global') {
    chatTitle = 'Global Chat';
    chatType = 'global';
  } else if (chatId === 'ai-chatbot') {
    chatTitle = 'AI Chatbot';
    chatType = 'ai';
  } else if (chatId.startsWith('dm-')) {
    // For DM, chatId might be like "dm-USER_UID"
    // We'd fetch the other user's name to set a proper title
    // For now, a generic title
    const otherUserId = chatId.substring(3); // Extract user UID
    // In a real app, fetch user profile for `otherUserId` to get their displayName
    chatTitle = `DM with User`; // Placeholder, replace with actual user's name
    chatType = 'dm';
    resolvedChatId = chatId; // The actual DM channel ID might be a combination of UIDs sorted, or just this unique ID
  } else {
    // For dynamic party chats, you'd fetch chat details here
    // For now, we'll treat unknown as a party chat or a generic title
    chatTitle = `Party: ${chatId}`;
    chatType = 'party';
    resolvedChatId = chatId;
  }
  
  return (
     <div className="h-full max-h-[calc(100vh-57px-2rem)] md:max-h-[calc(100vh-57px-3rem)]">
      <ChatInterface chatTitle={chatTitle} chatType={chatType} chatId={resolvedChatId} />
    </div>
  );
}

// Optional: Generate static paths if you have a fixed set of chats
// export async function generateStaticParams() {
//   // This needs to be more dynamic for DMs and parties
//   return [{ chatId: 'global' }, { chatId: 'ai-chatbot' }];
// }
