
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
    <div className="p-2 md:p-3 border-t bg-card">
      <div className="flex items-end gap-2">
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
          className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm"
          rows={1}
        />
        <div className="flex items-center gap-0.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-primary">
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
          
          <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-primary" onClick={() => alert('Image upload clicked (UI only)')}>
            <ImageIcon size={18} />
             <span className="sr-only">Upload Image</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-primary" onClick={() => alert('Attach file clicked (UI only)')}>
            <Paperclip size={18} />
             <span className="sr-only">Attach File</span>
          </Button>
           {/* <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-primary" onClick={() => alert('Add link clicked (UI only)')}>
            <LinkIcon size={18} />
            <span className="sr-only">Add Link</span>
          </Button> */}
          <Button size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={handleSend} disabled={!message.trim()}>
            <SendHorizonal size={18} />
            <span className="sr-only">Send Message</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
