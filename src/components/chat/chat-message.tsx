
'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button'; // Assuming Button is a client component
import { Smile, ThumbsUp, Heart, Link as LinkIcon, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast'; // Import useToast

export interface Message {
  id: string;
  sender: string;
  senderUid?: string; // Added for unique identification
  senderNameColor?: string; // Added for custom name color
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
  const { toast } = useToast(); // Initialize toast

  const handleProfileInteraction = () => {
    if (message.isOwnMessage) { // Don't show options for own messages
        toast({ title: "Your Profile", description: "This is you!"});
        return;
    }
    if (!message.senderUid) {
      toast({ title: "Info", description: `Viewing info for ${message.sender}. (User ID not available for further actions)`});
      return;
    }
    // In a real app, you might open a modal or navigate to a profile page
    // For now, we'll use toasts to simulate actions
    toast({
      title: `User: ${message.sender}`,
      description: "What would you like to do?",
      action: (
        <div className="flex flex-col gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => toast({ title: "View Profile", description: `Navigating to ${message.sender}'s profile... (mock)` })}>
            View Profile
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Friend Request", description: `Sending friend request to ${message.sender}... (mock)` })}>
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
        return (
          <span key={index} className="text-accent font-semibold cursor-pointer hover:underline">
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
        'flex items-start gap-3 my-3 p-3 rounded-lg max-w-[85%]',
        message.isOwnMessage ? 'ml-auto bg-primary/10' : 'mr-auto bg-card shadow-sm'
      )}
    >
      {!message.isOwnMessage && (
        <Avatar className="h-8 w-8 cursor-pointer" onClick={handleProfileInteraction}>
          <AvatarImage src={message.avatar || `https://placehold.co/40x40.png?text=${fallbackAvatarText}`} alt={message.sender} data-ai-hint="profile avatar" />
          <AvatarFallback>{fallbackAvatarText}</AvatarFallback>
        </Avatar>
      )}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          {!message.isOwnMessage && (
            <p 
              className="text-sm font-semibold text-foreground/80 cursor-pointer hover:underline" 
              style={senderStyle}
              onClick={handleProfileInteraction}
            >
              {message.sender}
            </p>
          )}
           {message.isOwnMessage && ( // Display own name if it's own message, also with color
            <p 
              className="text-sm font-semibold" 
              style={senderStyle}
            >
              {message.sender}
            </p>
          )}
          <p className={cn("text-xs text-muted-foreground", message.isOwnMessage ? "ml-2" : "ml-auto")}>{message.timestamp}</p>
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
    
