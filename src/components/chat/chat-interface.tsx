
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, type Message } from './chat-message';
import { ChatInput } from './chat-input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MoreVertical, UserPlus, LogOut as LeaveIcon, UserX, Info, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { auth, database } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { ref, onValue, push, serverTimestamp, query, orderByChild, limitToLast, off, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

interface ChatInterfaceProps {
  chatTitle: string;
  chatType: 'global' | 'party' | 'dm' | 'ai';
  chatId?: string; 
}

interface UserProfileData {
  uid: string;
  username: string;
  displayName: string;
  avatar?: string;
  nameColor?: string;
  title?: string; // Added title
}

export function ChatInterface({ chatTitle, chatType, chatId = 'global' }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfileData | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [usersCache, setUsersCache] = useState<{[uid: string]: UserProfileData}>({});


  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfileData | null> => {
    if (usersCache[uid]) return usersCache[uid];
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const profile = { uid, ...userData };
        setUsersCache(prev => ({...prev, [uid]: profile}));
        return profile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  }, [usersCache]);


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchUserProfile(user.uid).then(profile => {
            if(profile) setCurrentUserProfile(profile);
        });
      } else {
        setCurrentUserProfile(null);
        setMessages([]);
        setIsLoadingMessages(false);
      }
    });
    return () => unsubscribeAuth();
  }, [fetchUserProfile]);

  useEffect(() => {
    if (chatType === 'ai') { 
      setIsLoadingMessages(false);
      if (chatId === 'ai-chatbot' && messages.length === 0) { 
        setMessages([
          {
            id: 'ai-welcome',
            sender: 'AI Chatbot',
            senderUid: 'ai-chatbot-uid',
            senderUsername: 'ai_chatbot',
            avatar: 'https://placehold.co/40x40.png?text=AI',
            content: "Hello! I'm your AI Chatbot. How can I help you today?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: false,
            senderNameColor: '#8B5CF6' 
          }
        ]);
      }
      return;
    }

    if (!currentUser) { 
        setIsLoadingMessages(false);
        setMessages([]);
        return;
    }

    setIsLoadingMessages(true);
    const chatPath = `chats/${chatId}`; 
    const messagesRefQuery = query(ref(database, chatPath), orderByChild('timestamp'), limitToLast(50));

    const listener = onValue(messagesRefQuery, async (snapshot) => {
      const loadedMessages: Message[] = [];
      const messagePromises: Promise<void>[] = [];

      snapshot.forEach((childSnapshot) => {
        const msgData = childSnapshot.val();
        const senderUid = msgData.senderUid;

        const promise = fetchUserProfile(senderUid).then(profile => {
            loadedMessages.push({
                id: childSnapshot.key!,
                sender: profile?.displayName || msgData.senderName || "User",
                senderUid: senderUid,
                senderUsername: profile?.username || msgData.senderUsername || "user",
                avatar: profile?.avatar || msgData.senderAvatar || `https://placehold.co/40x40.png?text=${(profile?.displayName || msgData.senderName || "U").charAt(0)}`,
                content: msgData.content,
                timestamp: new Date(msgData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isOwnMessage: senderUid === currentUser?.uid,
                senderNameColor: profile?.nameColor || msgData.senderNameColor,
                senderTitle: profile?.title || msgData.senderTitle, // Include title
            });
        });
        messagePromises.push(promise);
      });

      await Promise.all(messagePromises);
      loadedMessages.sort((a, b) => {
        const timeA = new Date(0); timeA.setHours(parseInt(a.timestamp.split(':')[0]), parseInt(a.timestamp.split(':')[1]));
        const timeB = new Date(0); timeB.setHours(parseInt(b.timestamp.split(':')[0]), parseInt(b.timestamp.split(':')[1]));
        return timeA.getTime() - timeB.getTime();
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
  }, [currentUser, chatType, chatId, toast, fetchUserProfile]);


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
            senderUsername: currentUserProfile.username,
            avatar: currentUserProfile.avatar,
            content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: true,
            senderNameColor: currentUserProfile.nameColor,
            senderTitle: currentUserProfile.title,
        };
        setMessages(prev => [...prev, userMessage]);
        setTimeout(() => {
            const aiResponse: Message = {
                id: String(Date.now() + 1),
                sender: 'AI Chatbot',
                senderUid: 'ai-chatbot-uid',
                senderUsername: 'ai_chatbot',
                avatar: 'https://placehold.co/40x40.png?text=AI',
                content: "I'm processing your request... (mock response for AI chat)",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isOwnMessage: false,
                senderNameColor: '#8B5CF6'
            };
            setMessages(prev => [...prev, aiResponse]);
        }, 1000);
        return;
    }

    const chatPath = `chats/${chatId}`;
    const messagesDbRef = ref(database, chatPath);

    const newMessagePayload = {
      senderUid: currentUserProfile.uid,
      senderName: currentUserProfile.displayName, 
      senderUsername: currentUserProfile.username, 
      senderAvatar: currentUserProfile.avatar || `https://placehold.co/40x40.png?text=${currentUserProfile.displayName.charAt(0)}`,
      senderNameColor: currentUserProfile.nameColor, 
      senderTitle: currentUserProfile.title, // Include title
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
      <CardHeader className="flex flex-row items-center justify-between p-3 md:p-4 border-b">
        <CardTitle className="text-base md:text-lg font-headline">{chatTitle}</CardTitle>
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
             {chatType === 'dm' && (
              <>
                <DropdownMenuItem onClick={() => toast({title: "Feature", description:"View user's profile (UI only)"})}><Info size={16} className="mr-2" /> View Profile</DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {chatType === 'global' && (
               <DropdownMenuItem onClick={() => toast({title: "Feature", description:"Chat info clicked (UI only)"})}><Info size={16} className="mr-2" /> Chat Info</DropdownMenuItem>
            )}
            {chatType !== 'global' && chatType !== 'dm' && <DropdownMenuSeparator />}
            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => toast({title: "Feature", description:"Block user clicked (UI only)"})}><UserX size={16} className="mr-2" /> Block User (mock)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-2 md:p-4 space-y-1 md:space-y-2">
            {isLoadingMessages ? (
              <div className="flex justify-center items-center h-full p-10">
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
