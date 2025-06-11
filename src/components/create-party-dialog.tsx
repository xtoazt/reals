
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { Users, PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { auth, database } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { ref, onValue, get, off } from 'firebase/database';

interface Friend {
  id: string; // friend's UID
  username: string;
  displayName: string;
  avatar?: string;
  nameColor?: string;
}

interface UserProfileData {
    uid: string;
    username: string;
    displayName: string;
    avatar?: string;
    nameColor?: string;
}

interface CreatePartyDialogProps {
  children?: React.ReactNode; 
}

export function CreatePartyDialog({ children }: CreatePartyDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [usersCache, setUsersCache] = useState<{[uid: string]: UserProfileData}>({});

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfileData | null> => {
    if (usersCache[uid]) return usersCache[uid];
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const profile = { uid, ...userData };
        setUsersCache(prev => ({...prev, [uid]: profile}));
        return profile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  }, [usersCache]);

  useEffect(() => {
    if (!currentUser || !isOpen) {
      if (!isOpen) { // Reset friends list if dialog is closed
        setFriendsList([]);
        setIsLoadingFriends(false);
      }
      return;
    }

    setIsLoadingFriends(true);
    const friendsRef = ref(database, `friends/${currentUser.uid}`);
    const listener = onValue(friendsRef, async (snapshot) => {
      const friendsData = snapshot.val();
      if (friendsData) {
        const loadedFriends: Friend[] = [];
        const friendUIDs = Object.keys(friendsData);
        for (const friendUid of friendUIDs) {
          const profile = await fetchUserProfile(friendUid);
          if (profile) {
            loadedFriends.push({
              id: friendUid,
              username: profile.username,
              displayName: profile.displayName,
              avatar: profile.avatar,
              nameColor: profile.nameColor,
            });
          }
        }
        setFriendsList(loadedFriends);
      } else {
        setFriendsList([]);
      }
      setIsLoadingFriends(false);
    }, (error) => {
        console.error("Error fetching friends for party dialog:", error);
        toast({title: "Error", description: "Could not load friends list.", variant: "destructive"});
        setIsLoadingFriends(false);
    });
    return () => off(friendsRef, 'value', listener);
  }, [currentUser, isOpen, fetchUserProfile, toast]);


  useEffect(() => {
    if (!isOpen) {
      setPartyName('');
      setSelectedFriends([]);
      // usersCache can persist across dialog openings for efficiency, or be cleared too
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

    // For now, just a toast. Actual party creation would involve:
    // 1. Generating a unique partyId (e.g., `party-${Date.now()}` or a Firebase push key).
    // 2. Creating a node in `/chats/{partyId}` with party info (name, members, etc.).
    // 3. Potentially adding this party to a user's list of parties.
    const newPartyId = `party-${partyName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    console.log('Creating party:', { partyName, selectedFriends, newPartyId });
    toast({
      title: 'Party Created (Mock)',
      description: `"${partyName}" with ${selectedFriends.length} friend(s). ID: ${newPartyId}. Further implementation needed.`,
    });
    
    setIsOpen(false);
    // router.push(`/dashboard/chat/${newPartyId}`); // Uncomment to navigate
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
                {isLoadingFriends ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : friendsList.length > 0 ? (
                    <div className="p-2 space-y-1">
                    {friendsList.map((friend) => (
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
                          <AvatarImage src={friend.avatar || `https://placehold.co/40x40.png?text=${friend.displayName.charAt(0)}`} alt={friend.displayName} data-ai-hint="profile avatar" />
                          <AvatarFallback>{friend.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <label id={`friend-label-${friend.id}`} className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                          {friend.displayName} <span className="text-xs text-muted-foreground">(@{friend.username})</span>
                        </label>
                      </div>
                    ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-4 text-center">You have no friends to invite yet, or they couldn't be loaded.</p>
                  )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={!partyName.trim() || selectedFriends.length === 0 || isLoadingFriends}>
              Create Party
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
