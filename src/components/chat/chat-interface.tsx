'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, type Message } from './chat-message';
import { ChatInput } from './chat-input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MoreVertical, UserPlus, LogOut as LeaveIcon, UserX, Info } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ChatInterfaceProps {
  chatTitle: string;
  chatType: 'global' | 'party' | 'dm' | 'ai';
}

const mockMessages: Message[] = [
  { id: '1', sender: 'Alice', avatar: 'https://placehold.co/40x40/E6A4B4/FFFFFF.png?text=A', content: 'Hey everyone! How is it going?', timestamp: '10:00 AM', isOwnMessage: false, reactions: {thumbsup: 2} },
  { id: '2', sender: 'Bob', avatar: 'https://placehold.co/40x40/A4B4E6/FFFFFF.png?text=B', content: 'Pretty good, Alice! Just chilling.', timestamp: '10:01 AM', isOwnMessage: false, reactions: {heart: 1} },
  { id: '3', sender: 'You', avatar: 'https://placehold.co/40x40/B4E6A4/FFFFFF.png?text=Y', content: 'Hi folks! What are we discussing today?', timestamp: '10:02 AM', isOwnMessage: true },
  { id: '4', sender: 'Charlie', avatar: 'https://placehold.co/40x40/E6D4A4/FFFFFF.png?text=C', content: 'I found this cool link: https://example.com', timestamp: '10:03 AM', isOwnMessage: false, link: {url: 'https://example.com', title: 'Example Domain', description: 'This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.', image: 'https://placehold.co/300x150.png?text=Link+Preview'}},
  { id: '5', sender: 'You', avatar: 'https://placehold.co/40x40/B4E6A4/FFFFFF.png?text=Y', content: 'Nice @Charlie! Check out this image.', timestamp: '10:05 AM', isOwnMessage: true, imageUrl: 'https://placehold.co/300x200.png?text=Shared+Image' },
];

export function ChatInterface({ chatTitle, chatType }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: String(messages.length + 1),
      sender: 'You',
      avatar: 'https://placehold.co/40x40/B4E6A4/FFFFFF.png?text=Y',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwnMessage: true,
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  };

  return (
    <Card className="flex flex-col h-full w-full shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <CardTitle className="text-lg font-headline">{chatTitle}</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {chatType === 'party' && (
              <>
                <DropdownMenuItem><UserPlus size={16} className="mr-2" /> Invite Friends</DropdownMenuItem>
                <DropdownMenuItem><Info size={16} className="mr-2" /> Group Info</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10"><LeaveIcon size={16} className="mr-2" /> Leave Group</DropdownMenuItem>
              </>
            )}
            {chatType === 'global' && (
               <DropdownMenuItem><Info size={16} className="mr-2" /> Chat Info</DropdownMenuItem>
            )}
             {chatType !== 'ai' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10"><UserX size={16} className="mr-2" /> Block User (mock)</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-2">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-0">
        <ChatInput onSendMessage={handleSendMessage} />
      </CardFooter>
    </Card>
  );
}
