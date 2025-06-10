import { ChatInterface } from '@/components/chat/chat-interface';

export default function DashboardPage() {
  return (
    <div className="h-full max-h-[calc(100vh-57px-2rem)] md:max-h-[calc(100vh-57px-3rem)]"> {/* Adjust based on header and padding */}
      <ChatInterface chatTitle="Global Chat" chatType="global" />
    </div>
  );
}
