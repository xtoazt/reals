
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
  // Add other fields if needed, e.g., avatar for chat header
}

export default function ChatPage({ params: paramsPromise }: ChatPageProps) {
  // Unwap the params Promise using React.use()
  const params = React.use(paramsPromise);
  const unwrappedChatId = params.chatId; 

  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatTitle, setChatTitle] = useState('');
  const [chatType, setChatType] = useState<'global' | 'party' | 'dm' | 'ai'>('global');
  // Use a state for chatId that is initialized by the unwrapped param
  // This helps manage its lifecycle consistently within the component's effects.
  const [resolvedChatId, setResolvedChatId] = useState(unwrappedChatId);

  // Effect to update resolvedChatId if unwrappedChatId from params changes.
  // This could happen if the user navigates between chat pages.
  useEffect(() => {
    setResolvedChatId(unwrappedChatId);
  }, [unwrappedChatId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      // Removed authentication check for global/ai-chatbot, as it might be desired for logged-out users too
    });
    return () => unsubscribe();
  }, [router]); // Removed resolvedChatId from deps as auth state is general

  useEffect(() => {
    // This effect now primarily depends on resolvedChatId and currentUser
    // to determine the chat context.
    setIsLoading(true);
    let determinedTitle = '';
    let determinedType: 'global' | 'party' | 'dm' | 'ai' = 'global';

    const setupChat = async () => {
      if (resolvedChatId === 'global') {
        determinedTitle = 'Global Chat';
        determinedType = 'global';
      } else if (resolvedChatId === 'ai-chatbot') {
        determinedTitle = 'AI Chatbot';
        determinedType = 'ai';
      } else if (resolvedChatId && resolvedChatId.startsWith('dm_')) {
        determinedType = 'dm';
        if (currentUser && currentUser.uid) { // Ensure currentUser is available for DM logic
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
                console.warn(`User profile not found for DM partner: ${otherUserId}`);
              }
            } catch (error) {
              console.error("Error fetching DM user profile:", error);
              determinedTitle = 'Chat with User'; // Fallback on error
            }
          } else {
            // This case might indicate an invalid DM chatId or the current user is not part of it.
            determinedTitle = 'Direct Message'; 
            if (currentUser.uid && !uids.includes(currentUser.uid)) {
                console.error("Current user not part of this DM channel based on chatId:", resolvedChatId);
                determinedTitle = "Invalid DM";
            } else if (!otherUserId) {
                console.error("Could not determine other user in DM:", resolvedChatId);
                determinedTitle = "Invalid DM";
            }
          }
        } else if (!currentUser) {
           // If it's a DM and currentUser is not yet loaded, show loading.
           // This state will be resolved when currentUser becomes available.
          setChatTitle('Loading DM...');
          setIsLoading(true); // Explicitly keep loading
          return; // Exit early, setupChat will re-run when currentUser is set
        } else {
            // Should not happen if currentUser.uid is required above, but as a fallback
            determinedTitle = 'Direct Message';
        }
      } else if (resolvedChatId) { // For dynamic party chats (e.g., "party-someid")
        determinedTitle = `Party: ${resolvedChatId}`; // Basic title for now
        determinedType = 'party';
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

    setupChat();

  }, [resolvedChatId, currentUser]); // Key dependencies for setting up the chat

  if (isLoading && !chatTitle) { // More robust loading check
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }
  
  if (!isLoading && (!chatTitle || chatTitle === "Invalid DM")) { // Handle invalid DM state
      return (
        <div className="flex flex-col justify-center items-center h-full text-center">
          <p className="text-lg font-semibold">Could not load chat information.</p>
          <p className="text-muted-foreground">The chat may be invalid or you might not have access.</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-4">Go to Dashboard</Button>
        </div>
      );
  }

  return (
     <div className="h-full max-h-[calc(100vh-57px-2rem)] md:max-h-[calc(100vh-57px-3rem)]">
      <ChatInterface chatTitle={chatTitle} chatType={chatType} chatId={resolvedChatId} />
    </div>
  );
}
