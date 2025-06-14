
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
  const [chatType, setChatType] = useState<'global' | 'gc' | 'dm' | 'ai'>('global'); // Default to global to avoid issues
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);
  const [resolvedChatId, setResolvedChatId] = useState(unwrappedChatId);

  useEffect(() => {
    setResolvedChatId(unwrappedChatId);
  }, [unwrappedChatId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsLoading(true);
    let determinedTitle = '';
    let determinedType: 'global' | 'gc' | 'dm' | 'ai' = 'global'; // Ensure a default
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
        // AI chat doesn't need current user for initial title, can set loading false sooner
        // but we'll let the main flow handle it for consistency.
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
        } else if (!currentUser && determinedType === 'dm') { // Check determinedType, not 'chatType' state
          setChatTitle('Loading DM...'); // Placeholder while waiting for user
          // setIsLoading remains true, will be handled by main logic or next effect run
          return; // Early return to wait for currentUser
        } else {
            determinedTitle = 'Direct Message'; // Fallback if currentUser somehow null but logic proceeded
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
         if (!currentUser && determinedType === 'gc') { // Check determinedType
            setChatTitle('Loading Group Chat...');
            return; // Early return
        }
      } else {
        determinedTitle = "Invalid Chat";
      }
      
      setChatTitle(determinedTitle);
      setChatType(determinedType);
      setIsAnonymousMode(determinedAnonymousMode);
      setIsLoading(false);
    };

    if (currentUser !== undefined) { // Auth state resolved (either user or null)
        // For global and AI chats, setup can proceed even if currentUser is null.
        // For DM and GC, setup proceeds only if currentUser is available (non-null).
        if (determinedType === 'dm' || determinedType === 'gc') {
            if (currentUser) {
                setupChat();
            } else {
                // Waiting for currentUser for DM/GC.
                // isLoading remains true. Error/auth message handled by render logic.
                // Potentially set a specific "Authentication Required" title here if desired for these types.
                if (resolvedChatId && (resolvedChatId.startsWith('dm_') || resolvedChatId.startsWith('gc-'))) {
                    setChatTitle("Authentication Required"); // More specific title while loading/waiting
                }
                // setIsLoading remains true or will be false if previous run set it.
                // The main render logic will show loading or "Auth Required"
            }
        } else { // For 'global', 'ai', or invalid types
            setupChat();
        }
    }
    // If currentUser is undefined, isLoading remains true, and "Loading chat..." is shown.
    // The effect will re-run when currentUser resolves.

  }, [resolvedChatId, currentUser]); // Removed chatType, relying on determinedType internally

  useEffect(() => {
    // This effect primarily handles the case where auth state resolves to null
    // and the chat type requires authentication, ensuring isLoading is false.
    if (currentUser === null) { // User is definitely logged out
      if (chatType === 'dm' || chatType === 'gc') {
        if (!chatTitle || chatTitle === 'Loading DM...' || chatTitle === 'Loading Group Chat...') {
          setChatTitle("Authentication Required");
        }
      }
      // For global/AI chats, or if title is already set (e.g. to "Anonymous Chat"),
      // isLoading might have already been set to false by the main effect.
      // This ensures it becomes false if it was stuck.
      if (isLoading) {
        setIsLoading(false);
      }
    }
  }, [currentUser, chatType, resolvedChatId, chatTitle, isLoading]);


  if (isLoading || currentUser === undefined ) { 
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }
  
  // If not loading, but chat couldn't be set up (e.g. invalid, access denied, or auth needed for DM/GC)
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
        currentUser={currentUser}
      />
    </div>
  );
}
