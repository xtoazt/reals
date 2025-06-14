
'use client';

import { ChatInterface } from '@/components/chat/chat-interface';
import { notFound, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react'; 
import { auth, database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResolvedParams { 
  chatId: string;
}

interface ChatPageProps { 
  params: Promise<ResolvedParams>; 
}

interface UserProfileData {
  displayName: string;
}

interface GCChatData {
    gcName: string;
    members?: { [uid: string]: boolean };
}

export default function ChatPage({ params: paramsPromise }: ChatPageProps) {
  const params = React.use(paramsPromise);
  const unwrappedChatId = params.chatId; 

  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatTitle, setChatTitle] = useState('');
  const [chatType, setChatType] = useState<'global' | 'gc' | 'dm' | 'ai'>('global');
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);
  const [resolvedChatId, setResolvedChatId] = useState(unwrappedChatId);

  useEffect(() => {
    setResolvedChatId(unwrappedChatId);
  }, [unwrappedChatId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      // setIsLoading(false); // Initial loading should be handled by chat data fetching
    });
    return () => unsubscribe();
  }, []); // Changed dependency from [router] to []

  useEffect(() => {
    setIsLoading(true); // Set loading true at the start of this effect
    let determinedTitle = '';
    let determinedType: 'global' | 'gc' | 'dm' | 'ai' = 'global';
    let determinedAnonymousMode = false;

    const setupChat = async () => {
      if (resolvedChatId === 'global') {
        determinedTitle = 'Global Chat';
        determinedType = 'global';
      } else if (resolvedChatId === 'global-unblocked') {
        determinedTitle = 'Unblocked Chat';
        determinedType = 'global';
      } else if (resolvedChatId === 'global-school') {
        determinedTitle = 'School Chat';
        determinedType = 'global';
      } else if (resolvedChatId === 'global-anonymous') {
        determinedTitle = 'Anonymous Chat';
        determinedType = 'global';
        determinedAnonymousMode = true;
      } else if (resolvedChatId === 'global-support') {
        determinedTitle = 'Support Chat';
        determinedType = 'global';
      } else if (resolvedChatId === 'ai-chatbot') {
        determinedTitle = 'AI Chatbot';
        determinedType = 'ai';
        setIsLoading(false); // AI chat doesn't need current user for initial title
      } else if (resolvedChatId && resolvedChatId.startsWith('dm_')) {
        determinedType = 'dm';
        if (currentUser && currentUser.uid) { 
          const uids = resolvedChatId.substring(3).split('_');
          const otherUserId = uids.find(uid => uid !== currentUser.uid);

          if (otherUserId) {
            try {
              const userRef = ref(database, `users/${otherUserId}`);
              const snapshot = await get(userRef);
              if (snapshot.exists()) {
                const userData = snapshot.val() as UserProfileData;
                determinedTitle = `Chat with ${userData.displayName || 'User'}`;
              } else {
                determinedTitle = 'Chat with User'; 
                console.warn(`User profile not found for DM partner: ${otherUserId}`);
              }
            } catch (error) {
              console.error("Error fetching DM user profile:", error);
              determinedTitle = 'Chat with User'; 
            }
          } else {
            determinedTitle = 'Direct Message'; 
            if (currentUser.uid && !uids.includes(currentUser.uid)) {
                console.error("Current user not part of this DM channel based on chatId:", resolvedChatId);
                determinedTitle = "Invalid DM";
            } else if (!otherUserId) {
                console.error("Could not determine other user in DM:", resolvedChatId);
                determinedTitle = "Invalid DM";
            }
          }
        } else if (!currentUser && chatType !== 'ai') { // Only set loading if DM requires current user
          setChatTitle('Loading DM...');
          // setIsLoading remains true or is set by this effect's start
          return; 
        } else {
            determinedTitle = 'Direct Message';
        }
      } else if (resolvedChatId && resolvedChatId.startsWith('gc-')) {
        determinedType = 'gc';
        try {
            const gcRef = ref(database, `chats/${resolvedChatId}`);
            const gcSnapshot = await get(gcRef);
            if (gcSnapshot.exists()) {
                const gcData = gcSnapshot.val() as GCChatData;
                determinedTitle = gcData.gcName || `Group Chat: ${resolvedChatId.substring(3, 15)}...`;
                if (currentUser && gcData.members && !gcData.members[currentUser.uid]) {
                    console.warn("Current user is not a member of this GC:", resolvedChatId);
                    determinedTitle = "Access Denied to GC";
                }
            } else {
                determinedTitle = "Group Chat Not Found";
                console.warn(`GC data not found for chatId: ${resolvedChatId}`);
            }
        } catch (error) {
            console.error("Error fetching GC details:", error);
            determinedTitle = "Error Loading GC";
        }
      } else {
        determinedTitle = "Invalid Chat";
      }
      
      setChatTitle(determinedTitle);
      setChatType(determinedType);
      setIsAnonymousMode(determinedAnonymousMode);
      setIsLoading(false); // Set loading to false after all async operations complete or determined invalid
    };

    // Only run setupChat if currentUser is resolved (for non-AI chats) or if it's an AI chat
    if (currentUser !== undefined) { // Check if auth state is resolved
      if (chatType === 'ai' || currentUser) { // If AI chat, or if user is logged in for other chats
        setupChat();
      } else if (!currentUser && chatType !== 'ai') {
        // User is not logged in, and it's not an AI chat, show loading or an appropriate message
        // This case might mean we wait for currentUser to become non-null or redirect.
        // For now, if setupChat requires currentUser and it's null, it handles it internally.
        // If chat is of a type that requires login, and user is null, we might want to prevent setupChat
        // or let setupChat determine it's an invalid state.
        // The current logic in setupChat seems to handle cases where currentUser is needed.
        // We ensure setIsLoading(false) is called if setupChat doesn't run or bails early.
         if (resolvedChatId && (resolvedChatId.startsWith('dm_') || resolvedChatId.startsWith('gc-'))) {
            // Waiting for currentUser for DM/GC title
         } else if (resolvedChatId === 'global' || resolvedChatId === 'global-unblocked' || resolvedChatId === 'global-school' || resolvedChatId === 'global-anonymous' || resolvedChatId === 'global-support') {
           setupChat(); // These global chats can set title without current user initially.
         } else if (!resolvedChatId || resolvedChatId === 'ai-chatbot'){
           setupChat(); // AI chat or invalid (will be caught)
         } else {
           setIsLoading(false); // If no specific path taken, ensure loading is false.
         }
      }
    }


  }, [resolvedChatId, currentUser, chatType]); // Added chatType as a dependency

  // This effect ensures isLoading is false if currentUser becomes known as null and chat is not AI
  useEffect(() => {
    if (currentUser === null && chatType !== 'ai') {
        // If the chat type isn't AI and we know the user is logged out,
        // and if a title hasn't been set (e.g. for DM/GC that failed to load),
        // we might want to force isLoading to false or show an auth required message.
        // The main setupChat effect tries to handle this, but as a safeguard:
        if (!chatTitle && (resolvedChatId.startsWith('dm_') || resolvedChatId.startsWith('gc-'))) {
             setChatTitle("Authentication Required"); // Or some placeholder
        }
        if (isLoading) setIsLoading(false); // Ensure loading is false if stuck
    }
  }, [currentUser, chatType, resolvedChatId, chatTitle, isLoading]);


  if (isLoading || currentUser === undefined ) { // currentUser === undefined means auth state not yet resolved
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }
  
  if (!isLoading && (!chatTitle || chatTitle === "Invalid DM" || chatTitle === "Access Denied to GC" || chatTitle === "Group Chat Not Found" || chatTitle === "Error Loading GC" || chatTitle === "Invalid Chat" || chatTitle === "Authentication Required")) { 
      return (
        <div className="flex flex-col justify-center items-center h-full text-center p-4">
          <p className="text-lg font-semibold">{chatTitle === "Authentication Required" ? "Authentication Required" : "Could not load chat information."}</p>
          <p className="text-muted-foreground">{chatTitle === "Authentication Required" ? "Please log in to access this chat." : "The chat may be invalid, not found, or you might not have access."}</p>
          <Button onClick={() => router.push(chatTitle === "Authentication Required" ? '/auth' : '/dashboard')} className="mt-4">
            {chatTitle === "Authentication Required" ? "Go to Login" : "Go to Dashboard"}
          </Button>
        </div>
      );
  }

  return (
     <div className="h-full max-h-[calc(100vh-57px-2rem)] md:max-h-[calc(100vh-57px-3rem)]">
      <ChatInterface
        chatTitle={chatTitle}
        chatType={chatType}
        chatId={resolvedChatId}
        isAnonymousMode={isAnonymousMode}
        currentUser={currentUser} // Pass currentUser as a prop
      />
    </div>
  );
}

