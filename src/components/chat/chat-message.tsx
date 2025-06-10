'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Smile, ThumbsUp, Heart, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export interface Message {
  id: string;
  sender: string;
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
  const renderContent = () => {
    // Basic link detection and @mention highlighting
    const parts = message.content.split(/(\s+)/);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="text-accent font-semibold cursor-pointer hover:underline">
            {part}
          </span>
        );
      }
      if (/^(https|http):\/\/[^\s$.?#].[^\s]*$/.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center"
          >
            {part} <LinkIcon size={14} className="ml-1" />
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 my-3 p-3 rounded-lg max-w-[85%]',
        message.isOwnMessage ? 'ml-auto bg-primary/10' : 'mr-auto bg-card shadow-sm'
      )}
    >
      {!message.isOwnMessage && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.avatar || `https://placehold.co/40x40.png?text=${message.sender.charAt(0)}`} alt={message.sender} data-ai-hint="profile avatar" />
          <AvatarFallback>{message.sender.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          {!message.isOwnMessage && (
            <p className="text-sm font-semibold text-foreground/80">{message.sender}</p>
          )}
          <p className={cn("text-xs text-muted-foreground", message.isOwnMessage && "ml-auto")}>{message.timestamp}</p>
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
        <div className="mt-2 flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
            <Smile size={16} />
          </Button>
          {/* Mock reactions */}
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
      </div>
      {message.isOwnMessage && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.avatar || `https://placehold.co/40x40.png?text=${message.sender.charAt(0)}`} alt={message.sender} data-ai-hint="profile avatar"/>
          <AvatarFallback>{message.sender.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
