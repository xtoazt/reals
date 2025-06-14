
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
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null | undefined>(undefined); // undefined means auth state not yet known
  const [authResolved, setAuthResolved] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // General loading for chat data
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
      setAuthResolved(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authResolved || !resolvedChatId) {
      setIsLoading(true); // Keep loading if auth state is not yet resolved or chatId is not resolved
      return;
    }

    const performChatSetup = async () => {
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
      
      let titleToSet = '';
      let typeToSet = determinedInitialType;
      let anonymousModeToSet = false;

      // currentUser is now guaranteed to be either a User object or null, because authResolved is true.
      if (currentUser === null) {
        if (determinedInitialType !== 'ai') { // Non-AI chats require auth
            titleToSet = "Authentication Required";
        } else {
            titleToSet = 'AI Chatbot'; // AI chat can proceed even if logged out
            typeToSet = 'ai';
        }
      } else { // CurrentUser is a valid FirebaseUser object
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
                titleToSet = 'Chat with User (Not Found)';
              }
            } catch (error) {
              console.error("Error fetching DM user profile:", error);
              titleToSet = 'Error Loading DM';
            }
          } else {
            titleToSet = "Invalid DM Chat";
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
                titleToSet = "Access Denied to Group Chat";
              }
            } else {
              titleToSet = "Group Chat Not Found";
            }
          } catch (error) {
            console.error("Error fetching GC details:", error);
            titleToSet = "Error Loading Group Chat";
          }
        } else {
          titleToSet = "Invalid Chat ID";
        }
      }

      setChatTitle(titleToSet);
      setChatType(typeToSet);
      setIsAnonymousMode(anonymousModeToSet);
      setIsLoading(false); // Chat setup attempt (success or error state) is complete
    };

    performChatSetup();

  }, [resolvedChatId, currentUser, authResolved]); // Depend on authResolved


  if (!authResolved || isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }

  // At this point, auth is resolved, and initial chat data loading attempt is complete.
  // currentUser is either a User object or null.

  const chatNeedsAuthToView = chatType !== 'ai';
  if (chatNeedsAuthToView && currentUser === null) {
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
  
  const errorTitles = [
    "Authentication Required", 
    "Invalid DM Chat", "Chat with User (Not Found)", "Error Loading DM",
    "Access Denied to Group Chat", "Group Chat Not Found", "Error Loading Group Chat",
    "Invalid Chat ID"
  ];

  if (errorTitles.includes(chatTitle) && !(chatType === 'ai' && chatTitle === 'Authentication Required')) {
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
        currentUser={currentUser}
        authResolved={authResolved} // Pass authResolved down
      />
    </div>
  );
}
