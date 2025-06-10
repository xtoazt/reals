
'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Smile, ThumbsUp, Heart, Link as LinkIcon, UserPlus, UserCircle as UserProfileIcon, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { auth, database } from '@/lib/firebase';
import { ref, set, get, serverTimestamp } from 'firebase/database';

export interface Message {
  id: string;
  sender: string; 
  senderUid?: string; 
  senderUsername?: string; 
  senderNameColor?: string; 
  senderTitle?: string; // Added sender's title
  avatar?: string;
  content: string;
  timestamp: string;
  isOwnMessage: boolean;
  reactions?: { [key: string]: number };
  imageUrl?: string;
  link?: { url: string; title?: string; description?: string; image?: string };
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { toast } = useToast(); 
  const currentUser = auth.currentUser;

  const handleAddFriendFromChat = async (targetUid: string, targetUsername: string) => {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in to send friend requests.", variant: "destructive" });
      return;
    }
    if (currentUser.uid === targetUid) {
      toast({ title: "Info", description: "You cannot send a friend request to yourself." });
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

      const requestRef = ref(database, `friend_requests/${targetUid}/${currentUser.uid}`);
      const currentUserProfileRef = ref(database, `users/${currentUser.uid}`);
      const currentUserProfileSnap = await get(currentUserProfileRef);
      const currentUserUsernameVal = currentUserProfileSnap.val()?.username || "A user";

      await set(requestRef, {
        senderUsername: currentUserUsernameVal, 
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


  const handleProfileInteraction = () => {
    if (message.isOwnMessage || !message.senderUid || !message.senderUsername) {
        toast({ title: "Your Profile", description: "This is you!"});
        return;
    }
    
    toast({
      title: (
        <div className="flex items-center">
            <span style={{color: message.senderNameColor || 'inherit'}}>@{message.senderUsername}</span>
            {message.senderTitle && <Shield size={14} className="ml-1.5 mr-0.5 text-accent" />}
            {message.senderTitle && <span className="text-xs text-accent font-normal">{message.senderTitle}</span>}
        </div>
      ),
      description: `Display Name: ${message.sender}`,
      action: (
        <div className="flex flex-col gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => toast({ title: "View Profile", description: `Navigating to @${message.senderUsername}'s profile... (mock)` })}>
            <UserProfileIcon className="mr-2 h-4 w-4" /> View Profile
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleAddFriendFromChat(message.senderUid!, message.senderUsername!)}>
            <UserPlus className="mr-2 h-4 w-4" /> Add Friend
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
          <span key={index} className="text-accent font-semibold cursor-pointer hover:underline" onClick={() => toast({title: "Mention Clicked", description: `Viewing @${mentionedUsername}'s profile (mock)`})}>
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
            return part; 
        }
      }
      return part;
    });
  };

  const fallbackAvatarText = message.sender ? message.sender.substring(0, 2).toUpperCase() : "U";
  const senderStyle = message.senderNameColor ? { color: message.senderNameColor } : {};

  return (
    <div
      className={cn(
        'flex items-start gap-3 my-2 p-2.5 rounded-lg max-w-[80%] md:max-w-[70%]',
        message.isOwnMessage ? 'ml-auto bg-primary/10' : 'mr-auto bg-card shadow-sm border'
      )}
    >
      {!message.isOwnMessage && (
        <Avatar className="h-8 w-8 cursor-pointer" onClick={handleProfileInteraction}>
          <AvatarImage src={message.avatar || `https://placehold.co/40x40.png?text=${fallbackAvatarText}`} alt={message.sender} data-ai-hint="profile avatar" />
          <AvatarFallback>{fallbackAvatarText}</AvatarFallback>
        </Avatar>
      )}
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
           <div className="flex items-baseline gap-1">
            <p 
                className={cn(
                  "text-xs font-semibold",
                  message.isOwnMessage ? "text-primary" : "text-foreground/80 cursor-pointer hover:underline"
                )}
                style={senderStyle}
                onClick={!message.isOwnMessage ? handleProfileInteraction : undefined}
              >
                {message.sender}
              </p>
              {!message.isOwnMessage && message.senderUsername && <p className="text-xs text-muted-foreground font-normal">(@{message.senderUsername})</p>}
              {message.senderTitle && (
                <p className="text-xs text-accent font-medium flex items-center">
                  <Shield size={12} className="mr-0.5"/>{message.senderTitle}
                </p>
              )}
           </div>
          <p className={cn("text-xs text-muted-foreground flex-shrink-0", message.isOwnMessage ? "ml-2" : "")}>{message.timestamp}</p>
        </div>
        <div className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
          {renderContent()}
        </div>
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
      {message.isOwnMessage && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.avatar || `https://placehold.co/40x40.png?text=${fallbackAvatarText}`} alt={message.sender} data-ai-hint="profile avatar"/>
          <AvatarFallback>{fallbackAvatarText}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
