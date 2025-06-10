
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, type Message } from './chat-message';
import { ChatInput } from './chat-input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MoreVertical, UserPlus, LogOut as LeaveIcon, UserX, Info, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { auth, database } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { ref, onValue, push, serverTimestamp, query, orderByChild, limitToLast, off } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

interface ChatInterfaceProps {
  chatTitle: string;
  chatType: 'global' | 'party' | 'dm' | 'ai';
  chatId?: string; // For party/dm chats, will be the party/dm ID. For global, can be 'global'.
}

export function ChatInterface({ chatTitle, chatType, chatId = 'global' }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("User");
  const [userAvatar, setUserAvatar] = useState<string | undefined>(undefined);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const userProfileRef = ref(database, `users/${user.uid}`);
        onValue(userProfileRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setUserDisplayName(data.displayName || user.displayName || "User");
            setUserAvatar(data.avatar);
          } else {
            setUserDisplayName(user.displayName || "User");
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser || chatType === 'ai') { // AI chat messages are not stored in DB for this example
      setIsLoadingMessages(false);
      if (chatType === 'ai' && chatId === 'ai-chatbot') {
        // Initial AI message
        setMessages([
          {
            id: 'ai-welcome',
            sender: 'AI Chatbot',
            avatar: 'https://placehold.co/40x40/8B5CF6/FFFFFF.png?text=AI', // Purple for AI
            content: "Hello! I'm your AI Chatbot. How can I help you today?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: false,
          }
        ]);
      }
      return;
    }

    setIsLoadingMessages(true);
    const chatPath = chatType === 'global' ? 'chats/global' : `chats/${chatId}`;
    const messagesRef = query(ref(database, chatPath), orderByChild('timestamp'), limitToLast(50)); // Get last 50 messages

    const listener = onValue(messagesRef, (snapshot) => {
      const loadedMessages: Message[] = [];
      snapshot.forEach((childSnapshot) => {
        const msgData = childSnapshot.val();
        loadedMessages.push({
          id: childSnapshot.key!,
          sender: msgData.senderName,
          avatar: msgData.senderAvatar || `https://placehold.co/40x40.png?text=${msgData.senderName?.charAt(0) || 'U'}`,
          content: msgData.content,
          timestamp: new Date(msgData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwnMessage: msgData.senderUid === currentUser?.uid,
          // Add other fields like imageUrl, link, reactions if stored
        });
      });
      setMessages(loadedMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      toast({ title: "Error", description: "Could not load messages.", variant: "destructive" });
      setIsLoadingMessages(false);
    });

    return () => {
      off(messagesRef, 'value', listener); // Detach listener
    };
  }, [currentUser, chatType, chatId, toast]);


  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!currentUser) {
      toast({ title: "Not Logged In", description: "Please log in to send messages.", variant: "destructive" });
      return;
    }
    if (chatType === 'ai') {
        // Handle AI message sending (client-side mock for now)
        const userMessage: Message = {
            id: String(Date.now()),
            sender: userDisplayName,
            avatar: userAvatar,
            content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: true,
        };
        setMessages(prev => [...prev, userMessage]);
        // Simulate AI response
        setTimeout(() => {
            const aiResponse: Message = {
                id: String(Date.now() + 1),
                sender: 'AI Chatbot',
                avatar: 'https://placehold.co/40x40/8B5CF6/FFFFFF.png?text=AI',
                content: "I'm processing your request... (mock response)",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isOwnMessage: false,
            };
            setMessages(prev => [...prev, aiResponse]);
        }, 1000);
        return;
    }


    const chatPath = chatType === 'global' ? 'chats/global' : `chats/${chatId}`;
    const messagesRef = ref(database, chatPath);

    const newMessage = {
      senderUid: currentUser.uid,
      senderName: userDisplayName,
      senderAvatar: userAvatar || `https://placehold.co/40x40.png?text=${userDisplayName.charAt(0)}`,
      content,
      timestamp: serverTimestamp(), // Firebase server timestamp
    };

    try {
      await push(messagesRef, newMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Error", description: "Could not send message.", variant: "destructive" });
    }
  };

  return (
    <Card className="flex flex-col h-full w-full shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <CardTitle className="text-lg font-headline">{chatTitle}</CardTitle>
        {chatType !== 'ai' && ( // No menu for AI chat for now
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
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10"><UserX size={16} className="mr-2" /> Block User (mock)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-2">
            {isLoadingMessages ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 && chatType !== 'ai' ? (
              <div className="text-center text-muted-foreground py-10">
                <p>No messages yet.</p>
                <p>Be the first to say something!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-0">
        <ChatInput onSendMessage={handleSendMessage} />
      </CardFooter>
    </Card>
  );
}

    