
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
import { aiChat, type AiChatInput, type AiChatOutput } from '@/ai/flows/ai-chat-flow';

interface ChatInterfaceProps {
  chatTitle: string;
  chatType: 'global' | 'party' | 'dm' | 'ai';
  chatId?: string;
  // TODO: Implement a way to add notifications (e.g., via context or prop callback)
  // onNewNotification?: (notification: AppNotification) => void;
}

interface UserProfileData {
  uid: string;
  username: string;
  displayName: string;
  avatar?: string;
  nameColor?: string;
  title?: string;
}

export function ChatInterface({ chatTitle, chatType, chatId = 'global' }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfileData | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null); 
  const { toast } = useToast();
  const [usersCache, setUsersCache] = useState<{[uid: string]: UserProfileData}>({});

  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfileData | null> => {
    if (usersCache[uid]) return usersCache[uid];
    if (uid === 'ai-chatbot-uid') { 
      const aiProfile = { uid, username: 'realtalk_ai', displayName: 'RealTalk AI', avatar: 'https://placehold.co/40x40.png?text=AI', nameColor: '#8B5CF6' };
      setUsersCache(prev => ({...prev, [uid]: aiProfile}));
      return aiProfile;
    }
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        // Ensure core properties exist, provide fallbacks if necessary
        const profile: UserProfileData = {
          uid,
          username: userData.username || "unknown_user",
          displayName: userData.displayName || "Unknown User",
          avatar: userData.avatar,
          nameColor: userData.nameColor,
          title: userData.title,
        };
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
            else {
                 // Fallback if profile fetch fails for current user
                setCurrentUserProfile({
                    uid: user.uid,
                    username: user.email?.split('@')[0] || "user",
                    displayName: user.displayName || "User",
                    avatar: `https://placehold.co/40x40.png?text=${(user.displayName || "U").charAt(0)}`,
                });
            }
        });
      } else {
        setCurrentUserProfile(null);
        if (chatType !== 'ai') { 
            setMessages([]);
        }
        // Always set loading to false if user logs out and it's not AI chat
        if (chatType !== 'ai') setIsLoadingMessages(false);
      }
    });
    return () => unsubscribeAuth();
  }, [fetchUserProfile, chatType]);

  useEffect(() => {
    if (chatType === 'ai') {
      setIsLoadingMessages(false);
      if (chatId === 'ai-chatbot' && messages.length === 0) {
        setMessages([
          {
            id: 'ai-welcome',
            sender: 'RealTalk AI',
            senderUid: 'ai-chatbot-uid',
            senderUsername: 'realtalk_ai',
            avatar: 'https://placehold.co/40x40.png?text=AI',
            content: "Hello! I'm your AI Chatbot. How can I help you today?",
            originalTimestamp: Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: false,
            senderNameColor: '#8B5CF6'
          }
        ]);
      }
      return;
    }

    // For non-AI chats, require currentUser to proceed
    if (!currentUser) {
        setIsLoadingMessages(false); // Stop loading if no user
        setMessages([]); // Clear messages if no user
        return;
    }

    setIsLoadingMessages(true);
    const chatPath = `chats/${chatId}`;
    const messagesRefQuery = query(ref(database, chatPath), orderByChild('timestamp'), limitToLast(50));

    const listener = onValue(messagesRefQuery, async (snapshot) => {
      const messageDataArray: { key: string, data: any }[] = [];
      snapshot.forEach((childSnapshot) => {
        messageDataArray.push({ key: childSnapshot.key!, data: childSnapshot.val() });
      });

      const loadedMessagesPromises = messageDataArray.map(async (msgEntry) => {
        const msgData = msgEntry.data;
        const senderUid = msgData.senderUid;
        const profile = await fetchUserProfile(senderUid);
        
        // Fallback for avatar
        const defaultAvatarText = (profile?.displayName || msgData.senderName || "U").charAt(0).toUpperCase();
        const avatarUrl = profile?.avatar || msgData.senderAvatar || `https://placehold.co/40x40.png?text=${defaultAvatarText}`;

        return {
            id: msgEntry.key!,
            sender: profile?.displayName || msgData.senderName || "User",
            senderUid: senderUid,
            senderUsername: profile?.username || msgData.senderUsername || "user",
            avatar: avatarUrl,
            content: msgData.content,
            originalTimestamp: msgData.timestamp,
            timestamp: new Date(msgData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: senderUid === currentUser?.uid,
            senderNameColor: profile?.nameColor || msgData.senderNameColor,
            senderTitle: profile?.title || msgData.senderTitle,
        };
      });
      
      const resolvedMessages = await Promise.all(loadedMessagesPromises);
      resolvedMessages.sort((a,b) => (a.originalTimestamp || 0) - (b.originalTimestamp || 0));
      setMessages(resolvedMessages);
      setIsLoadingMessages(false);

      // TODO: Implement notification generation logic here if document is hidden or chat is not active
      // For example:
      // if (document.hidden && onNewNotification && resolvedMessages.length > 0) {
      //   const lastMessage = resolvedMessages[resolvedMessages.length - 1];
      //   if (!lastMessage.isOwnMessage) {
      //     onNewNotification({ /* ... notification object ... */ });
      //   }
      // }

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
    const viewport = scrollAreaViewportRef.current;
    if (viewport) {
      setTimeout(() => {
        viewport.scrollTop = viewport.scrollHeight;
      }, 0);
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
            avatar: currentUserProfile.avatar || `https://placehold.co/40x40.png?text=${currentUserProfile.displayName.charAt(0)}`,
            content,
            originalTimestamp: Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: true,
            senderNameColor: currentUserProfile.nameColor,
            senderTitle: currentUserProfile.title,
        };
        setMessages(prev => [...prev, userMessage]);
        setIsAiResponding(true);

        try {
          const aiResponsePayload: AiChatInput = { message: content };
          const aiResult: AiChatOutput = await aiChat(aiResponsePayload);

          const aiResponseMessage: Message = {
            id: String(Date.now() + 1),
            sender: 'RealTalk AI',
            senderUid: 'ai-chatbot-uid',
            senderUsername: 'realtalk_ai',
            avatar: 'https://placehold.co/40x40.png?text=AI', 
            content: aiResult.response,
            originalTimestamp: Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: false,
            senderNameColor: '#8B5CF6'
          };
          setMessages(prev => [...prev, aiResponseMessage]);
        } catch (error: any) {
          console.error("Error calling AI chat flow or processing its response:", error);
          const errorMessageContent = error.message && error.message.includes("AI") ? error.message : "Sorry, I encountered an error. Please try again.";
          const errorMessage: Message = {
            id: String(Date.now() + 1),
            sender: 'RealTalk AI',
            senderUid: 'ai-chatbot-uid',
            senderUsername: 'realtalk_ai',
            avatar: 'https://placehold.co/40x40.png?text=AI',
            content: errorMessageContent,
            originalTimestamp: Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: false,
            senderNameColor: '#8B5CF6'
          };
          setMessages(prev => [...prev, errorMessage]);
          toast({
            title: "AI Error",
            description: "Could not get a response from the AI. " + (error.message || ""),
            variant: "destructive",
          });
        } finally {
          setIsAiResponding(false);
        }
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
      senderTitle: currentUserProfile.title,
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
        <CardTitle className="text-base md:text-lg font-headline">{chatTitle || "Loading Chat..."}</CardTitle>
        {chatType !== 'ai' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!currentUser}>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => toast({title: "Feature", description:"Block user clicked (UI only)"})}><UserX size={16} className="mr-2" /> Block User (mock)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full" viewportRef={scrollAreaViewportRef}>
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
             {chatType === 'ai' && isAiResponding && (
                <div className="flex items-center space-x-2 p-2.5">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={'https://placehold.co/40x40.png?text=AI'} alt={'RealTalk AI'} />
                        <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                    <div className="flex items-center space-x-1">
                        <span className="text-xs font-semibold" style={{color: '#8B5CF6'}}>RealTalk AI</span>
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-0">
        <ChatInput onSendMessage={handleSendMessage} disabled={(chatType === 'ai' && isAiResponding) || !currentUser} />
      </CardFooter>
    </Card>
  );
}
