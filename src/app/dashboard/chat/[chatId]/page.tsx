
'use client';

import { ChatInterface } from '@/components/chat/chat-interface';
import { notFound, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth, database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

interface ChatPageParams {
  params: {
    chatId: string;
  };
}

interface UserProfileData {
  displayName: string;
}

export default function ChatPage({ params }: ChatPageParams) {
  const { chatId } = params;
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatTitle, setChatTitle] = useState('');
  const [chatType, setChatType] = useState<'global' | 'party' | 'dm' | 'ai'>('global');
  const [resolvedChatId, setResolvedChatId] = useState(chatId);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user && chatId !== 'ai-chatbot' && chatId !== 'global') { // AI and global can be viewed logged out for now
        // router.push('/auth'); // Consider if you want to redirect immediately
      }
    });
    return () => unsubscribe();
  }, [router, chatId]);

  useEffect(() => {
    setIsLoading(true);
    let determinedTitle = '';
    let determinedType: 'global' | 'party' | 'dm' | 'ai' = 'global';
    let determinedResolvedChatId = chatId;

    const setupChat = async () => {
      if (chatId === 'global') {
        determinedTitle = 'Global Chat';
        determinedType = 'global';
      } else if (chatId === 'ai-chatbot') {
        determinedTitle = 'AI Chatbot';
        determinedType = 'ai';
      } else if (chatId.startsWith('dm_')) {
        determinedType = 'dm';
        if (currentUser) {
          const uids = chatId.substring(3).split('_');
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
            determinedTitle = 'Direct Message'; // Should not happen if UIDs are correct
             // Potentially redirect or show error if otherUserId is not found and current user is one of them
            if (!uids.includes(currentUser.uid)) {
                console.error("Current user not part of this DM channel based on chatId");
                // notFound(); // or redirect
                determinedTitle = "Invalid DM";
            }
          }
        } else {
          determinedTitle = 'Direct Message'; // User not loaded yet
        }
        determinedResolvedChatId = chatId;
      } else {
        // For dynamic party chats
        determinedTitle = `Party: ${chatId}`;
        determinedType = 'party';
        determinedResolvedChatId = chatId;
      }
      
      setChatTitle(determinedTitle);
      setChatType(determinedType);
      setResolvedChatId(determinedResolvedChatId);
      setIsLoading(false);
    };

    // If it's a DM, we need currentUser to determine the other party.
    // If currentUser is not yet available but it's a DM, wait.
    if (chatId.startsWith('dm_') && !currentUser) {
        // Still loading current user, can't determine DM partner yet
        // Let the auth listener trigger a re-run of this effect
        // Set a temp loading title
        setChatTitle('Loading DM...');
        // setIsLoading is already true
    } else {
       setupChat();
    }

  }, [chatId, currentUser]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }
  
  if (!chatTitle) {
      // Handles cases where title couldn't be determined or user is not authorized
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
