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

  if (chatId === 'global') {
    chatTitle = 'Global Chat';
    chatType = 'global';
  } else if (chatId === 'ai-chatbot') {
    chatTitle = 'AI Chatbot';
    chatType = 'ai';
  } else {
    // For dynamic party/DM chats, you'd fetch chat details here
    // For now, we'll treat unknown as a not found case or a generic title
    // return notFound(); 
    // Or, for demo:
    chatTitle = `Chat: ${chatId}`;
    chatType = 'party'; // Assuming dynamic routes are parties for now
  }
  
  return (
     <div className="h-full max-h-[calc(100vh-57px-2rem)] md:max-h-[calc(100vh-57px-3rem)]">
      <ChatInterface chatTitle={chatTitle} chatType={chatType} />
    </div>
  );
}

// Optional: Generate static paths if you have a fixed set of chats
// export async function generateStaticParams() {
//   return [{ chatId: 'global' }, { chatId: 'ai-chatbot' }];
// }
