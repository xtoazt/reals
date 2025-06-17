
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
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null | undefined>(undefined); // undefined means not yet known
  const [authResolved, setAuthResolved] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start true
  const [chatTitle, setChatTitle] = useState('');
  const [chatType, setChatType] = useState<'global' | 'gc' | 'dm' | 'ai'>('global');
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);
  const [resolvedChatId, setResolvedChatId] = useState(unwrappedChatId);
  const [canAccessChat, setCanAccessChat] = useState(false);

  useEffect(() => {
    setResolvedChatId(unwrappedChatId);
  }, [unwrappedChatId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user); // user can be null if not logged in
      setAuthResolved(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const performChatSetup = async () => {
      if (!authResolved) {
        setIsLoading(true); // Still waiting for auth to resolve
        return;
      }

      setIsLoading(true); // Auth is resolved, now determining chat access

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

      // Case 1: Auth resolved, but no user logged in (currentUser is null)
      if (currentUser === null) {
        if (determinedInitialType === 'ai') {
            titleToSet = 'AI Chatbot';
            typeToSet = 'ai';
            finalCanAccess = true; // AI chat accessible when logged out
        } else {
            // All other chat types require login
            titleToSet = "Authentication Required";
            typeToSet = determinedInitialType; // Keep original type for message
            finalCanAccess = false;
        }
      }
      // Case 2: Auth resolved, and user is logged in (currentUser is a FirebaseUser object)
      else if (currentUser) {
        if (determinedInitialType === 'global') {
          titleToSet =
            resolvedChatId === 'global' ? 'Global Chat' :
            resolvedChatId === 'global-unblocked' ? 'Unblocked Chat' :
            resolvedChatId === 'global-school' ? 'School Chat' :
            resolvedChatId === 'global-anonymous' ? 'Anonymous Chat' :
            resolvedChatId === 'global-support' ? 'Support Chat' : 'Chat';
          typeToSet = 'global';
          anonymousModeToSet = resolvedChatId === 'global-anonymous';
          finalCanAccess = true;
        } else if (determinedInitialType === 'ai') {
          titleToSet = 'AI Chatbot';
          typeToSet = 'ai';
          finalCanAccess = true; // AI chat accessible when logged in
        } else if (determinedInitialType === 'dm') {
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
                finalCanAccess = true;
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
        } else if (determinedInitialType === 'gc') {
          typeToSet = 'gc';
          try {
            const gcRef = ref(database, `chats/${resolvedChatId}`);
            const gcSnapshot = await get(gcRef);
            if (gcSnapshot.exists()) {
              const gcData = gcSnapshot.val() as GCChatData;
              titleToSet = gcData.gcName || `Group Chat: ${resolvedChatId.substring(3, 15)}...`;
              if (gcData.members && gcData.members[currentUser.uid]) {
                finalCanAccess = true;
              } else {
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
      // Case 3: Auth resolved, but currentUser is still undefined (should be rare if onAuthStateChanged is working)
      // This will fall through, and finalCanAccess will remain false unless it's an AI chat.

      setChatTitle(titleToSet);
      setChatType(typeToSet);
      setIsAnonymousMode(anonymousModeToSet);
      setCanAccessChat(finalCanAccess);
      setIsLoading(false); // All decisions made, stop loading for this run
    };

    performChatSetup();

  }, [resolvedChatId, currentUser, authResolved, router]);


  // Primary loading state: wait for auth to resolve AND chat setup to complete
  if (isLoading || !authResolved) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }

  // After loading, check if access is granted
  if (!canAccessChat) {
      const isAuthIssue = chatTitle === "Authentication Required";
      return (
        <div className="flex flex-col justify-center items-center h-full text-center p-4">
          <p className="text-lg font-semibold">{chatTitle || "Could not load chat."}</p>
          <p className="text-muted-foreground">
            {isAuthIssue
                ? "Please log in to access this chat."
                : "The chat may be invalid, not found, or you might not have access."}
          </p>
          <Button onClick={() => router.push(isAuthIssue ? '/auth' : '/dashboard')} className="mt-4">
            {isAuthIssue ? "Go to Login" : "Go to Dashboard"}
          </Button>
        </div>
      );
  }

  // Stricter guard for non-AI chats: Ensure currentUser is a valid User object.
  // This check is after `canAccessChat` is true, so it's a final sanity check.
  if (chatType !== 'ai' && !currentUser) {
    // This case should ideally be caught by `canAccessChat` logic if currentUser is null.
    // However, it's a safeguard if `canAccessChat` was somehow true but `currentUser` is not a user object.
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

  // If we reach here, user can access the chat and, if it's not AI chat, currentUser is valid.
  return (
     <div className="h-full max-h-[calc(100vh-57px-2rem)] md:max-h-[calc(100vh-57px-3rem)]">
      <ChatInterface
        key={`${resolvedChatId}-${currentUser?.uid || 'loggedout'}`} // Key ensures remount on user/chat change
        chatTitle={chatTitle}
        chatType={chatType}
        chatId={resolvedChatId}
        isAnonymousMode={isAnonymousMode}
        currentUser={currentUser} // Pass currentUser (can be null for AI chat, or User object for others)
        authResolved={authResolved} // Pass authResolved for ChatInterface to know auth state
      />
    </div>
  );
}
