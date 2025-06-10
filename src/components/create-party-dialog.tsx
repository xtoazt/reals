
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

// Mock friends list (in a real app, this would come from state/API)
const mockFriendsList = [
  { id: '1', name: 'Alice Wonderland', avatar: 'https://placehold.co/40x40/E6A4B4/FFFFFF.png?text=A' },
  { id: '2', name: 'Bob The Builder', avatar: 'https://placehold.co/40x40/A4B4E6/FFFFFF.png?text=B' },
  { id: '3', name: 'Charlie Brown', avatar: 'https://placehold.co/40x40/E6D4A4/FFFFFF.png?text=C' },
  { id: '5', name: 'Diana Prince', avatar: 'https://placehold.co/40x40/A4E6A4/FFFFFF.png?text=D' },
  { id: '6', name: 'Edward Scissorhands', avatar: 'https://placehold.co/40x40/E6A4E6/FFFFFF.png?text=E' },
  { id: '7', name: 'Fiona Apple', avatar: 'https://placehold.co/40x40/A4E6E6/FFFFFF.png?text=F' },
];

interface CreatePartyDialogProps {
  children?: React.ReactNode; // For custom trigger
}

export function CreatePartyDialog({ children }: CreatePartyDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  // Effect to reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPartyName('');
      setSelectedFriends([]);
    }
  }, [isOpen]);

  const handleSelectFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!partyName.trim()) {
      toast({ title: 'Error', description: 'Party name cannot be empty.', variant: 'destructive' });
      return;
    }
    if (selectedFriends.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one friend to invite.', variant: 'destructive' });
      return;
    }

    const newPartyId = `party-${Date.now()}`;
    console.log('Creating party:', { partyName, selectedFriends, newPartyId });
    toast({
      title: 'Party Created!',
      description: `"${partyName}" has been created with ${selectedFriends.length} friend(s).`,
    });
    
    setIsOpen(false);
    // Optionally navigate to the new chat
    // router.push(`/dashboard/chat/${newPartyId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children ? (
        <DialogTrigger asChild>{children}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" /> Create Party
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Create New Party</DialogTitle>
            <DialogDescription>
              Give your party a name and invite your friends to chat.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="partyName">Party Name</Label>
              <Input
                id="partyName"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="E.g., Weekend Hangout"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Invite Friends ({selectedFriends.length} selected)</Label>
              <ScrollArea className="h-[200px] w-full rounded-md border">
                <div className="p-2 space-y-1">
                  {mockFriendsList.length > 0 ? (
                    mockFriendsList.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted has-[button:focus-visible]:bg-muted has-[:checked]:bg-primary/10"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectFriend(friend.id)}
                        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') handleSelectFriend(friend.id);}}
                      >
                        <Checkbox
                          id={`friend-${friend.id}`}
                          checked={selectedFriends.includes(friend.id)}
                          aria-labelledby={`friend-label-${friend.id}`}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={friend.avatar} alt={friend.name} data-ai-hint="profile avatar" />
                          <AvatarFallback>{friend.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <label id={`friend-label-${friend.id}`} className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                          {friend.name}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground p-2 text-center">You have no friends to invite yet.</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={!partyName.trim() || selectedFriends.length === 0}>
              Create Party
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
