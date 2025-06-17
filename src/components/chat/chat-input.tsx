
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, SmilePlus, SendHorizonal, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { database, auth } from '@/lib/firebase';
import { ref, serverTimestamp, set, remove, onDisconnect } from 'firebase/database';
import type { UserProfileData } from './chat-interface';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  chatId?: string;
  loggedInUserProfile?: UserProfileData | null;
}

const emojis = ['😀', '😂', '😍', '🤔', '😢', '🥳', '👍', '🙏'];
const TYPING_DEBOUNCE_MS = 1000;
const TYPING_STOP_DELAY_MS = 3000;
const SEND_ANIMATION_DURATION_MS = 400;

export function ChatInput({ onSendMessage, disabled = false, chatId, loggedInUserProfile }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingUpdateRef = useRef<number>(0);
  const [isAnimatingSend, setIsAnimatingSend] = useState(false);

  const typingStatusRef = loggedInUserProfile?.uid && typeof loggedInUserProfile.uid === 'string' && chatId ? ref(database, `typing_status/${chatId}/${loggedInUserProfile.uid}`) : null;

  useEffect(() => {
    if (!loggedInUserProfile?.uid || typeof loggedInUserProfile.uid !== 'string' || !chatId) {
      return;
    }

    const currentTypingRef = ref(database, `typing_status/${chatId}/${loggedInUserProfile.uid}`);
    const onDisconnectRefHandle = onDisconnect(currentTypingRef);
    onDisconnectRefHandle.remove().catch(e => console.warn("Error on onDisconnect().remove() for typing status:", e));

    return () => {
      onDisconnectRefHandle.cancel().catch(e => console.warn("Error on onDisconnect().cancel() for typing status:", e));
      if (auth.currentUser?.uid === loggedInUserProfile?.uid) {
          remove(currentTypingRef).catch(e => console.warn("Error removing typing status on unmount/cleanup:", e));
      }
    };
  }, [loggedInUserProfile?.uid, chatId]);


  const updateTypingStatus = useCallback((isTyping: boolean) => {
    if (!typingStatusRef || !loggedInUserProfile?.uid || typeof loggedInUserProfile.uid !== 'string' || !loggedInUserProfile.displayName) {
      return;
    }

    if (isTyping) {
      set(typingStatusRef, {
        isTyping: true,
        timestamp: serverTimestamp(),
        displayName: loggedInUserProfile.displayName
      }).catch(error => console.error("Error setting typing status (true):", error));
    } else {
      remove(typingStatusRef).catch(error => console.error("Error removing typing status (false):", error));
    }
    lastTypingUpdateRef.current = Date.now();
  }, [typingStatusRef, loggedInUserProfile]);


  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    if (!typingStatusRef || !loggedInUserProfile?.uid || typeof loggedInUserProfile.uid !== 'string' || !loggedInUserProfile.displayName) {
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (Date.now() - lastTypingUpdateRef.current > TYPING_DEBOUNCE_MS || e.target.value.length === 1) {
      updateTypingStatus(true);
    }

    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, TYPING_STOP_DELAY_MS);
  };

  const handleSend = () => {
    if (message.trim() && !disabled && loggedInUserProfile?.uid && typeof loggedInUserProfile.uid === 'string') {
      if (isAnimatingSend) return;

      onSendMessage(message);
      setMessage('');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (typingStatusRef && loggedInUserProfile?.uid && typeof loggedInUserProfile.uid === 'string' && loggedInUserProfile.displayName) { 
        updateTypingStatus(false);
      }

      setIsAnimatingSend(true);
      setTimeout(() => {
        setIsAnimatingSend(false);
      }, SEND_ANIMATION_DURATION_MS);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
  };

  const isInputDisabled = disabled || !loggedInUserProfile?.uid;

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
          placeholder={isInputDisabled ? (disabled && chatType === 'ai' ? "AI is thinking..." : "Login to chat...") : "Type a message..."}
          className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm"
          rows={1}
          disabled={isInputDisabled}
        />
        <div className="flex items-center gap-0.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-primary" disabled={isInputDisabled}>
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

          <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-primary" onClick={() => alert('Image upload clicked (UI only)')} disabled={isInputDisabled}>
            <ImageIcon size={18} />
             <span className="sr-only">Upload Image</span>
          </Button>
          <Button
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9"
            onClick={handleSend}
            disabled={isInputDisabled || !message.trim() || isAnimatingSend}
          >
            {isAnimatingSend ? (
              <SendHorizonal size={18} className="animate-send-effect" />
            ) : disabled && !isInputDisabled ? ( 
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizonal size={18} />
            )}
            <span className="sr-only">Send Message</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
