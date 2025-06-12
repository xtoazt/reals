
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, SmilePlus, SendHorizonal, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { database, auth } from '@/lib/firebase'; // Added auth
import { ref, serverTimestamp, set, remove, onDisconnect } from 'firebase/database'; // Added set, remove, onDisconnect

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  chatId?: string; // For typing indicators
  currentUserProfile?: { uid: string; displayName: string } | null; // For typing indicators
}

const emojis = ['😀', '😂', '😍', '🤔', '😢', '🥳', '👍', '🙏'];
const TYPING_DEBOUNCE_MS = 1000; // Only update typing status every 1s
const TYPING_STOP_DELAY_MS = 3000; // Consider user stopped typing after 3s of inactivity

export function ChatInput({ onSendMessage, disabled = false, chatId, currentUserProfile }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingUpdateRef = useRef<number>(0);

  const typingStatusRef = currentUserProfile && chatId ? ref(database, `typing_status/${chatId}/${currentUserProfile.uid}`) : null;

  // Cleanup typing status on unmount or when user logs out/chatId changes
  useEffect(() => {
    const currentTypingRef = typingStatusRef; // Capture ref at effect run time
    if (currentTypingRef) {
      // Set up onDisconnect to remove typing status if browser closes or connection drops
      const onDisconnectRef = onDisconnect(currentTypingRef);
      onDisconnectRef.remove();

      return () => {
        onDisconnectRef.cancel(); // Cancel the onDisconnect handler
        remove(currentTypingRef); // Clean up immediately if component unmounts gracefully
      };
    }
  }, [typingStatusRef]); // Re-run if typingStatusRef changes (e.g. user/chatId change)


  const updateTypingStatus = useCallback((isTyping: boolean) => {
    if (!typingStatusRef || !currentUserProfile) return;

    if (isTyping) {
      set(typingStatusRef, { 
        isTyping: true, 
        timestamp: serverTimestamp(),
        displayName: currentUserProfile.displayName // Store displayName for easier access by listeners
      });
    } else {
      remove(typingStatusRef);
    }
    lastTypingUpdateRef.current = Date.now();
  }, [typingStatusRef, currentUserProfile]);


  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    if (!typingStatusRef || !currentUserProfile) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Update immediately if it's the start of typing or enough time has passed
    if (Date.now() - lastTypingUpdateRef.current > TYPING_DEBOUNCE_MS || e.target.value.length === 1) {
      updateTypingStatus(true);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, TYPING_STOP_DELAY_MS);
  };

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      updateTypingStatus(false); // Clear typing status on send
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
  };

  return (
    <div className="p-2 md:p-3 border-t bg-card">
      <div className="flex items-end gap-2">
        <Textarea
          value={message}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={disabled ? "AI is thinking..." : "Type a message..."}
          className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm"
          rows={1}
          disabled={disabled || !currentUserProfile} // Disable if no profile (not logged in)
        />
        <div className="flex items-center gap-0.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-primary" disabled={disabled || !currentUserProfile}>
                <SmilePlus size={18} />
                 <span className="sr-only">Emoji</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-4 gap-1">
                {emojis.map((emoji) => (
                  <Button
                    key={emoji}
                    variant="ghost"
                    size="icon"
                    className="text-xl"
                    onClick={() => handleEmojiSelect(emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-primary" onClick={() => alert('Image upload clicked (UI only)')} disabled={disabled || !currentUserProfile}>
            <ImageIcon size={18} />
             <span className="sr-only">Upload Image</span>
          </Button>
          <Button size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={handleSend} disabled={disabled || !message.trim() || !currentUserProfile}>
            {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal size={18} />}
            <span className="sr-only">Send Message</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
