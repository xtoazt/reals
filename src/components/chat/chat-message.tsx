
'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Smile, ThumbsUp, Heart, Link as LinkIcon, UserPlus, UserCircle as UserProfileIcon, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { auth, database } from '@/lib/firebase';
import { ref, set, get, serverTimestamp, update, remove, runTransaction } from 'firebase/database';
import type { User as FirebaseUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';


export interface Message {
  id: string;
  sender: string;
  senderUid?: string;
  senderUsername?: string;
  senderNameColor?: string;
  senderTitle?: string;
  senderIsShinyGold?: boolean;
  avatar?: string;
  content: string;
  timestamp: string; 
  originalTimestamp?: number; 
  isOwnMessage: boolean;
  reactions?: { [key: string]: number };
  imageUrl?: string;
  link?: { url: string; title?: string; description?: string; image?: string };
}

interface ChatMessageProps {
  message: Message;
  showAvatarAndSender: boolean;
  isContinuation: boolean;
}

export function ChatMessage({ message, showAvatarAndSender, isContinuation }: ChatMessageProps) {
  const { toast } = useToast();
  const router = useRouter();
  const currentUser = auth.currentUser;

  const handleAddFriendFromChat = async (targetUid: string | undefined, targetUsername: string | undefined) => {
    if (!currentUser || !currentUser.uid) {
      toast({ title: "Error", description: "You must be logged in to send friend requests.", variant: "destructive" });
      return;
    }
    if (!targetUid || !targetUsername) {
        toast({ title: "Error", description: "Cannot identify user to add.", variant: "destructive" });
        return;
    }
    if (currentUser.uid === targetUid) {
      toast({ title: "Info", description: "You cannot send a friend request to yourself." });
      return;
    }
    
    const blockedByTargetRef = ref(database, `users_blocked_by/${currentUser.uid}/${targetUid}`);
    const blockedByTargetSnap = await get(blockedByTargetRef);
    if (blockedByTargetSnap.exists()) {
      toast({ title: "Cannot Add Friend", description: `You cannot send a friend request to this user at this time.`, variant: "destructive" });
      return;
    }

    const targetBlockedByMeRef = ref(database, `blocked_users/${currentUser.uid}/${targetUid}`);
    const targetBlockedByMeSnap = await get(targetBlockedByMeRef);
    if (targetBlockedByMeSnap.exists()) {
      toast({ title: "Unblock User", description: `You have blocked @${targetUsername}. Unblock them to send a friend request.`, variant: "destructive" });
      return;
    }

    try {
      const friendCheckRef = ref(database, `friends/${currentUser.uid}/${targetUid}`);
      const friendSnapshot = await get(friendCheckRef);
      if(friendSnapshot.exists()){
        toast({ title: "Already Friends", description: `You are already friends with @${targetUsername}.`});
        return;
      }

      const sentRequestRef = ref(database, `friend_requests/${targetUid}/${currentUser.uid}`);
      const sentSnapshot = await get(sentRequestRef);
      if(sentSnapshot.exists()){
         toast({ title: "Request Already Sent", description: `You already sent a friend request to @${targetUsername}.`});
         return;
      }
      const receivedRequestRef = ref(database, `friend_requests/${currentUser.uid}/${targetUid}`);
      const receivedSnapshot = await get(receivedRequestRef);
      if(receivedSnapshot.exists()){
         toast({ title: "Check Requests", description: `@${targetUsername} has already sent you a friend request. Please check your incoming requests.`});
         return;
      }

      const currentUserProfileRef = ref(database, `users/${currentUser.uid}`);
      const currentUserProfileSnap = await get(currentUserProfileRef);
      const currentSenderUsername = currentUserProfileSnap.val()?.username;

      if (!currentSenderUsername) {
        toast({ title: "Error", description: "Could not retrieve your username to send the request. Please ensure your profile is complete.", variant: "destructive" });
        return;
      }
      
      const requestPayloadRef = ref(database, `friend_requests/${targetUid}/${currentUser.uid}`);
      await set(requestPayloadRef, {
        senderUsername: currentSenderUsername,
        senderUid: currentUser.uid,
        timestamp: serverTimestamp(),
        status: "pending"
      });
      toast({ title: "Friend Request Sent", description: `Friend request sent to @${targetUsername}.` });
    } catch (error) {
      console.error("Error sending friend request from chat:", error);
      toast({ title: "Error", description: "Could not send friend request.", variant: "destructive" });
    }
  };

  const handleBlockUserFromChat = async (targetUid: string | undefined, targetUsername: string | undefined) => {
    if (!currentUser || !currentUser.uid) {
      toast({ title: "Error", description: "You must be logged in to block users.", variant: "destructive" });
      return;
    }
    if (!targetUid || !targetUsername) {
        toast({ title: "Error", description: "Cannot identify user to block.", variant: "destructive" });
        return;
    }
    if (currentUser.uid === targetUid) {
        toast({ title: "Error", description: "You cannot block yourself.", variant: "destructive" });
        return;
    }
    
    toast({
        title: `Blocking @${targetUsername}`,
        description: "This will remove them as a friend and prevent further interaction.",
    });

    try {
        const updates: { [key: string]: any } = {};
        updates[`/blocked_users/${currentUser.uid}/${targetUid}`] = true;
        updates[`/users_blocked_by/${targetUid}/${currentUser.uid}`] = true;
        
        const areFriendsRef = ref(database, `friends/${currentUser.uid}/${targetUid}`);
        const areFriendsSnap = await get(areFriendsRef);
        const wereFriends = areFriendsSnap.exists();

        updates[`/friends/${currentUser.uid}/${targetUid}`] = null;
        updates[`/friends/${targetUid}/${currentUser.uid}`] = null;

        updates[`/friend_requests/${currentUser.uid}/${targetUid}`] = null;
        updates[`/friend_requests/${targetUid}/${currentUser.uid}`] = null;
        
        await update(ref(database), updates);

        if (wereFriends) {
            const currentUserFriendsCountRef = ref(database, `users/${currentUser.uid}/friendsCount`);
            const targetUserFriendsCountRef = ref(database, `users/${targetUid}/friendsCount`);
            await runTransaction(currentUserFriendsCountRef, (currentCount) => (currentCount || 0) - 1 < 0 ? 0 : (currentCount || 0) - 1);
            await runTransaction(targetUserFriendsCountRef, (currentCount) => (currentCount || 0) - 1 < 0 ? 0 : (currentCount || 0) - 1);
        }
        toast({ title: "User Blocked", description: `You have blocked @${targetUsername}. They have been removed from your friends list.` });
    } catch (error: any) {
        console.error("Error blocking user from chat:", error);
        toast({ title: "Error", description: `Could not block user: ${error.message}`, variant: "destructive" });
    }
  };

  const handleViewUserProfile = (username?: string) => {
    if (username && message.senderUid !== 'ai-chatbot-uid') {
        router.push(`/dashboard/profile/${username}`);
    } else if (message.senderUid === 'ai-chatbot-uid') {
        toast({ title: message.sender, description: "I'm the AI assistant for RealTalk!"});
    } else {
        toast({ title: "User Info", description: "Cannot navigate to this user's profile."});
    }
  };

  const showUserInteractionToast = () => {
    if (message.isOwnMessage || !message.senderUid || !message.senderUsername || message.senderUid === 'ai-chatbot-uid') {
        if (message.senderUid === 'ai-chatbot-uid') {
            toast({ title: message.sender, description: "I'm the AI assistant for RealTalk!"});
        }
        return;
    }
    
    toast({
      title: (
        <div className="flex items-center">
            <span className={cn(message.senderIsShinyGold ? 'text-shiny-gold' : '')} style={!message.senderIsShinyGold ? {color: message.senderNameColor || 'inherit'} : {}}>
                @{message.senderUsername}
            </span>
            {message.senderTitle && 
                <span className={cn("ml-1.5 text-xs italic", message.senderIsShinyGold ? 'text-shiny-gold' : '')} style={!message.senderIsShinyGold ? {color: message.senderNameColor || 'hsl(var(--foreground))'} : {}}>
                    {message.senderTitle}
                </span>
            }
        </div>
      ),
      description: `Display Name: ${message.sender}. What would you like to do?`,
      action: (
        <div className="flex flex-col gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => handleViewUserProfile(message.senderUsername)}>
            <UserProfileIcon className="mr-2 h-4 w-4" /> View Profile
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleAddFriendFromChat(message.senderUid, message.senderUsername)}>
            <UserPlus className="mr-2 h-4 w-4" /> Add Friend
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleBlockUserFromChat(message.senderUid, message.senderUsername)}>
            <UserX className="mr-2 h-4 w-4" /> Block User
          </Button>
        </div>
      ),
    });
  };


  const renderContent = () => {
    const parts = message.content.split(/(\s+)/); 
    return parts.map((part, index) => {
      if (part.startsWith('@') && part.length > 1) {
        const mentionedUsername = part.substring(1);
        return (
          <span key={index} className="text-accent font-semibold cursor-pointer hover:underline" onClick={() => router.push(`/dashboard/profile/${mentionedUsername}`)}>
            {part}
          </span>
        );
      }
      if (/^(https?):\/\/[^\s$.?#].[^\s]*$/.test(part)) {
        try {
            const url = new URL(part); 
            return (
              <a
                key={index}
                href={url.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center"
              >
                {part} <LinkIcon size={14} className="ml-1" />
              </a>
            );
        } catch (e) {
            return part; // if URL parsing fails, render as text
        }
      }
      return part;
    });
  };

  const fallbackAvatarText = message.sender ? message.sender.substring(0, 2).toUpperCase() : "U";
  const senderNameStyle = (!message.senderIsShinyGold && message.senderNameColor) ? { color: message.senderNameColor } : {};
  const senderTitleStyle = (!message.senderIsShinyGold && message.senderNameColor) ? { color: message.senderNameColor } : { color: 'hsl(var(--foreground))'};


  return (
    <div
      className={cn(
        'flex items-start gap-3 max-w-[85%] md:max-w-[75%] rounded-lg group', 
        isContinuation ? 'mt-[2px]' : 'my-1', 
        message.isOwnMessage
          ? 'ml-auto bg-primary/10'
          : `mr-auto border ${showAvatarAndSender ? 'bg-card shadow-sm' : 'bg-card/95'}`,
        !message.isOwnMessage && isContinuation 
          ? 'ml-[calc(2rem+0.75rem)] pr-2.5 pb-1 pt-0.5 pl-2.5' 
          : 'p-2.5',
        message.isOwnMessage && isContinuation 
          ? 'pr-2.5 pb-1 pt-0.5 pl-2.5' 
          : '',
      )}
    >
      {!message.isOwnMessage && showAvatarAndSender && (
        <Avatar className="h-8 w-8 cursor-pointer flex-shrink-0" onClick={() => handleViewUserProfile(message.senderUsername)}>
          <AvatarImage src={message.avatar || `https://placehold.co/40x40.png?text=${fallbackAvatarText}`} alt={message.sender} data-ai-hint="profile avatar" />
          <AvatarFallback>{fallbackAvatarText}</AvatarFallback>
        </Avatar>
      )}
      <div className="flex-1 min-w-0"> 
        {showAvatarAndSender && (
          <div className="flex items-center justify-between gap-2">
           <div className="flex items-baseline gap-1 flex-wrap"> 
            <p
                className={cn(
                  "text-xs font-semibold",
                  message.senderIsShinyGold ? 'text-shiny-gold' : (message.isOwnMessage ? "text-primary" : "text-foreground/80 cursor-pointer hover:underline")
                )}
                style={senderNameStyle}
                onClick={!message.isOwnMessage && message.senderUid !== 'ai-chatbot-uid' ? showUserInteractionToast : undefined}
              >
                {message.sender}
              </p>
              {message.senderTitle && (
                <p className={cn("text-xs font-medium italic flex items-center shrink-0", message.senderIsShinyGold ? 'text-shiny-gold' : '')} style={senderTitleStyle}> 
                  {message.senderTitle}
                </p>
              )}
           </div>
          <p className={cn("text-xs text-muted-foreground flex-shrink-0", message.isOwnMessage ? "ml-2" : "")}>{message.timestamp}</p>
        </div>
        )}
        <div className={cn(
            "text-sm text-foreground whitespace-pre-wrap break-words", 
            showAvatarAndSender ? "mt-1" : "mt-0" 
        )}>
          {renderContent()}
        </div>

        {isContinuation && (
          <div className="text-right opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out -mr-1">
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{message.timestamp}</p>
          </div>
        )}

        {message.imageUrl && (
          <div className="mt-2">
            <Image
              src={message.imageUrl}
              alt="Shared image"
              width={300}
              height={200}
              className="rounded-md object-cover"
              data-ai-hint="chat image"
            />
          </div>
        )}
        {message.link && (
           <a href={message.link.url} target="_blank" rel="noopener noreferrer" className="mt-2 block border rounded-lg p-3 hover:bg-muted/50 transition-colors">
            {message.link.image && <Image src={message.link.image} alt="Link preview" width={300} height={150} className="rounded-md object-cover mb-2" data-ai-hint="link preview" />}
            <h4 className="font-semibold text-sm text-primary">{message.link.title || message.link.url}</h4>
            {message.link.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{message.link.description}</p>}
          </a>
        )}
        {(message.reactions && Object.keys(message.reactions).length > 0) && (
             <div className="mt-2 flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                    <Smile size={16} />
                </Button>
                {message.reactions?.['thumbsup'] && (
                    <div className="flex items-center bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                    <ThumbsUp size={12} className="mr-1" /> {message.reactions['thumbsup']}
                    </div>
                )}
                {message.reactions?.['heart'] && (
                    <div className="flex items-center bg-destructive/20 text-destructive text-xs px-2 py-0.5 rounded-full">
                    <Heart size={12} className="mr-1" /> {message.reactions['heart']}
                    </div>
                )}
            </div>
        )}
      </div>
      {message.isOwnMessage && showAvatarAndSender && (
        <Avatar className="h-8 w-8 flex-shrink-0 cursor-pointer" onClick={() => router.push('/dashboard/profile')}>
          <AvatarImage src={message.avatar || `https://placehold.co/40x40.png?text=${fallbackAvatarText}`} alt={message.sender} data-ai-hint="profile avatar"/>
          <AvatarFallback>{fallbackAvatarText}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
