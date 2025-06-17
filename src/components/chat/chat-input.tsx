
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
  disabled?: boolean; // General disabled state (e.g., AI responding)
  chatId?: string;
  currentUserProfile?: { uid: string; displayName: string } | null; // Null if not logged in or profile not loaded
}

const emojis = ['😀', '😂', '😍', '🤔', '😢', '🥳', '👍', '🙏'];
const TYPING_DEBOUNCE_MS = 1000;
const TYPING_STOP_DELAY_MS = 3000;
const SEND_ANIMATION_DURATION_MS = 400;

export function ChatInput({ onSendMessage, disabled = false, chatId, currentUserProfile }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingUpdateRef = useRef<number>(0);
  const [isAnimatingSend, setIsAnimatingSend] = useState(false);

  // Typing status ref is only valid if chatId and currentUserProfile (with uid) exist
  const typingStatusRef = currentUserProfile?.uid && chatId ? ref(database, `typing_status/${chatId}/${currentUserProfile.uid}`) : null;

  // Cleanup typing status on unmount or when user logs out/chatId changes/profile becomes null
  useEffect(() => {
    const currentTypingRef = typingStatusRef;
    if (currentTypingRef) {
      const onDisconnectRef = onDisconnect(currentTypingRef);
      onDisconnectRef.remove();

      return () => {
        onDisconnectRef.cancel();
        remove(currentTypingRef);
      };
    }
  }, [typingStatusRef]); // Re-run if typingStatusRef changes


  const updateTypingStatus = useCallback((isTyping: boolean) => {
    // Crucial: Only update if profile and ref are valid, AND displayName is available for the payload
    if (!typingStatusRef || !currentUserProfile?.uid || !currentUserProfile.displayName) {
      // console.warn("Skipping typing update: Profile or typing ref not ready.");
      return;
    }

    if (isTyping) {
      set(typingStatusRef, {
        isTyping: true,
        timestamp: serverTimestamp(),
        displayName: currentUserProfile.displayName
      }).catch(error => console.error("Error setting typing status (true):", error));
    } else {
      remove(typingStatusRef).catch(error => console.error("Error removing typing status (false):", error));
    }
    lastTypingUpdateRef.current = Date.now();
  }, [typingStatusRef, currentUserProfile]);


  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Crucial: Only handle typing if profile (uid and displayName) and ref are valid
    if (!typingStatusRef || !currentUserProfile?.uid || !currentUserProfile.displayName) {
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
    // Ensure user profile is available before sending
    if (message.trim() && !disabled && currentUserProfile?.uid) { // Check uid specifically
      if (isAnimatingSend) return;

      onSendMessage(message);
      setMessage('');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Update typing status only if profile (uid and displayName) and ref are valid
      if (typingStatusRef && currentUserProfile?.uid && currentUserProfile.displayName) {
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

  // Overall disabled state for input elements if no profile or if explicitly disabled
  const isInputDisabled = disabled || !currentUserProfile?.uid; // Check uid for stricter disabling

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
          placeholder={isInputDisabled ? (disabled ? "AI is thinking..." : "Login to chat...") : "Type a message..."}
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
            ) : disabled && !currentUserProfile?.uid ? ( // Check uid specifically
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
