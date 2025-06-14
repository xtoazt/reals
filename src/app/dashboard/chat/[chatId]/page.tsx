
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
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [authResolved, setAuthResolved] = useState(false); // New state to track auth resolution
  const [isLoading, setIsLoading] = useState(true); // General loading for chat data, initially true
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
      setAuthResolved(true); // Mark that Firebase auth state has been determined
    });
    return () => unsubscribe();
  }, []); // Runs once on mount

  useEffect(() => {
    if (!authResolved) {
      setIsLoading(true); // Keep loading if auth state is not yet resolved
      return;
    }

    setIsLoading(true); // Start loading for chat-specific data

    let determinedInitialType: 'global' | 'gc' | 'dm' | 'ai' = 'global';
    if (resolvedChatId === 'global' || resolvedChatId === 'global-unblocked' || resolvedChatId === 'global-school' || resolvedChatId === 'global-anonymous' || resolvedChatId === 'global-support') {
      determinedInitialType = 'global';
    } else if (resolvedChatId === 'ai-chatbot') {
      determinedInitialType = 'ai';
    } else if (resolvedChatId?.startsWith('dm_')) {
      determinedInitialType = 'dm';
    } else if (resolvedChatId?.startsWith('gc-')) {
      determinedInitialType = 'gc';
    }

    const performChatSetup = async () => {
      let titleToSet = '';
      let typeToSet = determinedInitialType;
      let anonymousModeToSet = false;

      // currentUser is now guaranteed to be either a User object or null, not undefined
      if (currentUser === null) {
        // For non-AI chats, authentication is required by rules.
        // AI chat can handle null user (though ChatInterface might still need profile for "sender")
        if (determinedInitialType !== 'ai') {
            titleToSet = "Authentication Required";
        } else {
            // AI chat specific setup if needed for logged-out user (e.g. guest mode title)
            titleToSet = 'AI Chatbot'; // Default for AI chat even if logged out
            typeToSet = 'ai';
        }
      } else {
        // CurrentUser is a valid FirebaseUser object
        if (resolvedChatId === 'global') {
          titleToSet = 'Global Chat'; typeToSet = 'global';
        } else if (resolvedChatId === 'global-unblocked') {
          titleToSet = 'Unblocked Chat'; typeToSet = 'global';
        } else if (resolvedChatId === 'global-school') {
          titleToSet = 'School Chat'; typeToSet = 'global';
        } else if (resolvedChatId === 'global-anonymous') {
          titleToSet = 'Anonymous Chat'; typeToSet = 'global'; anonymousModeToSet = true;
        } else if (resolvedChatId === 'global-support') {
          titleToSet = 'Support Chat'; typeToSet = 'global';
        } else if (resolvedChatId === 'ai-chatbot') {
          titleToSet = 'AI Chatbot'; typeToSet = 'ai';
        } else if (resolvedChatId?.startsWith('dm_')) {
          typeToSet = 'dm';
          const uids = resolvedChatId.substring(3).split('_');
          const otherUserId = uids.find(uid => uid !== currentUser.uid);
          if (otherUserId) {
            try {
              const userRef = ref(database, `users/${otherUserId}`);
              const snapshot = await get(userRef);
              if (snapshot.exists()) {
                const userData = snapshot.val() as UserProfileData;
                titleToSet = `Chat with ${userData.displayName || 'User'}`;
              } else {
                titleToSet = 'Chat with User (Not Found)'; // More specific
              }
            } catch (error) {
              console.error("Error fetching DM user profile:", error);
              titleToSet = 'Error Loading DM'; // More specific
            }
          } else {
            titleToSet = "Invalid DM Chat"; // More specific
          }
        } else if (resolvedChatId?.startsWith('gc-')) {
          typeToSet = 'gc';
          try {
            const gcRef = ref(database, `chats/${resolvedChatId}`);
            const gcSnapshot = await get(gcRef);
            if (gcSnapshot.exists()) {
              const gcData = gcSnapshot.val() as GCChatData;
              titleToSet = gcData.gcName || `Group Chat: ${resolvedChatId.substring(3, 15)}...`;
              if (!gcData.members || !gcData.members[currentUser.uid]) {
                titleToSet = "Access Denied to Group Chat"; // More specific
              }
            } else {
              titleToSet = "Group Chat Not Found";
            }
          } catch (error) {
            console.error("Error fetching GC details:", error);
            titleToSet = "Error Loading Group Chat"; // More specific
          }
        } else {
          titleToSet = "Invalid Chat ID"; // More specific
        }
      }

      setChatTitle(titleToSet);
      setChatType(typeToSet);
      setIsAnonymousMode(anonymousModeToSet);
      setIsLoading(false); // Chat setup attempt (success or error state) is complete
    };

    performChatSetup();

  }, [resolvedChatId, currentUser, authResolved]); // Depend on authResolved


  if (!authResolved || isLoading) { // Show loading if auth not resolved OR chat data is loading
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }

  // At this point, auth is resolved, and initial chat data loading attempt is complete.
  // currentUser is either a User object or null.

  const chatNeedsAuthToView = chatType !== 'ai'; // Assuming only AI chat might allow unauthenticated view
  if (chatNeedsAuthToView && currentUser === null) {
      // This is a more direct check for auth requirement for non-AI chats
      return (
        <div className="flex flex-col justify-center items-center h-full text-center p-4">
          <p className="text-lg font-semibold">Authentication Required</p>
          <p className="text-muted-foreground">Please log in to access this chat.</p>
          <Button onClick={() => router.push('/auth')} className="mt-4">
            Go to Login
          </Button>
        </div>
      );
  }
  
  // Handle specific error titles that imply user might be logged in but chat is inaccessible/invalid
  const errorTitles = [
    "Authentication Required", // This can still be set by performChatSetup for AI if logic changes
    "Invalid DM Chat", "Chat with User (Not Found)", "Error Loading DM",
    "Access Denied to Group Chat", "Group Chat Not Found", "Error Loading Group Chat",
    "Invalid Chat ID"
  ];
  if (errorTitles.includes(chatTitle)) {
      return (
        <div className="flex flex-col justify-center items-center h-full text-center p-4">
          <p className="text-lg font-semibold">{chatTitle === "Authentication Required" ? "Authentication Required" : "Could not load chat."}</p>
          <p className="text-muted-foreground">
            {chatTitle === "Authentication Required" 
                ? "Please log in to access this chat." 
                : "The chat may be invalid, not found, or you might not have access."}
          </p>
          <Button onClick={() => router.push(chatTitle === "Authentication Required" ? '/auth' : '/dashboard')} className="mt-4">
            {chatTitle === "Authentication Required" ? "Go to Login" : "Go to Dashboard"}
          </Button>
        </div>
      );
  }

  // If all checks pass, render ChatInterface
  return (
     <div className="h-full max-h-[calc(100vh-57px-2rem)] md:max-h-[calc(100vh-57px-3rem)]">
      <ChatInterface
        chatTitle={chatTitle}
        chatType={chatType}
        chatId={resolvedChatId}
        isAnonymousMode={isAnonymousMode}
        currentUser={currentUser} // Can be null for AI chat, or if future chats allow anon view
      />
    </div>
  );
}
