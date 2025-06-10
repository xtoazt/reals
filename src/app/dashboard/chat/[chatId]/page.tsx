
'use client';

import { ChatInterface } from '@/components/chat/chat-interface';
import { notFound, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react'; // Changed to import React for React.use
import { auth, database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

interface ResolvedParams { // Shape of params after unwrapping
  chatId: string;
}

interface ChatPageProps { // Props for the component
  params: Promise<ResolvedParams>; // params prop is a Promise
}

interface UserProfileData {
  displayName: string;
}

export default function ChatPage({ params: paramsPromise }: ChatPageProps) {
  // Unwap the params Promise using React.use()
  const params = React.use(paramsPromise);
  const { chatId } = params; // Now params is { chatId: string }

  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatTitle, setChatTitle] = useState('');
  const [chatType, setChatType] = useState<'global' | 'party' | 'dm' | 'ai'>('global');
  const [resolvedChatId, setResolvedChatId] = useState(chatId); // Initialize with unwrapped chatId

  // Effect to update resolvedChatId if chatId from params changes.
  useEffect(() => {
    setResolvedChatId(chatId);
  }, [chatId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user && resolvedChatId !== 'ai-chatbot' && resolvedChatId !== 'global') {
        // router.push('/auth'); 
      }
    });
    return () => unsubscribe();
  }, [router, resolvedChatId]);

  useEffect(() => {
    setIsLoading(true);
    let determinedTitle = '';
    let determinedType: 'global' | 'party' | 'dm' | 'ai' = 'global';
    // Use resolvedChatId (state) for consistency within this effect
    let determinedResolvedChatId = resolvedChatId; 

    const setupChat = async () => {
      if (resolvedChatId === 'global') {
        determinedTitle = 'Global Chat';
        determinedType = 'global';
      } else if (resolvedChatId === 'ai-chatbot') {
        determinedTitle = 'AI Chatbot';
        determinedType = 'ai';
      } else if (resolvedChatId && resolvedChatId.includes('dm_')) { // Check resolvedChatId for safety
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
                determinedTitle = 'Chat with User'; // Fallback
              }
            } catch (error) {
              console.error("Error fetching DM user profile:", error);
              determinedTitle = 'Chat with User'; // Fallback on error
            }
          } else {
            determinedTitle = 'Direct Message'; 
            if (currentUser.uid && !uids.includes(currentUser.uid)) {
                console.error("Current user not part of this DM channel based on chatId");
                determinedTitle = "Invalid DM";
            }
          }
        } else {
          determinedTitle = 'Direct Message'; // User not loaded yet
        }
        determinedResolvedChatId = resolvedChatId;
      } else if (resolvedChatId) { // For dynamic party chats
        determinedTitle = `Party: ${resolvedChatId}`;
        determinedType = 'party';
        determinedResolvedChatId = resolvedChatId;
      } else {
        // Fallback or error if resolvedChatId is undefined/empty
        determinedTitle = "Invalid Chat";
        setIsLoading(false);
        return;
      }
      
      setChatTitle(determinedTitle);
      setChatType(determinedType);
      setIsLoading(false);
    };

    // If it's a DM and currentUser is not yet available, wait.
    if (resolvedChatId && resolvedChatId.includes('dm_') && !currentUser) {
        setChatTitle('Loading DM...');
    } else {
       setupChat();
    }

  }, [resolvedChatId, currentUser]); // Depend on resolvedChatId state

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }
  
  if (!chatTitle) {
      return (
        <div className="flex justify-center items-center h-full">
          <p>Could not load chat information or access denied.</p>
        </div>
      );
  }

  return (
     <div className="h-full max-h-[calc(100vh-57px-2rem)] md:max-h-[calc(100vh-57px-3rem)]">
      <ChatInterface chatTitle={chatTitle} chatType={chatType} chatId={resolvedChatId} />
    </div>
  );
}
