
'use client';

import { ChatInterface } from '@/components/chat/chat-interface';
import { useRouter } from 'next/navigation'; // Keep next/navigation for router
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
  const [authResolved, setAuthResolved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [chatTitle, setChatTitle] = useState('');
  const [chatType, setChatType] = useState<'global' | 'gc' | 'dm' | 'ai'>('global');
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);
  const [resolvedChatId, setResolvedChatId] = useState(unwrappedChatId);
  const [canAccessChat, setCanAccessChat] = useState(false); // New state

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
    const performChatSetup = async () => {
      setIsLoading(true);
      setCanAccessChat(false); // Reset access before evaluation

      if (!authResolved) {
        // Auth state not yet known, isLoading remains true, canAccessChat remains false
        return;
      }

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
      let finalCanAccess = false;

      if (currentUser === null) { // User is definitively logged out
        if (determinedInitialType === 'ai') {
            titleToSet = 'AI Chatbot';
            typeToSet = 'ai';
            finalCanAccess = true; // AI chat can be accessed when logged out
        } else { // All other chats require auth
            titleToSet = "Authentication Required";
            typeToSet = determinedInitialType;
            finalCanAccess = false;
        }
      } else { // CurrentUser is a valid FirebaseUser object (logged in)
        finalCanAccess = true; // Assume access, will be overridden by specific checks below if needed
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
                finalCanAccess = false;
              }
            } catch (error) {
              console.error("Error fetching DM user profile:", error);
              titleToSet = 'Error Loading DM';
              finalCanAccess = false;
            }
          } else {
            titleToSet = "Invalid DM Chat";
            finalCanAccess = false;
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
                finalCanAccess = false;
              }
            } else {
              titleToSet = "Group Chat Not Found";
              finalCanAccess = false;
            }
          } catch (error) {
            console.error("Error fetching GC details:", error);
            titleToSet = "Error Loading Group Chat";
            finalCanAccess = false;
          }
        } else {
          titleToSet = "Invalid Chat ID";
          finalCanAccess = false;
        }
      }

      setChatTitle(titleToSet);
      setChatType(typeToSet);
      setIsAnonymousMode(anonymousModeToSet);
      setCanAccessChat(finalCanAccess);
      setIsLoading(false);
    };

    performChatSetup();

  }, [resolvedChatId, currentUser, authResolved]);


  if (isLoading) { // Covers initial auth check and subsequent chat data loading
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }

  // After isLoading is false, we can check canAccessChat
  if (!canAccessChat) {
      // Determine appropriate message based on chatTitle (which would have been set by performChatSetup)
      const isAuthIssue = chatTitle === "Authentication Required";
      return (
        <div className="flex flex-col justify-center items-center h-full text-center p-4">
          <p className="text-lg font-semibold">{isAuthIssue ? "Authentication Required" : "Could not load chat."}</p>
          <p className="text-muted-foreground">
            {isAuthIssue 
                ? "Please log in to access this chat." 
                : chatTitle || "The chat may be invalid, not found, or you might not have access."}
          </p>
          <Button onClick={() => router.push(isAuthIssue ? '/auth' : '/dashboard')} className="mt-4">
            {isAuthIssue ? "Go to Login" : "Go to Dashboard"}
          </Button>
        </div>
      );
  }

  // If isLoading is false AND canAccessChat is true, render ChatInterface
  return (
     <div className="h-full max-h-[calc(100vh-57px-2rem)] md:max-h-[calc(100vh-57px-3rem)]">
      <ChatInterface
        chatTitle={chatTitle}
        chatType={chatType}
        chatId={resolvedChatId}
        isAnonymousMode={isAnonymousMode}
        currentUser={currentUser} // currentUser will be non-null here if chat is not 'ai'
      />
    </div>
  );
}
