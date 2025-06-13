
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChatMessage, type Message } from './chat-message';
import { ChatInput } from './chat-input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MoreVertical, UserPlus, LogOut as LeaveIcon, UserX, Info, Loader2, Users, ArrowDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { auth, database } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { ref, onValue, push, serverTimestamp, query, orderByChild, limitToLast, off, get, set, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { aiChat, type AiChatInput, type AiChatOutput } from '@/ai/flows/ai-chat-flow';
import { cn } from '@/lib/utils';


interface ChatInterfaceProps {
  chatTitle: string;
  chatType: 'global' | 'gc' | 'dm' | 'ai';
  chatId?: string;
}

interface UserProfileData {
  uid: string;
  username: string;
  displayName: string; // Remains username
  avatar?: string;
  nameColor?: string;
  title?: string;
  isShinyGold?: boolean;
  isShinySilver?: boolean;
  isAdmin?: boolean;
}

interface TypingStatus {
    isTyping: boolean;
    timestamp: number;
    displayName: string;
}

const MESSAGE_GROUP_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const TYPING_TIMEOUT_MS = 5000; // 5 seconds for typing indicator to clear
const SCROLL_TO_BOTTOM_THRESHOLD = 200; // Pixels from bottom to show button

export function ChatInterface({ chatTitle, chatType, chatId = 'global' }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfileData | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [usersCache, setUsersCache] = useState<{[uid: string]: UserProfileData}>({});
  const [typingUsers, setTypingUsers] = useState<{[uid: string]: TypingStatus}>({});

  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const [hasNewMessagesWhileScrolledUp, setHasNewMessagesWhileScrolledUp] = useState(false);
  const prevMessagesLengthRef = useRef(messages.length);


  const typingStatusRef = useMemo(() => chatId ? ref(database, `typing_status/${chatId}`) : null, [chatId]);
  const currentUserTypingRef = useMemo(() => (chatId && currentUser?.uid) ? ref(database, `typing_status/${chatId}/${currentUser.uid}`) : null, [chatId, currentUser]);


  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfileData | null> => {
    if (usersCache[uid]) return usersCache[uid];
    if (uid === 'ai-chatbot-uid' || uid === 'system') {
      const specialProfile: UserProfileData = {
          uid,
          username: uid === 'ai-chatbot-uid' ? 'realtalk_ai' : 'system',
          displayName: uid === 'ai-chatbot-uid' ? 'RealTalk AI' : 'System',
          avatar: `https://placehold.co/40x40.png?text=${uid === 'ai-chatbot-uid' ? 'AI' : 'SYS'}`,
          nameColor: uid === 'ai-chatbot-uid' ? '#8B5CF6' : '#71717a',
          isShinyGold: false,
          isShinySilver: false,
          isAdmin: false,
      };
      setUsersCache(prev => ({...prev, [uid]: specialProfile}));
      return specialProfile;
    }
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const profile: UserProfileData = {
          uid,
          username: userData.username,
          displayName: userData.username, // Use username as displayName
          avatar: userData.avatar,
          nameColor: userData.nameColor,
          title: userData.title,
          isShinyGold: userData.isShinyGold || false,
          isShinySilver: userData.isShinySilver || false,
          isAdmin: userData.isAdmin || false,
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
            if(profile) {
                setCurrentUserProfile(profile);
            } else {
                const fallbackUsername = user.email?.split('@')[0] || "user";
                setCurrentUserProfile({
                    uid: user.uid,
                    username: fallbackUsername,
                    displayName: fallbackUsername, // Use username as displayName
                    avatar: `https://placehold.co/40x40.png?text=${(user.displayName || "U").charAt(0)}`,
                    isShinyGold: false,
                    isShinySilver: false,
                    isAdmin: false,
                });
            }
        });
      } else {
        setCurrentUserProfile(null);
        if (chatType !== 'ai') {
            setMessages([]);
        }
        if (chatType !== 'ai') setIsLoadingMessages(false);
      }
    });
    return () => unsubscribeAuth();
  }, [fetchUserProfile, chatType]);

  // Typing indicator listeners
  useEffect(() => {
    if (!typingStatusRef || chatType === 'ai') return;

    const listener = onValue(typingStatusRef, (snapshot) => {
        const data = snapshot.val();
        const now = Date.now();
        const activeTypers: {[uid: string]: TypingStatus} = {};
        if (data) {
            Object.entries(data).forEach(([uid, status]) => {
                const typingInfo = status as {isTyping: boolean, timestamp: number, displayName?: string};
                if (uid !== currentUser?.uid && typingInfo.isTyping && (now - typingInfo.timestamp < TYPING_TIMEOUT_MS)) {
                    const userToDisplay = usersCache[uid] || { displayName: typingInfo.displayName || "Someone" };
                    activeTypers[uid] = {...typingInfo, displayName: userToDisplay.displayName };
                }
            });
        }
        setTypingUsers(activeTypers);
    });

    return () => off(typingStatusRef, 'value', listener);
  }, [typingStatusRef, currentUser?.uid, chatType, usersCache]);


  // Message listeners
  useEffect(() => {
    if (chatType === 'ai') {
      setIsLoadingMessages(false);
      if (chatId === 'ai-chatbot' && messages.length === 0) {
        fetchUserProfile('ai-chatbot-uid').then(aiProfile => {
            setMessages([
              {
                id: 'ai-welcome',
                sender: aiProfile?.displayName || 'RealTalk AI',
                senderUid: 'ai-chatbot-uid',
                senderUsername: aiProfile?.username || 'realtalk_ai',
                avatar: aiProfile?.avatar || 'https://placehold.co/40x40.png?text=AI',
                content: "Hello! I'm your AI Chatbot. How can I help you today?",
                originalTimestamp: Date.now(),
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isOwnMessage: false,
                senderNameColor: aiProfile?.nameColor || '#8B5CF6',
                senderIsShinyGold: false,
                senderIsShinySilver: false,
                senderIsAdmin: false,
              }
            ]);
        });
      }
      return;
    }

    if (!currentUser || !chatId) {
        setIsLoadingMessages(false);
        setMessages([]);
        return;
    }

    setIsLoadingMessages(true);
    let messagesPath: string;
    if (chatType === 'gc') {
      messagesPath = `chats/${chatId}/messages`;
    } else { // 'global' or 'dm'
      messagesPath = `chats/${chatId}`;
    }

    const messagesRefQuery = query(ref(database, messagesPath), orderByChild('timestamp'), limitToLast(50));

    const listener = onValue(messagesRefQuery, async (snapshot) => {
      const messageDataArray: { key: string, data: any }[] = [];
      snapshot.forEach((childSnapshot) => {
        const msgData = childSnapshot.val();
        if (msgData && typeof msgData === 'object' && msgData.senderUid && msgData.content && msgData.timestamp) {
            messageDataArray.push({ key: childSnapshot.key!, data: msgData });
        }
      });

      const loadedMessagesPromises = messageDataArray.map(async (msgEntry) => {
        const msgData = msgEntry.data;
        const senderUid = msgData.senderUid;
        const profile = await fetchUserProfile(senderUid);

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
            senderIsShinyGold: profile?.isShinyGold || msgData.senderIsShinyGold || false,
            senderIsShinySilver: profile?.isShinySilver || msgData.senderIsShinySilver || false,
            senderIsAdmin: profile?.isAdmin || msgData.senderIsAdmin || false,
        };
      });

      const resolvedMessages = await Promise.all(loadedMessagesPromises);
      resolvedMessages.sort((a,b) => (a.originalTimestamp || 0) - (b.originalTimestamp || 0));
      setMessages(resolvedMessages);
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


  // Effect for auto-scrolling and detecting new messages while scrolled up
  useEffect(() => {
    const viewport = scrollAreaViewportRef.current;
    if (viewport) {
      const newMessagesArrived = messages.length > prevMessagesLengthRef.current;
      const lastMessage = messages[messages.length - 1];
      const isLastMessageNotOwnOrSystem = lastMessage && currentUser?.uid !== lastMessage.senderUid && lastMessage.senderUid !== 'system';

      if (showScrollToBottomButton && newMessagesArrived && isLastMessageNotOwnOrSystem) {
        setHasNewMessagesWhileScrolledUp(true);
      }

      if (!showScrollToBottomButton) { // Auto-scroll if not manually scrolled up
        setTimeout(() => {
          viewport.scrollTop = viewport.scrollHeight;
        }, 0);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, showScrollToBottomButton, currentUser?.uid]);


  const handleSendMessage = async (content: string) => {
    if (!currentUser || !currentUserProfile) {
      toast({ title: "Not Logged In", description: "Please log in to send messages.", variant: "destructive" });
      return;
    }
    if (currentUserTypingRef) {
        remove(currentUserTypingRef);
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
            senderIsShinyGold: currentUserProfile.isShinyGold,
            senderIsShinySilver: currentUserProfile.isShinySilver,
            senderIsAdmin: currentUserProfile.isAdmin,
        };
        setMessages(prev => [...prev, userMessage]);
        setIsAiResponding(true);

        try {
          const aiResponsePayload: AiChatInput = { message: content };
          const aiResult: AiChatOutput = await aiChat(aiResponsePayload);
          const aiProfile = await fetchUserProfile('ai-chatbot-uid');

          const aiResponseMessage: Message = {
            id: String(Date.now() + 1),
            sender: aiProfile?.displayName || 'RealTalk AI',
            senderUid: 'ai-chatbot-uid',
            senderUsername: aiProfile?.username || 'realtalk_ai',
            avatar: aiProfile?.avatar || 'https://placehold.co/40x40.png?text=AI',
            content: aiResult.response,
            originalTimestamp: Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: false,
            senderNameColor: aiProfile?.nameColor || '#8B5CF6',
            senderIsShinyGold: false,
            senderIsShinySilver: false,
            senderIsAdmin: false,
          };
          setMessages(prev => [...prev, aiResponseMessage]);
        } catch (error: any) {
          console.error("Error calling AI chat flow or processing its response:", error);
          const errorMessageContent = (error.message && error.message.includes("AI") ? error.message : "Sorry, I encountered an error. Please try again.") || "The AI is unable to respond at this moment.";
          const aiProfile = await fetchUserProfile('ai-chatbot-uid');
          const errorMessage: Message = {
            id: String(Date.now() + 1),
            sender: aiProfile?.displayName || 'RealTalk AI',
            senderUid: 'ai-chatbot-uid',
            senderUsername: aiProfile?.username || 'realtalk_ai',
            avatar: aiProfile?.avatar || 'https://placehold.co/40x40.png?text=AI',
            content: errorMessageContent,
            originalTimestamp: Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: false,
            senderNameColor: aiProfile?.nameColor || '#8B5CF6',
            senderIsShinyGold: false,
            senderIsShinySilver: false,
            senderIsAdmin: false,
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

    if (!chatId) {
        toast({ title: "Error", description: "Chat ID is missing.", variant: "destructive" });
        return;
    }

    let messagesDbRefPath: string;
    if (chatType === 'gc') {
      messagesDbRefPath = `chats/${chatId}/messages`;
    } else { // 'global' or 'dm'
      messagesDbRefPath = `chats/${chatId}`;
    }
    const messagesDbRef = ref(database, messagesDbRefPath);


    const baseMessagePayload = {
      senderUid: currentUserProfile.uid,
      senderName: currentUserProfile.displayName,
      senderUsername: currentUserProfile.username,
      senderAvatar: currentUserProfile.avatar || `https://placehold.co/40x40.png?text=${currentUserProfile.displayName.charAt(0)}`,
      content,
      timestamp: serverTimestamp(),
      senderIsShinyGold: currentUserProfile.isShinyGold || false,
      senderIsShinySilver: currentUserProfile.isShinySilver || false,
      senderIsAdmin: currentUserProfile.isAdmin || false,
    };

    const newMessagePayload: { [key: string]: any } = { ...baseMessagePayload };
    if (!currentUserProfile.isShinyGold && !currentUserProfile.isShinySilver && currentUserProfile.nameColor) {
      newMessagePayload.senderNameColor = currentUserProfile.nameColor;
    }
    if (currentUserProfile.title) {
      newMessagePayload.senderTitle = currentUserProfile.title;
    }

    try {
      await push(messagesDbRef, newMessagePayload);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Error", description: "Could not send message.", variant: "destructive" });
    }
  };

  const typingUsersArray = useMemo(() => {
    return Object.values(typingUsers)
                 .filter(u => u.isTyping && (Date.now() - u.timestamp < TYPING_TIMEOUT_MS))
                 .map(u => u.displayName);
  }, [typingUsers]);

  const typingDisplayMessage = useMemo(() => {
    if (typingUsersArray.length === 0) return null;
    if (typingUsersArray.length === 1) return `${typingUsersArray[0]} is typing...`;
    if (typingUsersArray.length === 2) return `${typingUsersArray[0]} and ${typingUsersArray[1]} are typing...`;
    return `${typingUsersArray.slice(0, 2).join(', ')}, and others are typing...`;
  }, [typingUsersArray]);


  const handleViewportScroll = useCallback(() => {
    const viewport = scrollAreaViewportRef.current;
    if (viewport) {
      const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 1;
      if (atBottom) {
        setShowScrollToBottomButton(false);
        setHasNewMessagesWhileScrolledUp(false);
      } else {
        const userScrolledSignificantlyUp = viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - SCROLL_TO_BOTTOM_THRESHOLD;
        if (userScrolledSignificantlyUp) {
          setShowScrollToBottomButton(true);
        } else {
          setShowScrollToBottomButton(false);
          if (!userScrolledSignificantlyUp) setHasNewMessagesWhileScrolledUp(false);
        }
      }
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = scrollAreaViewportRef.current;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
      setShowScrollToBottomButton(false);
      setHasNewMessagesWhileScrolledUp(false);
    }
  }, []);


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
            {chatType === 'gc' && (
              <>
                <DropdownMenuItem onClick={() => toast({title: "Feature", description:"Invite friends to GC clicked (UI only)"})}><UserPlus size={16} className="mr-2" /> Invite Friends</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({title: "Feature", description:"GC info clicked (UI only)"})}><Info size={16} className="mr-2" /> GC Info</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => toast({title: "Feature", description:"Leave GC clicked (UI only)"})}><LeaveIcon size={16} className="mr-2" /> Leave GC</DropdownMenuItem>
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
      <CardContent className="flex-1 overflow-hidden p-0 relative">
        <ScrollArea className="h-full" viewportRef={scrollAreaViewportRef} onScroll={handleViewportScroll}>
          <div className="p-2 md:p-4 space-y-0.5 md:space-y-1">
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
              messages.map((msg, index) => {
                const previousMessage = index > 0 ? messages[index - 1] : undefined;
                const isSameSenderAsPrevious = previousMessage && previousMessage.senderUid === msg.senderUid;

                let isWithinContinuationThreshold = false;
                if (isSameSenderAsPrevious && msg.originalTimestamp && previousMessage?.originalTimestamp) {
                    isWithinContinuationThreshold = (msg.originalTimestamp - previousMessage.originalTimestamp) < MESSAGE_GROUP_THRESHOLD_MS;
                }

                const showAvatarAndSender = !isSameSenderAsPrevious || !isWithinContinuationThreshold;
                const isContinuation = !showAvatarAndSender;

                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    showAvatarAndSender={showAvatarAndSender}
                    isContinuation={isContinuation}
                  />
                );
              })
            )}
            {chatType === 'ai' && isAiResponding && (
                <div className="flex items-center space-x-2 p-2.5">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm">AI</div>
                    <div className="flex items-center space-x-1">
                        <span className="text-xs font-semibold" style={{color: '#8B5CF6'}}>RealTalk AI</span>
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                </div>
            )}
          </div>
        </ScrollArea>
        {showScrollToBottomButton && (
            <Button
                variant="outline"
                size="default"
                className={cn(
                    "absolute bottom-4 right-4 z-10 rounded-full shadow-lg h-10 px-3 md:px-4 text-sm",
                    "bg-background/80 backdrop-blur-sm hover:bg-background"
                )}
                onClick={() => scrollToBottom('smooth')}
            >
                <ArrowDown
                    className={cn(
                        "h-4 w-4 md:h-5 md:w-5",
                        hasNewMessagesWhileScrolledUp ? "mr-1 md:mr-1.5 animate-bounce-sm" : "mr-0 md:mr-1"
                    )}
                />
                <span className="hidden md:inline">{hasNewMessagesWhileScrolledUp ? "New Messages" : "To Bottom"}</span>
                {hasNewMessagesWhileScrolledUp && <span className="md:hidden">New!</span>}
            </Button>
        )}
      </CardContent>
      {typingDisplayMessage && (
        <div className="px-4 pb-1 pt-0 text-xs text-muted-foreground h-5">
            {typingDisplayMessage}
        </div>
      )}
      <CardFooter className="p-0">
        <ChatInput
            onSendMessage={handleSendMessage}
            disabled={(chatType === 'ai' && isAiResponding) || !currentUser}
            chatId={chatId}
            currentUserProfile={currentUserProfile}
        />
      </CardFooter>
    </Card>
  );
}
