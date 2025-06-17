
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Loader2, MessageSquareText, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { database } from '@/lib/firebase';
import { type User as FirebaseUser } from 'firebase/auth';
import { ref, get, serverTimestamp, set, push } from 'firebase/database';
import type { TopNavBarUserProfileData } from './top-nav-bar';


interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  nameColor?: string;
}

interface CreateGCDialogProps {
  children?: React.ReactNode;
  currentUser: FirebaseUser | null;
  currentUserProfile: TopNavBarUserProfileData | null;
}

export function CreateGCDialog({ children, currentUser: propsCurrentUser, currentUserProfile: propsCurrentUserProfile }: CreateGCDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gcName, setGCName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();
  
  const [friendsToDisplay, setFriendsToDisplay] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isCreatingGC, setIsCreatingGC] = useState(false);
  const isOpenRef = useRef(isOpen); 

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const handleDialogOnOpenChange = useCallback((openValue: boolean) => {
    setIsOpen(openValue);
  }, []); 

  useEffect(() => {
    if (isOpen) {
      setGCName('');
      setSelectedFriends([]);
      setIsCreatingGC(false); 
      setFriendsToDisplay([]);
      setIsLoadingFriends(true);

      if (propsCurrentUser?.uid) {
        const loadFriends = async () => {
          try {
            const friendsDbRef = ref(database, `friends/${propsCurrentUser.uid}`);
            const friendsSnapshot = await get(friendsDbRef);
            const friendsData = friendsSnapshot.val();
            let fetchedFriendsList: Friend[] = [];

            if (friendsData && Object.keys(friendsData).length > 0) {
              const friendUIDs = Object.keys(friendsData);
              const fetchedFriendsPromises = friendUIDs.map(async (uid) => {
                const userRefDb = ref(database, `users/${uid}`);
                const userSnapshot = await get(userRefDb);
                if (userSnapshot.exists()) {
                  const userData = userSnapshot.val();
                  return {
                    id: uid,
                    username: userData.username || "unknown_user",
                    displayName: userData.displayName || userData.username || "Unknown User",
                    avatar: userData.avatar,
                    nameColor: userData.nameColor,
                  };
                }
                return null;
              });
              fetchedFriendsList = (await Promise.all(fetchedFriendsPromises)).filter(f => f !== null) as Friend[];
            }
            
            if (isOpenRef.current) { 
              setFriendsToDisplay(fetchedFriendsList);
            }

          } catch (error) {
            console.error("Error loading friends data for GC dialog:", error);
            if (isOpenRef.current) {
              toast({ title: "Error", description: "Could not load friends list.", variant: "destructive" });
              setFriendsToDisplay([]); // Ensure it's reset on error too
            }
          } finally {
            if (isOpenRef.current) { 
              setIsLoadingFriends(false);
            }
          }
        };
        loadFriends();
      } else {
         if (isOpenRef.current) {
            setFriendsToDisplay([]);
            setIsLoadingFriends(false);
        }
      }
    } else {
      if (isLoadingFriends) {
         setIsLoadingFriends(false);
      }
    }
  }, [isOpen, propsCurrentUser?.uid]); // `toast` removed from dependencies

  const handleSelectFriendInForm = useCallback((friendId: string) => {
    if (isCreatingGC) return; 
    setSelectedFriends((prevSelected) =>
      prevSelected.includes(friendId)
        ? prevSelected.filter((id) => id !== friendId)
        : [...prevSelected, friendId]
    );
  }, [isCreatingGC]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!propsCurrentUser || !propsCurrentUserProfile) {
      toast({ title: 'Error', description: 'You must be logged in to create a GC.', variant: 'destructive' });
      return;
    }
    
    const creatorDisplayName = propsCurrentUserProfile.displayName || propsCurrentUser.displayName || "User";

    if (!gcName.trim()) {
      toast({ title: 'Error', description: 'Group Chat name cannot be empty.', variant: 'destructive' });
      return;
    }

    setIsCreatingGC(true);
    const newGCId = `gc-${gcName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 25)}-${Date.now().toString().slice(-5)}`;

    try {
      const gcChatRef = ref(database, `chats/${newGCId}`);
      const initialMessageContent = `${creatorDisplayName} created the Group Chat: "${gcName}"`;

      const members: { [key: string]: boolean } = {};
      members[propsCurrentUser.uid] = true;
      selectedFriends.forEach(friendId => members[friendId] = true);

      await set(gcChatRef, {
        gcName: gcName,
        createdBy: propsCurrentUser.uid,
        createdAt: serverTimestamp(),
        members: members,
      });

      const messagesRef = ref(database, `chats/${newGCId}/messages`);
      const initialMessage = {
        senderUid: 'system',
        senderName: 'System',
        senderUsername: 'system',
        avatar: `https://placehold.co/40x40.png?text=SYS`,
        content: initialMessageContent,
        timestamp: serverTimestamp(),
      };
      await push(messagesRef, initialMessage);
      
      toast({
        title: 'Group Chat Created!',
        description: `"${gcName}" is ready.`,
      });

      handleDialogOnOpenChange(false); 
      router.push(`/dashboard/chat/${newGCId}`);
    } catch (error) {
      console.error("Error creating GC:", error);
      toast({ title: 'Error', description: 'Could not create Group Chat.', variant: 'destructive' });
    } finally {
        setIsCreatingGC(false); 
    }
  };
  
  const getAvatarFallbackText = (displayName?: string) => {
    return displayName ? displayName.charAt(0).toUpperCase() : 'U';
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOnOpenChange}>
      {children ? (
        <DialogTrigger asChild>{children}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" /> Create GC
          </Button>
        </DialogTrigger>
      )}
      {isOpen && ( 
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center"><MessageSquareText className="mr-2 h-5 w-5" />Create New Group Chat</DialogTitle>
              <DialogDescription>
                Give your GC a name and invite your friends to chat.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="gcName-dialog-unique-input-final">GC Name</Label> 
                <Input
                  id="gcName-dialog-unique-input-final" 
                  value={gcName}
                  onChange={(e) => setGCName(e.target.value)}
                  placeholder="E.g., Weekend Hangout"
                  required
                  disabled={isCreatingGC}
                />
              </div>
              <div className="space-y-2">
                <Label>Invite Friends ({selectedFriends.length} selected)</Label>
                <ScrollArea className="h-[200px] w-full rounded-md border">
                  {isLoadingFriends ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : friendsToDisplay.length > 0 ? (
                    <div className="p-2 space-y-1">
                      {friendsToDisplay.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted has-[button:focus-visible]:bg-muted has-[:checked]:bg-primary/10 cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectFriendInForm(friend.id)}
                          onKeyDown={(e) => { if (!isCreatingGC && (e.key === ' ' || e.key === 'Enter')) handleSelectFriendInForm(friend.id); }}
                        >
                          <Checkbox
                            id={`friend-dialog-final-checkbox-${friend.id}`} 
                            checked={selectedFriends.includes(friend.id)}
                            aria-labelledby={`friend-label-dialog-final-${friend.id}`} 
                            disabled={isCreatingGC || isLoadingFriends}
                            onCheckedChange={() => handleSelectFriendInForm(friend.id)} 
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={friend.avatar || `https://placehold.co/40x40.png?text=${getAvatarFallbackText(friend.displayName)}`} alt={friend.displayName} data-ai-hint="profile avatar" />
                            <AvatarFallback>{getAvatarFallbackText(friend.displayName)}</AvatarFallback>
                          </Avatar>
                          <label id={`friend-label-dialog-final-${friend.id}`} className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                            {friend.displayName || "Unnamed User"} <span className="text-xs text-muted-foreground">(@{friend.username || "unknown"})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                      {(propsCurrentUser && friendsToDisplay.length === 0 && !isLoadingFriends) ? "You have no friends to invite yet." : "No friends found or still loading."}
                    </p>
                  )}
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isCreatingGC}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={!gcName.trim() || isLoadingFriends || isCreatingGC}>
                {isCreatingGC ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create GC
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

    