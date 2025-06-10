'use client';

import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, SmilePlus, SendHorizonal, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
}

const emojis = ['😀', '😂', '😍', '🤔', '😢', '🥳', '👍', '🙏'];

export function ChatInput({ onSendMessage }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
  };

  return (
    <div className="p-4 border-t bg-card">
      <div className="relative flex items-end gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your message... Use @ to mention."
          className="flex-1 resize-none pr-20 min-h-[40px]"
          rows={1}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <SmilePlus size={20} />
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
          
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => alert('Image upload clicked (UI only)')}>
            <ImageIcon size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => alert('Attach file clicked (UI only)')}>
            <Paperclip size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => alert('Add link clicked (UI only)')}>
            <LinkIcon size={20} />
          </Button>
          <Button size="icon" className="h-8 w-8" onClick={handleSend} disabled={!message.trim()}>
            <SendHorizonal size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}
