
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
import { Loader2, MessageSquareText, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { auth, database } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { ref, get, serverTimestamp, set, push } from 'firebase/database';

interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  nameColor?: string;
}

// Minimal UserProfileData structure needed within this component
interface UserProfileData {
    uid: string;
    id: string; // duplicate uid here for Friend compatibility if needed, or adjust Friend interface
    username: string;
    displayName: string;
    avatar?: string;
    nameColor?: string;
}


interface CreateGCDialogProps {
  children?: React.ReactNode;
}

export function CreateGCDialog({ children }: CreateGCDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gcName, setGCName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  
  const [friendsToDisplay, setFriendsToDisplay] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isCreatingGC, setIsCreatingGC] = useState(false);
  const [usersCache, setUsersCache] = useState<{[uid: string]: UserProfileData}>({});


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchUserProfileForDialog = async (uid: string): Promise<UserProfileData | null> => {
      if (usersCache[uid] && isMounted) return usersCache[uid];
      try {
        const userRef = ref(database, `users/${uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists() && isMounted) {
          const userData = snapshot.val();
          const profile: UserProfileData = {
            uid,
            id: uid, // for Friend compatibility
            username: userData.username || "unknown_user",
            displayName: userData.displayName || userData.username || "Unknown User",
            avatar: userData.avatar,
            nameColor: userData.nameColor,
          };
          if (isMounted) setUsersCache(prev => ({ ...prev, [uid]: profile }));
          return profile;
        }
        return null;
      } catch (error) {
        if (isMounted) console.error(`Error fetching user profile for ${uid} in dialog:`, error);
        return null;
      }
    };

    const loadFriendsData = async () => {
      if (!currentUser || !isMounted) {
        if (isMounted) {
            setFriendsToDisplay([]);
            setIsLoadingFriends(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoadingFriends(true);
        setFriendsToDisplay([]); 
      }

      try {
        const friendsDbRef = ref(database, `friends/${currentUser.uid}`);
        const friendsSnapshot = await get(friendsDbRef);
        const friendsData = friendsSnapshot.val();

        if (!friendsData || !isMounted) {
          if (isMounted) setFriendsToDisplay([]);
          if (isMounted) setIsLoadingFriends(false);
          return;
        }

        const friendUIDs = Object.keys(friendsData);
        if (friendUIDs.length === 0 && isMounted) {
          if (isMounted) setFriendsToDisplay([]);
          if (isMounted) setIsLoadingFriends(false);
          return;
        }
        
        const fetchedFriendsPromises = friendUIDs.map(uid => fetchUserProfileForDialog(uid));
        const profilesResults = await Promise.allSettled(fetchedFriendsPromises);
        
        if (!isMounted) return;

        const successfullyFetchedFriends: Friend[] = [];
        profilesResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            successfullyFetchedFriends.push(result.value as Friend);
          }
        });
        if (isMounted) setFriendsToDisplay(successfullyFetchedFriends);

      } catch (error) {
        console.error("Error loading friends data for GC dialog:", error);
        if (isMounted) {
          toast({ title: "Error", description: "Could not load friends list.", variant: "destructive" });
          setFriendsToDisplay([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingFriends(false);
        }
      }
    };

    if (isOpen && currentUser) {
      loadFriendsData();
    } else if (!isOpen) {
      // If dialog closes, reset data-loading related state
      if (isMounted) {
        setFriendsToDisplay([]);
        setIsLoadingFriends(false);
        setUsersCache({}); // Clear local cache when dialog closes
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUser, toast, usersCache]); // usersCache is a dependency for fetchUserProfileForDialog closure

  const handleOpenChange = (openValue: boolean) => {
    setIsOpen(openValue);
    if (!openValue) {
      // Dialog is closing, reset FORM internal state
      setGCName('');
      setSelectedFriends([]);
      setIsCreatingGC(false);
      // Data-related state (friendsToDisplay, isLoadingFriends, usersCache) is reset by the useEffect above
    }
  };

  const handleSelectFriend = (friendId: string) => {
    if (isCreatingGC) return; // Prevent selection changes while creating
    setSelectedFriends((prevSelected) =>
      prevSelected.includes(friendId)
        ? prevSelected.filter((id) => id !== friendId)
        : [...prevSelected, friendId]
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) {
      toast({ title: 'Error', description: 'You must be logged in to create a GC.', variant: 'destructive' });
      return;
    }
    
    const creatorProfileSnapshot = await get(ref(database, `users/${currentUser.uid}`));
    const creatorProfileData = creatorProfileSnapshot.val();
    const creatorDisplayName = creatorProfileData?.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || "User";


    if (!gcName.trim()) {
      toast({ title: 'Error', description: 'Group Chat name cannot be empty.', variant: 'destructive' });
      return;
    }

    setIsCreatingGC(true);
    const newGCId = `gc-${gcName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30)}-${Date.now()}`;

    try {
      const gcChatRef = ref(database, `chats/${newGCId}`);
      const initialMessageContent = `${creatorDisplayName} created the Group Chat: "${gcName}"`;

      const members: { [key: string]: boolean } = {};
      members[currentUser.uid] = true;
      selectedFriends.forEach(friendId => members[friendId] = true);

      await set(gcChatRef, {
        gcName: gcName,
        createdBy: currentUser.uid,
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

      setIsOpen(false); 
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
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {children ? (
        <DialogTrigger asChild>{children}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" /> Create GC
          </Button>
        </DialogTrigger>
      )}
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
              <Label htmlFor="gcName">GC Name</Label>
              <Input
                id="gcName"
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
                        className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted has-[button:focus-visible]:bg-muted has-[:checked]:bg-primary/10"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectFriend(friend.id)}
                        onKeyDown={(e) => { if (!isCreatingGC && (e.key === ' ' || e.key === 'Enter')) handleSelectFriend(friend.id); }}
                      >
                        <Checkbox
                          id={`friend-${friend.id}`}
                          checked={selectedFriends.includes(friend.id)}
                          aria-labelledby={`friend-label-${friend.id}`}
                          disabled={isCreatingGC || isLoadingFriends}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={friend.avatar || `https://placehold.co/40x40.png?text=${getAvatarFallbackText(friend.displayName)}`} alt={friend.displayName} data-ai-hint="profile avatar" />
                          <AvatarFallback>{getAvatarFallbackText(friend.displayName)}</AvatarFallback>
                        </Avatar>
                        <label id={`friend-label-${friend.id}`} className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                          {friend.displayName || "Unnamed User"} <span className="text-xs text-muted-foreground">(@{friend.username || "unknown"})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    {(currentUser && friendsToDisplay.length === 0 && !isLoadingFriends) ? "You have no friends to invite yet." : "Loading friends or none to display."}
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
    </Dialog>
  );
}
