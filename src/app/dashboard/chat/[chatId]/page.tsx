
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
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null | undefined>(undefined); // undefined: auth state unknown
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
      setCurrentUser(user); // user can be FirebaseUser or null
    });
    return () => unsubscribe();
  }, []); // Runs once on mount

  useEffect(() => {
    setIsLoading(true); // Default to loading when resolvedChatId or currentUser changes

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

      if (currentUser === undefined) {
        // Auth state not yet resolved, isLoading remains true.
        // It's implicitly handled as loading because isLoading was set to true at the start of effect.
        setChatTitle('Loading chat...'); // Placeholder title
        return;
      }

      if (currentUser === null) {
        // All current chat types require auth per rules.
        titleToSet = "Authentication Required";
        typeToSet = determinedInitialType; // Keep the determined type for context
        anonymousModeToSet = false;
        // setIsLoading(false) will be called at the end of this async function
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
                titleToSet = 'Chat with User';
              }
            } catch (error) {
              console.error("Error fetching DM user profile:", error);
              titleToSet = 'Chat with User';
            }
          } else {
            titleToSet = "Invalid DM";
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
                titleToSet = "Access Denied to GC";
              }
            } else {
              titleToSet = "Group Chat Not Found";
            }
          } catch (error) {
            console.error("Error fetching GC details:", error);
            titleToSet = "Error Loading GC";
          }
        } else {
          titleToSet = "Invalid Chat";
        }
      }

      setChatTitle(titleToSet);
      setChatType(typeToSet);
      setIsAnonymousMode(anonymousModeToSet);
      setIsLoading(false);
    };

    performChatSetup();

  }, [resolvedChatId, currentUser]);


  if (isLoading || currentUser === undefined) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }

  // After loading and auth resolution, check if chat is valid or requires auth
  if (chatTitle === "Authentication Required" || chatTitle === "Invalid DM" || chatTitle === "Access Denied to GC" || chatTitle === "Group Chat Not Found" || chatTitle === "Error Loading GC" || chatTitle === "Invalid Chat") {
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
        currentUser={currentUser} // currentUser can be null here if chat allows anonymous view (none currently do)
      />
    </div>
  );
}
