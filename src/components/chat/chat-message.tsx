
'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus, ThumbsUp, Heart, Link as LinkIcon, UserPlus, UserCircle as UserProfileIcon, UserX, ShieldCheck, Check, CheckCheck, VenetianMask } from 'lucide-react'; // Added VenetianMask
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { auth, database } from '@/lib/firebase';
import { ref, set, get, serverTimestamp, update, remove, runTransaction, increment } from 'firebase/database';
import type { User as FirebaseUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export interface ReactionDetail {
  count: number;
  users: { [uid: string]: boolean };
}
export interface Reactions {
  thumbsUp?: ReactionDetail;
  heart?: ReactionDetail;
}

export interface Message {
  id: string;
  sender: string;
  senderUid?: string;
  senderUsername?: string;
  senderNameColor?: string;
  senderTitle?: string;
  senderIsShinyGold?: boolean;
  senderIsShinySilver?: boolean;
  senderIsAdmin?: boolean; 
  avatar?: string;
  content: string;
  timestamp: string;
  originalTimestamp?: number;
  isOwnMessage: boolean;
  reactions?: Reactions;
  imageUrl?: string;
  link?: { url: string; title?: string; description?: string; image?: string };
  chatType?: 'global' | 'gc' | 'dm' | 'ai';
  readByRecipientTimestamp?: number;
}

interface ChatMessageProps {
  message: Message;
  showAvatarAndSender: boolean;
  isContinuation: boolean;
  onToggleReaction: (messageId: string, reactionType: keyof Reactions, chatType: Message['chatType'], chatId: string) => void;
  chatId: string;
  isAnonymousContext?: boolean; // Added prop
}

const availableReactions: Array<{ type: keyof Reactions; icon: React.ElementType }> = [
  { type: 'thumbsUp', icon: ThumbsUp },
  { type: 'heart', icon: Heart },
];

export function ChatMessage({ message: propMessage, showAvatarAndSender, isContinuation, onToggleReaction, chatId, isAnonymousContext = false }: ChatMessageProps) {
  const { toast } = useToast();
  const router = useRouter();
  const currentUser = auth.currentUser;
  const [isReactionPopoverOpen, setIsReactionPopoverOpen] = useState(false);

  // Apply anonymous transformations
  const message = React.useMemo(() => {
    if (isAnonymousContext && !propMessage.isOwnMessage && propMessage.senderUid !== 'system' && propMessage.senderUid !== 'ai-chatbot-uid') {
      return {
        ...propMessage,
        sender: "Anonymous",
        senderUsername: "anonymous",
        avatar: `https://placehold.co/40x40.png?text=??`, // Generic avatar
        senderNameColor: undefined,
        senderTitle: undefined,
        senderIsShinyGold: false,
        senderIsShinySilver: false,
        senderIsAdmin: false,
      };
    }
    return propMessage;
  }, [propMessage, isAnonymousContext]);


  const handleAddFriendFromChat = async (targetUid: string | undefined, targetUsername: string | undefined) => {
    if (isAnonymousContext) {
        toast({ title: "Action Disabled", description: "Cannot add friends in Anonymous Chat.", variant: "destructive" });
        return;
    }
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
     if (isAnonymousContext) {
        toast({ title: "Action Disabled", description: "Cannot block users in Anonymous Chat.", variant: "destructive" });
        return;
    }
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
            await runTransaction(currentUserFriendsCountRef, (currentCount) => Math.max(0, (currentCount || 0) - 1));
            await runTransaction(targetUserFriendsCountRef, (currentCount) => Math.max(0, (currentCount || 0) - 1));
        }
        toast({ title: "User Blocked", description: `You have blocked @${targetUsername}. They have been removed from your friends list.` });
    } catch (error: any) {
        console.error("Error blocking user from chat:", error);
        toast({ title: "Error", description: `Could not block user: ${error.message}`, variant: "destructive" });
    }
  };

  const handleViewUserProfile = (username?: string) => {
    if (isAnonymousContext) {
        toast({ title: "Anonymous User", description: "User profiles are hidden in Anonymous Chat."});
        return;
    }
    if (username && message.senderUid !== 'ai-chatbot-uid' && message.senderUid !== 'system') {
        router.push(`/dashboard/profile/${username}`);
    } else if (message.senderUid === 'ai-chatbot-uid') {
        toast({ title: message.sender, description: "I'm the AI assistant for RealTalk!"});
    } else if (message.senderUid === 'system') {
        toast({ title: "System Message", description: "This is an automated system message."});
    } else {
        toast({ title: "User Info", description: "Cannot navigate to this user's profile."});
    }
  };

  const showUserInteractionToast = () => {
    if (isAnonymousContext) {
        toast({ title: "Anonymous User", description: "User interactions are limited in Anonymous Chat."});
        return;
    }
    if (message.isOwnMessage || !message.senderUid || !message.senderUsername || message.senderUid === 'ai-chatbot-uid' || message.senderUid === 'system') {
        if (message.senderUid === 'ai-chatbot-uid') {
            toast({ title: message.sender, description: "I'm the AI assistant for RealTalk!"});
        } else if (message.senderUid === 'system') {
           toast({ title: "System Message", description: "This is an automated system message."});
        }
        return;
    }

    let nameStyleClass = '';
    let nameInlineStyle = {};
    if (message.senderIsShinyGold) {
        nameStyleClass = 'text-shiny-gold';
    } else if (message.senderIsShinySilver) {
        nameStyleClass = 'text-shiny-silver';
    } else if (message.senderNameColor) {
        nameInlineStyle = { color: message.senderNameColor };
    }

    toast({
      title: (
        <div className="flex items-center">
            <span className={cn(nameStyleClass)} style={nameInlineStyle}>
                @{message.senderUsername}
            </span>
            {message.senderIsAdmin && <ShieldCheck className="inline-block ml-1.5 h-4 w-4 text-destructive" />}
            {message.senderTitle &&
                <span className={cn("ml-1.5 text-xs italic", nameStyleClass)} style={nameInlineStyle}>
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
      if (part.startsWith('@') && part.length > 1 && !isAnonymousContext) { // Mention clickable only if not anonymous
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
            return part;
        }
      }
      return part;
    });
  };

  const fallbackAvatarText = message.sender ? message.sender.substring(0, 2).toUpperCase() : "U";
  if (isAnonymousContext && !message.isOwnMessage && message.senderUid !== 'system' && message.senderUid !== 'ai-chatbot-uid') {
     // fallbackAvatarText = "??"; // For anonymous user
  }


  let senderNameClassName = message.isOwnMessage ? "text-primary" : "text-foreground/80";
  if (!message.isOwnMessage && !isAnonymousContext && message.senderUid !== 'system' && message.senderUid !== 'ai-chatbot-uid') {
    senderNameClassName += " cursor-pointer hover:underline";
  }
  let senderNameStyle = {};

  if (!isAnonymousContext || message.isOwnMessage) { // Apply special styles only if not anonymous or own message
      if (message.senderIsShinyGold) {
        senderNameClassName = cn(senderNameClassName, 'text-shiny-gold');
      } else if (message.senderIsShinySilver) {
        senderNameClassName = cn(senderNameClassName, 'text-shiny-silver');
      } else if (message.senderNameColor) {
        senderNameStyle = { color: message.senderNameColor };
      }
  }


  let senderTitleClassName = "text-xs font-medium italic flex items-center shrink-0";
  let senderTitleStyle = { color: 'hsl(var(--foreground))' };
  if (!isAnonymousContext || message.isOwnMessage) { // Apply special styles for title
       if (message.senderIsShinyGold) {
        senderTitleClassName = cn(senderTitleClassName, 'text-shiny-gold');
        senderTitleStyle = {};
      } else if (message.senderIsShinySilver) {
        senderTitleClassName = cn(senderTitleClassName, 'text-shiny-silver');
        senderTitleStyle = {};
      } else if (message.senderNameColor) {
         senderTitleStyle = { color: message.senderNameColor };
      }
  }

  const hasReactions = message.reactions && Object.values(message.reactions).some(r => r && r.count > 0);

  return (
    <div
      id={`message-${message.id}`}
      className={cn(
        'flex items-start gap-3 max-w-[85%] md:max-w-[75%] rounded-lg group relative',
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
          <AvatarImage src={message.avatar || `https://placehold.co/40x40.png?text=${isAnonymousContext ? '??' : fallbackAvatarText}`} alt={message.sender} data-ai-hint="profile avatar" />
          <AvatarFallback>{isAnonymousContext ? <VenetianMask size={18}/> : fallbackAvatarText}</AvatarFallback>
        </Avatar>
      )}
      <div className="flex-1 min-w-0">
        {showAvatarAndSender && (
          <div className="flex items-center justify-between gap-2">
           <div className="flex items-baseline gap-1 flex-wrap">
            <p
                className={cn("text-xs font-semibold", senderNameClassName)}
                style={senderNameStyle}
                onClick={!message.isOwnMessage && !isAnonymousContext && message.senderUid !== 'ai-chatbot-uid' && message.senderUid !== 'system' ? showUserInteractionToast : undefined}
              >
                {message.sender}
                 {message.senderIsAdmin && !isAnonymousContext && <ShieldCheck className="inline-block ml-1 h-3.5 w-3.5 text-destructive" />}
              </p>
              {message.senderTitle && !isAnonymousContext && (
                <p className={cn(senderTitleClassName)} style={senderTitleStyle}>
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
        {hasReactions && !isAnonymousContext && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {availableReactions.map(reaction => {
              const reactionData = message.reactions?.[reaction.type];
              if (reactionData && reactionData.count > 0) {
                const userHasReacted = currentUser && reactionData.users && reactionData.users[currentUser.uid];
                return (
                  <Button
                    key={reaction.type}
                    variant={userHasReacted ? "default" : "outline"}
                    size="sm"
                    className={cn(
                        "h-auto px-2 py-0.5 text-xs rounded-full",
                        userHasReacted ? "bg-primary/20 text-primary border-primary/50" : "border-border hover:bg-accent"
                    )}
                    onClick={() => {
                        if (currentUser && message.chatType && chatId) {
                             onToggleReaction(message.id, reaction.type, message.chatType, chatId);
                        }
                    }}
                    disabled={!currentUser || !message.chatType || !chatId || message.senderUid === 'system' || message.senderUid === 'ai-chatbot-uid'}
                  >
                    <reaction.icon className={cn("h-3.5 w-3.5 mr-1", userHasReacted ? "text-primary" : "text-muted-foreground")} />
                    {reactionData.count}
                  </Button>
                );
              }
              return null;
            })}
          </div>
        )}
      </div>

      {message.chatType === 'dm' && message.isOwnMessage && message.readByRecipientTimestamp && (
        <CheckCheck size={16} className="absolute bottom-1 right-1 text-blue-500" />
      )}
       {message.chatType === 'dm' && message.isOwnMessage && !message.readByRecipientTimestamp && (
        <Check size={16} className="absolute bottom-1 right-1 text-muted-foreground" />
      )}


      {message.senderUid !== 'system' && message.senderUid !== 'ai-chatbot-uid' && !isAnonymousContext && (
        <Popover open={isReactionPopoverOpen} onOpenChange={setIsReactionPopoverOpen}>
            <PopoverTrigger asChild>
                <Button
                variant="ghost"
                size="icon"
                className="absolute -top-3 -right-3 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                disabled={!currentUser}
                >
                <SmilePlus size={16} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1">
                <div className="flex gap-1">
                {availableReactions.map(reaction => (
                    <Button
                    key={reaction.type}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                        if (currentUser && message.chatType && chatId) {
                            onToggleReaction(message.id, reaction.type, message.chatType, chatId);
                            setIsReactionPopoverOpen(false);
                        }
                    }}
                    >
                    <reaction.icon className="h-5 w-5" />
                    </Button>
                ))}
                </div>
            </PopoverContent>
        </Popover>
      )}

      {message.isOwnMessage && showAvatarAndSender && (
        <Avatar className="h-8 w-8 flex-shrink-0 cursor-pointer" onClick={() => router.push('/dashboard/profile')}>
          <AvatarImage src={message.avatar || `https://placehold.co/40x40.png?text=${fallbackAvatarText}`} alt={message.sender} data-ai-hint="profile avatar"/>
          <AvatarFallback>{fallbackAvatarText}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
