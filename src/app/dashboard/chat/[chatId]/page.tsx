
'use client';

import { ChatInterface } from '@/components/chat/chat-interface';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import { auth, database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserProfileData as SharedUserProfileData } from '@/components/chat/chat-interface';

interface ResolvedParams {
  chatId: string;
}

interface ChatPageProps {
  params: Promise<ResolvedParams>;
}

interface GCChatData {
    gcName: string;
    members?: { [uid: string]: boolean };
}

async function fetchPageLevelUserProfile(uid: string): Promise<SharedUserProfileData | null> {
  if (!uid) return null;
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
    console.error(`Error fetching page level user profile for ${uid}:`, error);
    return null;
  }
}


export default function ChatPage({ params: paramsPromise }: ChatPageProps) {
  const params = React.use(paramsPromise);
  const unwrappedChatId = params.chatId;

  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [pageLevelCurrentUserProfile, setPageLevelCurrentUserProfile] = useState<SharedUserProfileData | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [chatTitle, setChatTitle] = useState('');
  const [chatType, setChatType] = useState<'global' | 'gc' | 'dm' | 'ai'>('global');
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);
  const [resolvedChatId, setResolvedChatId] = useState(unwrappedChatId);
  const [canAccessChat, setCanAccessChat] = useState(false);

  useEffect(() => {
    setResolvedChatId(unwrappedChatId);
  }, [unwrappedChatId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsLoading(true); // Set loading true while fetching profile
        const profile = await fetchPageLevelUserProfile(user.uid);
        setPageLevelCurrentUserProfile(profile);
        // setIsLoading(false); // Loading will be handled by the main effect
      } else {
        setPageLevelCurrentUserProfile(null);
      }
      setAuthResolved(true); // Auth is resolved regardless of profile fetch outcome here
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const performChatSetup = async () => {
      if (!authResolved) {
        setIsLoading(true);
        return;
      }

      // If user is logged in but profile hasn't been fetched yet for non-AI chats, wait.
      if (currentUser && determinedInitialType !== 'ai' && !pageLevelCurrentUserProfile) {
        setIsLoading(true); // Keep loading until profile is available
        return;
      }
      
      setIsLoading(true); // Start loading for this setup pass

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

      if (currentUser === null) { 
        if (determinedInitialType === 'ai') {
            titleToSet = 'AI Chatbot';
            typeToSet = 'ai';
            finalCanAccess = true;
        } else {
            titleToSet = "Authentication Required";
            typeToSet = determinedInitialType;
            finalCanAccess = false;
        }
      } else if (currentUser && (determinedInitialType === 'ai' || pageLevelCurrentUserProfile)) { 
        // For non-AI chats, proceed only if profile is loaded
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
          finalCanAccess = true;
        } else if (determinedInitialType === 'dm') {
          typeToSet = 'dm';
          const uids = resolvedChatId.substring(3).split('_');
          const otherUserId = uids.find(uid => uid !== currentUser.uid);
          if (otherUserId) {
            try {
              // Fetch other user's display name for title
              const userRef = ref(database, `users/${otherUserId}`);
              const snapshot = await get(userRef);
              if (snapshot.exists()) {
                const userData = snapshot.val() as {displayName:string};
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
      } else if (currentUser && determinedInitialType !== 'ai' && !pageLevelCurrentUserProfile) {
        // This case is where auth is resolved, user exists, but profile isn't loaded yet for a non-AI chat.
        // We are already setting setIsLoading(true) above, so we just wait.
        // No need to set finalCanAccess to false here yet, as profile might load.
      }


      setChatTitle(titleToSet);
      setChatType(typeToSet);
      setIsAnonymousMode(anonymousModeToSet);
      setCanAccessChat(finalCanAccess);
      setIsLoading(false); // All decisions for *this pass* are made.
    };

    performChatSetup();

  }, [resolvedChatId, currentUser, authResolved, router, pageLevelCurrentUserProfile]);


  // Primary loading state: waits for auth, profile (if needed), and chat setup.
  if (isLoading || !authResolved || (currentUser && chatType !== 'ai' && !pageLevelCurrentUserProfile)) {
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

  // Stricter guard for non-AI chats: Ensure currentUser (auth object) and pageLevelCurrentUserProfile are valid.
  if (chatType !== 'ai' && (!currentUser || !pageLevelCurrentUserProfile)) {
    return (
      <div className="flex flex-col justify-center items-center h-full text-center p-4">
        <p className="text-lg font-semibold">Authentication or Profile Error</p>
        <p className="text-muted-foreground">Please log in and ensure your profile is fully loaded to access this chat.</p>
        <Button onClick={() => router.push('/auth')} className="mt-4">
          Go to Login
        </Button>
      </div>
    );
  }

  return (
     <div className="h-full max-h-[calc(100vh-57px-2rem)] md:max-h-[calc(100vh-57px-3rem)]">
      <ChatInterface
        key={`${resolvedChatId}-${currentUser?.uid || 'loggedout'}`}
        chatTitle={chatTitle}
        chatType={chatType}
        chatId={resolvedChatId}
        isAnonymousMode={isAnonymousMode}
        currentUser={currentUser} 
        loggedInUserProfile={pageLevelCurrentUserProfile} 
        authResolved={authResolved}
      />
    </div>
  );
}

    