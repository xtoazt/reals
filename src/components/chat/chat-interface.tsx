
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChatMessage, type Message, type Reactions } from './chat-message';
import { ChatInput } from './chat-input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MoreVertical, UserPlus, LogOut as LeaveIcon, UserX, Info, Loader2, Users, ArrowDown, ThumbsUp, Heart } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { database, auth } from '@/lib/firebase';
import { type User as FirebaseUser } from 'firebase/auth';
import { ref, onValue, push, serverTimestamp, query, orderByChild, limitToLast, off, get, set, remove, runTransaction, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { aiChat, type AiChatInput, type AiChatOutput } from '@/ai/flows/ai-chat-flow';
import { cn } from '@/lib/utils';


interface ChatInterfaceProps {
  chatTitle: string;
  chatType: 'global' | 'gc' | 'dm' | 'ai';
  chatId?: string;
  isAnonymousMode?: boolean;
  currentUser: FirebaseUser | null;
  authResolved: boolean;
}

interface UserProfileData {
  uid: string;
  username: string;
  displayName: string;
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
const MESSAGES_TO_LOAD = 50;

// Utility function to fetch user profile data - DOES NOT MUTATE STATE
async function fetchUserProfileDataUtil(uid: string): Promise<UserProfileData | null> {
  if (uid === 'ai-chatbot-uid') {
    return {
      uid, username: 'realtalk_ai', displayName: 'RealTalk AI',
      avatar: `https://placehold.co/40x40.png?text=AI`, nameColor: '#8B5CF6',
      isShinyGold: false, isShinySilver: false, isAdmin: false,
    };
  }
  if (uid === 'system') {
    return {
      uid, username: 'system', displayName: 'System',
      avatar: `https://placehold.co/40x40.png?text=SYS`, nameColor: '#71717a',
      isShinyGold: false, isShinySilver: false, isAdmin: false,
    };
  }
  try {
    const userRef = ref(database, `users/${uid}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      const userData = snapshot.val();
      return {
        uid,
        username: userData.username,
        displayName: userData.displayName || userData.username,
        avatar: userData.avatar,
        nameColor: userData.nameColor,
        title: userData.title,
        isShinyGold: userData.isShinyGold || false,
        isShinySilver: userData.isShinySilver || false,
        isAdmin: userData.isAdmin || false,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching user profile for ${uid}:`, error);
    return null;
  }
}


export function ChatInterface({ chatTitle, chatType, chatId = 'global', isAnonymousMode = false, currentUser, authResolved }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfileData | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [usersCache, setUsersCache] = useState<{[uid: string]: UserProfileData | null}>({});
  const [typingUsers, setTypingUsers] = useState<{[uid: string]: TypingStatus}>({});

  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const [hasNewMessagesWhileScrolledUp, setHasNewMessagesWhileScrolledUp] = useState(false);
  const prevMessagesLengthRef = useRef(messages.length);
  const messagesBeingMarkedAsRead = useRef(new Set<string>());


  const typingStatusRef = useMemo(() => (authResolved && chatId) ? ref(database, `typing_status/${chatId}`) : null, [authResolved, chatId]);
  const currentUserTypingRef = useMemo(() => (authResolved && chatId && currentUser?.uid) ? ref(database, `typing_status/${chatId}/${currentUser.uid}`) : null, [authResolved, chatId, currentUser?.uid]);


  useEffect(() => {
    if (!authResolved) return; // Wait for auth to be resolved by parent

    if (currentUser?.uid) { // Ensure currentUser and its uid are available
      // Check if current user's profile is in cache or needs fetching
      if (!usersCache[currentUser.uid]) {
        fetchUserProfileDataUtil(currentUser.uid).then(profile => {
          if (profile) {
            setUsersCache(prev => ({ ...prev, [currentUser.uid!]: profile }));
            setCurrentUserProfile(profile);
          } else {
            const fallbackUsername = currentUser.email?.split('@')[0] || "user";
            const fallbackProfile: UserProfileData = {
              uid: currentUser.uid!, username: fallbackUsername,
              displayName: currentUser.displayName || fallbackUsername,
              avatar: `https://placehold.co/40x40.png?text=${(currentUser.displayName || "U").charAt(0)}`,
            };
            setUsersCache(prev => ({ ...prev, [currentUser.uid!]: fallbackProfile }));
            setCurrentUserProfile(fallbackProfile);
          }
        });
      } else {
        // Profile is in cache, set it
        setCurrentUserProfile(usersCache[currentUser.uid]);
      }
    } else {
      // No current user / logged out
      setCurrentUserProfile(null);
    }
  }, [authResolved, currentUser, usersCache]); // usersCache is a dependency to re-derive currentUserProfile if cache updates


  useEffect(() => {
    if (!authResolved || !typingStatusRef || chatType === 'ai' || !currentUser?.uid) {
      setTypingUsers({});
      return;
    }

    const listener = onValue(typingStatusRef, (snapshot) => {
        const data = snapshot.val();
        const now = Date.now();
        const activeTypers: {[uid: string]: TypingStatus} = {};
        if (data) {
            Object.entries(data).forEach(([uid, status]) => {
                const typingInfo = status as {isTyping: boolean, timestamp: number, displayName?: string};
                if (uid !== currentUser?.uid && typingInfo.isTyping && (now - typingInfo.timestamp < TYPING_TIMEOUT_MS)) {
                    activeTypers[uid] = {...typingInfo, displayName: isAnonymousMode ? "Someone" : (typingInfo.displayName || "Someone") };
                }
            });
        }
        setTypingUsers(activeTypers);
    });

    return () => off(typingStatusRef, 'value', listener);
  }, [authResolved, typingStatusRef, currentUser?.uid, chatType, isAnonymousMode]);


  useEffect(() => {
    if (!authResolved) {
        setIsLoadingMessages(false);
        setMessages([]);
        return;
    }

    if (chatType === 'ai') {
      setIsLoadingMessages(false);
      if (chatId === 'ai-chatbot' && messages.length === 0) {
        fetchUserProfileDataUtil('ai-chatbot-uid').then(aiProfile => {
            if (aiProfile) setUsersCache(prev => ({...prev, 'ai-chatbot-uid': aiProfile}));
            setMessages([
              {
                id: 'ai-welcome', sender: aiProfile?.displayName || 'RealTalk AI',
                senderUid: 'ai-chatbot-uid', senderUsername: aiProfile?.username || 'realtalk_ai',
                avatar: aiProfile?.avatar || 'https://placehold.co/40x40.png?text=AI',
                content: "Hello! I'm your AI Chatbot. How can I help you today?",
                originalTimestamp: Date.now(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isOwnMessage: false, senderNameColor: aiProfile?.nameColor || '#8B5CF6', chatType: 'ai',
              }
            ]);
        });
      }
      return;
    }

    if (!currentUser?.uid || !chatId ) { // Ensure currentUser.uid is available
        setIsLoadingMessages(false);
        setMessages([]);
        return;
    }

    setIsLoadingMessages(true);
    let messagesPath: string;
    if (chatType === 'gc') {
      messagesPath = `chats/${chatId}/messages`;
    } else {
      messagesPath = `chats/${chatId}`;
    }

    const messagesRefQuery = query(ref(database, messagesPath), orderByChild('timestamp'), limitToLast(MESSAGES_TO_LOAD));

    const listener = onValue(messagesRefQuery, async (snapshot) => {
      const messageDataArray: { key: string, data: any }[] = [];
      snapshot.forEach((childSnapshot) => {
        const msgData = childSnapshot.val();
        if (msgData && typeof msgData === 'object' && msgData.senderUid && msgData.content && msgData.timestamp) {
            messageDataArray.push({ key: childSnapshot.key!, data: msgData });
        }
      });

      const uidsInSnapshot = new Set<string>();
      messageDataArray.forEach(msgEntry => {
        if (msgEntry.data.senderUid) uidsInSnapshot.add(msgEntry.data.senderUid);
      });

      const newProfilesToFetch: Record<string, UserProfileData | null> = {};
      const profilesToFetchPromises: Promise<void>[] = [];

      uidsInSnapshot.forEach(uid => {
        if (usersCache[uid] === undefined) { // Fetch only if not attempted before (undefined, not null)
          profilesToFetchPromises.push(
            fetchUserProfileDataUtil(uid).then(profile => {
              newProfilesToFetch[uid] = profile; // Store fetched profile (or null if not found)
            })
          );
        }
      });

      await Promise.all(profilesToFetchPromises);

      if (Object.keys(newProfilesToFetch).length > 0) {
        setUsersCache(prevCache => ({ ...prevCache, ...newProfilesToFetch }));
      }

      const currentCombinedCache = { ...usersCache, ...newProfilesToFetch }; // Use immediately for this render pass

      const resolvedMessages = messageDataArray.map((msgEntry) => {
        const msgData = msgEntry.data;
        const senderUid = msgData.senderUid;
        let profile: UserProfileData | null | undefined = currentCombinedCache[senderUid];

        const defaultAvatarText = (profile?.displayName || msgData.senderName || "U").charAt(0).toUpperCase();
        const avatarUrl = profile?.avatar || msgData.senderAvatar || `https://placehold.co/40x40.png?text=${defaultAvatarText}`;

        const messageObject: Message = {
            id: msgEntry.key!,
            sender: profile?.displayName || msgData.senderName || (isAnonymousMode && senderUid !== currentUser?.uid && senderUid !== 'system' && senderUid !== 'ai-chatbot-uid' ? "Anonymous" : "User"),
            senderUid: senderUid,
            senderUsername: profile?.username || msgData.senderUsername || (isAnonymousMode && senderUid !== currentUser?.uid && senderUid !== 'system' && senderUid !== 'ai-chatbot-uid' ? "anonymous" : "user"),
            avatar: avatarUrl, content: msgData.content, originalTimestamp: msgData.timestamp,
            timestamp: new Date(msgData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: senderUid === currentUser?.uid,
            senderNameColor: (isAnonymousMode && senderUid !== currentUser?.uid && senderUid !== 'system' && senderUid !== 'ai-chatbot-uid') ? undefined : (profile?.nameColor || msgData.senderNameColor),
            senderTitle: (isAnonymousMode && senderUid !== currentUser?.uid && senderUid !== 'system' && senderUid !== 'ai-chatbot-uid') ? undefined : (profile?.title || msgData.senderTitle),
            senderIsShinyGold: (isAnonymousMode && senderUid !== currentUser?.uid && senderUid !== 'system' && senderUid !== 'ai-chatbot-uid') ? false : (profile?.isShinyGold || msgData.senderIsShinyGold || false),
            senderIsShinySilver: (isAnonymousMode && senderUid !== currentUser?.uid && senderUid !== 'system' && senderUid !== 'ai-chatbot-uid') ? false : (profile?.isShinySilver || msgData.senderIsShinySilver || false),
            senderIsAdmin: (isAnonymousMode && senderUid !== currentUser?.uid && senderUid !== 'system' && senderUid !== 'ai-chatbot-uid') ? false : (profile?.isAdmin || msgData.senderIsAdmin || false),
            reactions: msgData.reactions || {}, chatType: chatType,
            readByRecipientTimestamp: msgData.readByRecipientTimestamp,
        };

        if (chatType === 'dm' && senderUid !== currentUser?.uid && !msgData.readByRecipientTimestamp && !messagesBeingMarkedAsRead.current.has(msgEntry.key!) && currentUser?.uid) {
            messagesBeingMarkedAsRead.current.add(msgEntry.key!);
            const messageRef = ref(database, `${messagesPath}/${msgEntry.key!}`);
            update(messageRef, { readByRecipientTimestamp: serverTimestamp() })
                .then(() => messagesBeingMarkedAsRead.current.delete(msgEntry.key!))
                .catch(err => {
                    console.error("Failed to mark message as read:", err);
                    messagesBeingMarkedAsRead.current.delete(msgEntry.key!);
                });
        }
        return messageObject;
      });

      resolvedMessages.sort((a,b) => (a.originalTimestamp || 0) - (b.originalTimestamp || 0));
      setMessages(resolvedMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      toast({ title: "Error", description: `Could not load messages. ${error.message}`, variant: "destructive" });
      setIsLoadingMessages(false);
    });

    return () => off(messagesRefQuery, 'value', listener);
  }, [authResolved, currentUser, chatType, chatId, toast, isAnonymousMode, usersCache]);


  useEffect(() => {
    const viewport = scrollAreaViewportRef.current;
    if (viewport) {
      const newMessagesArrived = messages.length > prevMessagesLengthRef.current;
      const lastMessage = messages[messages.length - 1];
      const isLastMessageNotOwnOrSystem = lastMessage && currentUser?.uid !== lastMessage.senderUid && lastMessage.senderUid !== 'system';

      if (showScrollToBottomButton && newMessagesArrived && isLastMessageNotOwnOrSystem) {
        setHasNewMessagesWhileScrolledUp(true);
      }
      if (!showScrollToBottomButton) {
        setTimeout(() => { viewport.scrollTop = viewport.scrollHeight; }, 0);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, showScrollToBottomButton, currentUser?.uid]);


  const handleSendMessage = async (content: string) => {
    if (!authResolved || !currentUser?.uid || !currentUserProfile) { // Ensure currentUser.uid and currentUserProfile
      toast({ title: "Not Logged In", description: "Please log in to send messages.", variant: "destructive" });
      return;
    }
    if (currentUserTypingRef && !isAnonymousMode && currentUserProfile.displayName) { // Check displayName for typing payload
        remove(currentUserTypingRef);
    }

    if (chatType === 'ai') {
        const userMessage: Message = {
            id: String(Date.now()), sender: currentUserProfile.displayName, senderUid: currentUserProfile.uid,
            senderUsername: currentUserProfile.username,
            avatar: currentUserProfile.avatar || `https://placehold.co/40x40.png?text=${currentUserProfile.displayName.charAt(0)}`,
            content, originalTimestamp: Date.now(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: true, senderNameColor: currentUserProfile.nameColor, senderTitle: currentUserProfile.title,
            senderIsShinyGold: currentUserProfile.isShinyGold, senderIsShinySilver: currentUserProfile.isShinySilver,
            senderIsAdmin: currentUserProfile.isAdmin, chatType: 'ai',
        };
        setMessages(prev => [...prev, userMessage]);
        setIsAiResponding(true);

        try {
          const aiResponsePayload: AiChatInput = { message: content };
          const aiResult: AiChatOutput = await aiChat(aiResponsePayload);

          let aiProfile = usersCache['ai-chatbot-uid'];
          if (!aiProfile) {
              aiProfile = await fetchUserProfileDataUtil('ai-chatbot-uid');
              if (aiProfile) setUsersCache(prev => ({...prev, 'ai-chatbot-uid': aiProfile}));
          }

          const aiResponseMessage: Message = {
            id: String(Date.now() + 1), sender: aiProfile?.displayName || 'RealTalk AI', senderUid: 'ai-chatbot-uid',
            senderUsername: aiProfile?.username || 'realtalk_ai',
            avatar: aiProfile?.avatar || 'https://placehold.co/40x40.png?text=AI', content: aiResult.response,
            originalTimestamp: Date.now(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: false, senderNameColor: aiProfile?.nameColor || '#8B5CF6', chatType: 'ai',
          };
          setMessages(prev => [...prev, aiResponseMessage]);
        } catch (error: any) {
          console.error("Error calling AI chat flow or processing its response:", error);
          const errorMessageContent = (error.message && error.message.includes("AI") ? error.message : "Sorry, I encountered an error. Please try again.") || "The AI is unable to respond at this moment.";

          let aiProfile = usersCache['ai-chatbot-uid'];
          if (!aiProfile) {
              aiProfile = await fetchUserProfileDataUtil('ai-chatbot-uid');
              if (aiProfile) setUsersCache(prev => ({...prev, 'ai-chatbot-uid': aiProfile}));
          }

          const errorMessage: Message = {
            id: String(Date.now() + 1), sender: aiProfile?.displayName || 'RealTalk AI', senderUid: 'ai-chatbot-uid',
            senderUsername: aiProfile?.username || 'realtalk_ai',
            avatar: aiProfile?.avatar || 'https://placehold.co/40x40.png?text=AI', content: errorMessageContent,
            originalTimestamp: Date.now(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwnMessage: false, senderNameColor: aiProfile?.nameColor || '#8B5CF6', chatType: 'ai',
          };
          setMessages(prev => [...prev, errorMessage]);
          toast({ title: "AI Error", description: "Could not get a response from the AI. " + (error.message || ""), variant: "destructive", });
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
    } else {
      messagesDbRefPath = `chats/${chatId}`;
    }
    const messagesDbRef = ref(database, messagesDbRefPath);

    const baseMessagePayload = {
      senderUid: currentUserProfile.uid,
      senderName: isAnonymousMode ? "Anonymous" : currentUserProfile.displayName,
      senderUsername: isAnonymousMode ? `anon_${currentUserProfile.uid.substring(0,6)}` : currentUserProfile.username,
      senderAvatar: isAnonymousMode ? `https://placehold.co/40x40.png?text=??` : (currentUserProfile.avatar || `https://placehold.co/40x40.png?text=${currentUserProfile.displayName.charAt(0)}`),
      content, timestamp: serverTimestamp(), reactions: {},
    };
    const newMessagePayload: { [key: string]: any } = { ...baseMessagePayload };

    if (!isAnonymousMode) {
        newMessagePayload.senderIsShinyGold = currentUserProfile.isShinyGold || false;
        newMessagePayload.senderIsShinySilver = currentUserProfile.isShinySilver || false;
        newMessagePayload.senderIsAdmin = currentUserProfile.isAdmin || false;
        if (!currentUserProfile.isShinyGold && !currentUserProfile.isShinySilver && currentUserProfile.nameColor) {
          newMessagePayload.senderNameColor = currentUserProfile.nameColor;
        }
        if (currentUserProfile.title) {
          newMessagePayload.senderTitle = currentUserProfile.title;
        }
    }

    try {
      await push(messagesDbRef, newMessagePayload);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Error", description: "Could not send message.", variant: "destructive" });
    }
  };

  const typingUsersArray = useMemo(() => {
    if (isAnonymousMode) {
        return Object.values(typingUsers).some(u => u.isTyping && (Date.now() - u.timestamp < TYPING_TIMEOUT_MS)) ? ["Someone is typing..."] : [];
    }
    return Object.values(typingUsers)
                 .filter(u => u.isTyping && (Date.now() - u.timestamp < TYPING_TIMEOUT_MS))
                 .map(u => u.displayName);
  }, [typingUsers, isAnonymousMode]);

  const typingDisplayMessage = useMemo(() => {
    if (isAnonymousMode && typingUsersArray.length > 0) return "Someone is typing...";
    if (isAnonymousMode) return null;

    if (typingUsersArray.length === 0) return null;
    if (typingUsersArray.length === 1) return `${typingUsersArray[0]} is typing...`;
    if (typingUsersArray.length === 2) return `${typingUsersArray[0]} and ${typingUsersArray[1]} are typing...`;
    return `${typingUsersArray.slice(0, 2).join(', ')}, and others are typing...`;
  }, [typingUsersArray, isAnonymousMode]);


  const handleViewportScroll = useCallback(() => {
    const viewport = scrollAreaViewportRef.current;
    if (viewport) {
      const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 1;
      if (atBottom) {
        setShowScrollToBottomButton(false);
        setHasNewMessagesWhileScrolledUp(false);
      } else {
        const userScrolledSignificantlyUp = viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - SCROLL_TO_BOTTOM_THRESHOLD;
        if (userScrolledSignificantlyUp) setShowScrollToBottomButton(true);
        else {
          setShowScrollToBottomButton(false);
          if (!userScrolledSignificantlyUp) setHasNewMessagesWhileScrolledUp(false);
        }
      }
      if (chatType === 'dm' && currentUser?.uid && !atBottom) { // Ensure currentUser.uid before iterating
          messages.forEach(msg => {
              if (msg.senderUid !== currentUser.uid && !msg.readByRecipientTimestamp && !messagesBeingMarkedAsRead.current.has(msg.id)) {
                  const messageElement = document.getElementById(`message-${msg.id}`);
                  if (messageElement) {
                      const rect = messageElement.getBoundingClientRect();
                      const viewportRect = viewport.getBoundingClientRect();
                      if (rect.top >= viewportRect.top && rect.bottom <= viewportRect.bottom) {
                          messagesBeingMarkedAsRead.current.add(msg.id);
                          const msgPath = msg.chatType === 'gc' ? `chats/${chatId}/messages/${msg.id}` : `chats/${chatId}/${msg.id}`;
                          const messageRef = ref(database, msgPath);
                          update(messageRef, { readByRecipientTimestamp: serverTimestamp() })
                              .then(() => messagesBeingMarkedAsRead.current.delete(msg.id))
                              .catch(err => {
                                  console.error("Failed to mark message as read on scroll:", err);
                                  messagesBeingMarkedAsRead.current.delete(msg.id);
                              });
                      }
                  }
              }
          });
      }
    }
  }, [messages, chatType, currentUser, chatId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = scrollAreaViewportRef.current;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
      setShowScrollToBottomButton(false);
      setHasNewMessagesWhileScrolledUp(false);
    }
  }, []);

  const handleToggleReaction = useCallback(async (messageId: string, reactionType: keyof Reactions, msgChatType: Message['chatType'], currentChatId: string) => {
    if (!authResolved || !currentUser?.uid || !currentUserProfile || !msgChatType || !currentChatId || isAnonymousMode) return; // Ensure currentUser.uid

    const messagePathPrefix = msgChatType === 'gc' ? `chats/${currentChatId}/messages` : `chats/${currentChatId}`;
    const reactionRef = ref(database, `${messagePathPrefix}/${messageId}/reactions/${reactionType}`);

    try {
      await runTransaction(reactionRef, (currentData) => {
        if (currentData === null) return { count: 1, users: { [currentUser.uid!]: true } }; // Use ! for currentUser.uid as it's checked
        const currentUsers = currentData.users || {};
        if (currentUsers[currentUser.uid!]) { // Use !
          currentData.count = (currentData.count || 0) - 1;
          delete currentUsers[currentUser.uid!]; // Use !
          if (currentData.count <= 0) return null;
        } else {
          currentData.count = (currentData.count || 0) + 1;
          currentUsers[currentUser.uid!] = true; // Use !
        }
        currentData.users = currentUsers;
        return currentData;
      });
    } catch (error) {
      console.error("Error toggling reaction:", error);
      toast({ title: "Error", description: "Could not update reaction.", variant: "destructive" });
    }
  }, [authResolved, currentUser, currentUserProfile, toast, isAnonymousMode]);


  return (
    <Card className="flex flex-col h-full w-full shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-3 md:p-4 border-b">
        <CardTitle className="text-base md:text-lg font-headline">{chatTitle || "Loading Chat..."}</CardTitle>
        {chatType !== 'ai' && !isAnonymousMode && authResolved && currentUser && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"> <MoreVertical size={20} /> </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {chatType === 'gc' && (
              <><DropdownMenuItem onClick={() => toast({title: "Feature", description:"Invite friends to GC clicked (UI only)"})}><UserPlus size={16} className="mr-2" /> Invite Friends</DropdownMenuItem>
               <DropdownMenuItem onClick={() => toast({title: "Feature", description:"GC info clicked (UI only)"})}><Info size={16} className="mr-2" /> GC Info</DropdownMenuItem>
               <DropdownMenuSeparator />
               <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => toast({title: "Feature", description:"Leave GC clicked (UI only)"})}><LeaveIcon size={16} className="mr-2" /> Leave GC</DropdownMenuItem></>
            )}
             {chatType === 'dm' && (
              <><DropdownMenuItem onClick={() => toast({title: "Feature", description:"View user's profile (UI only)"})}><Info size={16} className="mr-2" /> View Profile</DropdownMenuItem>
               <DropdownMenuSeparator /></>
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
            {isLoadingMessages && (!messages || messages.length === 0) ? (
              <div className="flex justify-center items-center h-full p-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
            ) : messages.length === 0 && chatType !== 'ai' ? (
              <div className="text-center text-muted-foreground py-10"> <p>No messages yet.</p> <p>Be the first to say something!</p> </div>
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
                  <ChatMessage key={msg.id} message={{...msg, chatType: chatType}}
                    showAvatarAndSender={showAvatarAndSender} isContinuation={isContinuation}
                    onToggleReaction={handleToggleReaction} chatId={chatId} isAnonymousContext={isAnonymousMode} />
                );
              })
            )}
            {chatType === 'ai' && isAiResponding && (
                <div className="flex items-center space-x-2 p-2.5">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={usersCache['ai-chatbot-uid']?.avatar || `https://placehold.co/40x40.png?text=AI`} alt="RealTalk AI" />
                            <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                    </div>
                    <div className="flex items-center space-x-1">
                        <span className="text-xs font-semibold" style={{color: usersCache['ai-chatbot-uid']?.nameColor || '#8B5CF6'}}>RealTalk AI</span>
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                </div>
            )}
          </div>
        </ScrollArea>
        {showScrollToBottomButton && (
            <Button variant="outline" size="default"
                className={cn("absolute bottom-4 right-4 z-10 rounded-full shadow-lg h-10 px-3 md:px-4 text-sm", "bg-background/80 backdrop-blur-sm hover:bg-background")}
                onClick={() => scrollToBottom('smooth')}>
                <ArrowDown className={cn("h-4 w-4 md:h-5 md:w-5", hasNewMessagesWhileScrolledUp ? "mr-1 md:mr-1.5 animate-bounce-sm" : "mr-0 md:mr-1")} />
                <span className="hidden md:inline">{hasNewMessagesWhileScrolledUp ? "New Messages" : "To Bottom"}</span>
                {hasNewMessagesWhileScrolledUp && <span className="md:hidden">New!</span>}
            </Button>
        )}
      </CardContent>
      {authResolved && typingDisplayMessage && (
        <div className="px-4 pb-1 pt-0 text-xs text-muted-foreground h-5"> {typingDisplayMessage} </div>
      )}
      <CardFooter className="p-0">
        <ChatInput
            onSendMessage={handleSendMessage}
            disabled={!authResolved || (chatType === 'ai' && isAiResponding) || (chatType !== 'ai' && !currentUser?.uid)} // Ensure currentUser.uid for non-AI
            chatId={authResolved ? chatId : undefined}
            currentUserProfile={(authResolved && currentUser?.uid && currentUserProfile) ? (isAnonymousMode ? { uid: currentUserProfile.uid, displayName: "You" } : currentUserProfile) : null} // Ensure currentUser.uid before passing profile
        />
      </CardFooter>
    </Card>
  );
}
