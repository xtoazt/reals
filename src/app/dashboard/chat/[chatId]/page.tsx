
'use client';

import { ChatInterface } from '@/components/chat/chat-interface';
import { notFound, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react'; 
import { auth, database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Added Button import

interface ResolvedParams { 
  chatId: string;
}

interface ChatPageProps { 
  params: Promise<ResolvedParams>; 
}

interface UserProfileData {
  displayName: string;
}

interface GCChatData { // For GC specific data from chats/{chatId}
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
  const [chatType, setChatType] = useState<'global' | 'gc' | 'dm' | 'ai'>('global'); // Changed 'party' to 'gc'
  const [resolvedChatId, setResolvedChatId] = useState(unwrappedChatId);

  useEffect(() => {
    setResolvedChatId(unwrappedChatId);
  }, [unwrappedChatId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    setIsLoading(true);
    let determinedTitle = '';
    let determinedType: 'global' | 'gc' | 'dm' | 'ai' = 'global'; // Changed 'party' to 'gc'

    const setupChat = async () => {
      if (resolvedChatId === 'global') {
        determinedTitle = 'Global Chat';
        determinedType = 'global';
      } else if (resolvedChatId === 'ai-chatbot') {
        determinedTitle = 'AI Chatbot';
        determinedType = 'ai';
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
        } else if (!currentUser) {
          setChatTitle('Loading DM...');
          setIsLoading(true); 
          return; 
        } else {
            determinedTitle = 'Direct Message';
        }
      } else if (resolvedChatId && resolvedChatId.startsWith('gc-')) { // Check for 'gc-' prefix
        determinedType = 'gc';
        try {
            const gcRef = ref(database, `chats/${resolvedChatId}`);
            const gcSnapshot = await get(gcRef);
            if (gcSnapshot.exists()) {
                const gcData = gcSnapshot.val() as GCChatData;
                determinedTitle = gcData.gcName || `Group Chat: ${resolvedChatId.substring(3, 15)}...`; // Use gcName or fallback
                 // Optional: Check if current user is a member
                if (currentUser && gcData.members && !gcData.members[currentUser.uid]) {
                    console.warn("Current user is not a member of this GC:", resolvedChatId);
                    determinedTitle = "Access Denied to GC"; // Or some other appropriate message
                }
            } else {
                determinedTitle = "Group Chat Not Found";
                console.warn(`GC data not found for chatId: ${resolvedChatId}`);
            }
        } catch (error) {
            console.error("Error fetching GC details:", error);
            determinedTitle = "Error Loading GC";
        }
      } else {
        determinedTitle = "Invalid Chat";
        setIsLoading(false);
        return;
      }
      
      setChatTitle(determinedTitle);
      setChatType(determinedType);
      setIsLoading(false);
    };

    setupChat();

  }, [resolvedChatId, currentUser]); 

  if (isLoading && !chatTitle) { 
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading chat...</p>
      </div>
    );
  }
  
  if (!isLoading && (!chatTitle || chatTitle === "Invalid DM" || chatTitle === "Access Denied to GC" || chatTitle === "Group Chat Not Found" || chatTitle === "Error Loading GC" || chatTitle === "Invalid Chat")) { 
      return (
        <div className="flex flex-col justify-center items-center h-full text-center p-4">
          <p className="text-lg font-semibold">Could not load chat information.</p>
          <p className="text-muted-foreground">The chat may be invalid, not found, or you might not have access.</p>
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

