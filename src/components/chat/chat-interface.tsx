
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
  chatId?: string;
}

interface CurrentUserProfileData {
  uid: string;
  displayName: string;
  avatar?: string;
  nameColor?: string;
}

export function ChatInterface({ chatTitle, chatType, chatId = 'global' }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfileData | null>(null);
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
            setCurrentUserProfile({
              uid: user.uid,
              displayName: data.displayName || user.displayName || "User",
              avatar: data.avatar,
              nameColor: data.nameColor, // Fetch nameColor
            });
          } else {
            setCurrentUserProfile({ // Fallback if no DB profile
              uid: user.uid,
              displayName: user.displayName || "User",
              avatar: undefined,
              nameColor: undefined,
            });
          }
        }, (error) => {
            console.error("Error fetching current user profile for chat:", error);
            // Fallback display if DB fetch fails but user is authenticated
             setCurrentUserProfile({
              uid: user.uid,
              displayName: user.displayName || "User",
              avatar: undefined,
              nameColor: undefined,
            });
        });
      } else {
        setCurrentUserProfile(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (chatType === 'ai') { // AI chat messages are not stored in DB for this example
      setIsLoadingMessages(false);
      if (chatId === 'ai-chatbot' && messages.length === 0) { // Only set initial if no messages yet
        setMessages([
          {
            id: 'ai-welcome',
            sender: 'AI Chatbot',
            senderUid: 'ai-chatbot-uid',
            avatar: 'https://placehold.co/40x40/8B5CF6/FFFFFF.png?text=AI',
            content: "Hello! I'm your AI Chatbot. How can I help you today?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: false,
            senderNameColor: '#8B5CF6' // Example color for AI
          }
        ]);
      }
      return;
    }

    if (!currentUser) { // Don't fetch DB messages if no user (relevant for non-AI chats)
        setIsLoadingMessages(false);
        setMessages([]); // Clear messages if user logs out
        return;
    }


    setIsLoadingMessages(true);
    const chatPath = chatType === 'global' ? 'chats/global' : `chats/${chatId}`;
    // In a real app, party/DM chats would have specific paths like `party_chats/${chatId}/messages`
    const messagesRefQuery = query(ref(database, chatPath), orderByChild('timestamp'), limitToLast(50));

    const listener = onValue(messagesRefQuery, (snapshot) => {
      const loadedMessages: Message[] = [];
      snapshot.forEach((childSnapshot) => {
        const msgData = childSnapshot.val();
        loadedMessages.push({
          id: childSnapshot.key!,
          sender: msgData.senderName,
          senderUid: msgData.senderUid,
          avatar: msgData.senderAvatar || `https://placehold.co/40x40.png?text=${msgData.senderName?.charAt(0) || 'U'}`,
          content: msgData.content,
          timestamp: new Date(msgData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwnMessage: msgData.senderUid === currentUser?.uid,
          senderNameColor: msgData.senderNameColor, // Expect this from DB
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
      off(messagesRefQuery, 'value', listener);
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
    if (!currentUser || !currentUserProfile) {
      toast({ title: "Not Logged In", description: "Please log in to send messages.", variant: "destructive" });
      return;
    }
    if (chatType === 'ai') {
        const userMessage: Message = {
            id: String(Date.now()),
            sender: currentUserProfile.displayName,
            senderUid: currentUserProfile.uid,
            avatar: currentUserProfile.avatar,
            content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: true,
            senderNameColor: currentUserProfile.nameColor,
        };
        setMessages(prev => [...prev, userMessage]);
        setTimeout(() => {
            const aiResponse: Message = {
                id: String(Date.now() + 1),
                sender: 'AI Chatbot',
                senderUid: 'ai-chatbot-uid',
                avatar: 'https://placehold.co/40x40/8B5CF6/FFFFFF.png?text=AI',
                content: "I'm processing your request... (mock response for AI chat)",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isOwnMessage: false,
                senderNameColor: '#8B5CF6'
            };
            setMessages(prev => [...prev, aiResponse]);
        }, 1000);
        return;
    }

    const chatPath = chatType === 'global' ? 'chats/global' : `chats/${chatId}`;
    const messagesDbRef = ref(database, chatPath);

    const newMessagePayload = {
      senderUid: currentUserProfile.uid,
      senderName: currentUserProfile.displayName,
      senderAvatar: currentUserProfile.avatar || `https://placehold.co/40x40.png?text=${currentUserProfile.displayName.charAt(0)}`,
      senderNameColor: currentUserProfile.nameColor, // Include nameColor
      content,
      timestamp: serverTimestamp(),
    };

    try {
      await push(messagesDbRef, newMessagePayload);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Error", description: "Could not send message.", variant: "destructive" });
    }
  };

  return (
    <Card className="flex flex-col h-full w-full shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <CardTitle className="text-lg font-headline">{chatTitle}</CardTitle>
        {chatType !== 'ai' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {chatType === 'party' && (
              <>
                <DropdownMenuItem onClick={() => toast({title: "Feature", description:"Invite friends clicked (UI only)"})}><UserPlus size={16} className="mr-2" /> Invite Friends</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({title: "Feature", description:"Group info clicked (UI only)"})}><Info size={16} className="mr-2" /> Group Info</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => toast({title: "Feature", description:"Leave group clicked (UI only)"})}><LeaveIcon size={16} className="mr-2" /> Leave Group</DropdownMenuItem>
              </>
            )}
            {chatType === 'global' && (
               <DropdownMenuItem onClick={() => toast({title: "Feature", description:"Chat info clicked (UI only)"})}><Info size={16} className="mr-2" /> Chat Info</DropdownMenuItem>
            )}
             {chatType !== 'global' && <DropdownMenuSeparator />}
            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => toast({title: "Feature", description:"Block user clicked (UI only)"})}><UserX size={16} className="mr-2" /> Block User (mock)</DropdownMenuItem>
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

    
