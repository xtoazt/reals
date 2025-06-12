
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
import { ref, get, serverTimestamp, set, push } from 'firebase/database'; // Added 'get' and 'push'

interface Friend {
  id: string;
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
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfileData | null>(null);
  
  const [friendsToDisplay, setFriendsToDisplay] = useState<Friend[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isCreatingGC, setIsCreatingGC] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const userRef = ref(database, `users/${user.uid}`);
        get(userRef).then(snapshot => {
          if (snapshot.exists()) {
            setCurrentUserProfile({ uid: user.uid, ...snapshot.val() });
          } else {
            setCurrentUserProfile({
              uid: user.uid,
              username: user.email?.split('@')[0] || "User",
              displayName: user.displayName || user.email?.split('@')[0] || "User"
            });
          }
        }).catch(error => {
          console.error("Error fetching current user profile for GC dialog:", error);
          // Set a fallback profile
          setCurrentUserProfile({
            uid: user.uid,
            username: user.email?.split('@')[0] || "User",
            displayName: user.displayName || user.email?.split('@')[0] || "User"
          });
        });
      } else {
        setCurrentUserProfile(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!isOpen || !currentUser) {
      setFriendsToDisplay([]);
      setIsLoadingData(false); // Reset loading state if dialog is closed or no user
      return;
    }

    const loadFriendsData = async () => {
      setIsLoadingData(true);
      try {
        const friendsDbRef = ref(database, `friends/${currentUser.uid}`);
        const friendsSnapshot = await get(friendsDbRef); // Use get() for one-time fetch
        const friendsData = friendsSnapshot.val();

        if (!friendsData) {
          setFriendsToDisplay([]);
          setIsLoadingData(false);
          return;
        }

        const friendUIDs = Object.keys(friendsData);
        if (friendUIDs.length === 0) {
          setFriendsToDisplay([]);
          setIsLoadingData(false);
          return;
        }

        const profilePromises = friendUIDs.map(async (uid) => {
          try {
            const userRefPath = `users/${uid}`;
            const profileSnapshot = await get(ref(database, userRefPath));
            if (profileSnapshot.exists()) {
              const userData = profileSnapshot.val();
              return {
                id: uid,
                username: userData.username || "unknown_user",
                displayName: userData.displayName || userData.username || "Unknown User", // Ensure displayName has a fallback
                avatar: userData.avatar,
                nameColor: userData.nameColor,
              } as Friend;
            }
            return null; // User profile might not exist
          } catch (profileError) {
            console.error(`Error fetching profile for UID ${uid}:`, profileError);
            return null; // Treat error as profile not found for this item
          }
        });

        // Wait for all profile fetches to settle
        const profilesResults = await Promise.allSettled(profilePromises);
        
        const fetchedFriends: Friend[] = [];
        profilesResults.forEach(result => {
          // Add to list only if fetch was successful and profile data is not null
          if (result.status === 'fulfilled' && result.value) {
            fetchedFriends.push(result.value);
          }
        });
        setFriendsToDisplay(fetchedFriends);

      } catch (error) {
        console.error("Error loading friends data for GC dialog:", error);
        toast({ title: "Error", description: "Could not load friends list.", variant: "destructive" });
        setFriendsToDisplay([]); // Clear list on error
      } finally {
        setIsLoadingData(false); // Ensure loading is set to false in all cases
      }
    };

    loadFriendsData();

    // No cleanup function needed for get(), but if there were other listeners, they'd go here.
  }, [isOpen, currentUser, toast]);


  useEffect(() => {
    // Reset form fields when dialog closes
    if (!isOpen) {
      setGCName('');
      setSelectedFriends([]);
      setIsCreatingGC(false);
      // setFriendsToDisplay([]); // Optionally clear display list, or let it persist for quick reopen
      // setIsLoadingData(false); // This is handled by the main data loading effect
    }
  }, [isOpen]);

  const handleSelectFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !currentUserProfile) {
      toast({ title: 'Error', description: 'You must be logged in to create a GC.', variant: 'destructive' });
      return;
    }
    if (!gcName.trim()) {
      toast({ title: 'Error', description: 'Group Chat name cannot be empty.', variant: 'destructive' });
      return;
    }

    setIsCreatingGC(true);
    const newGCId = `gc-${gcName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30)}-${Date.now()}`;

    try {
      const gcChatRef = ref(database, `chats/${newGCId}`);
      const initialMessageContent = `${currentUserProfile.displayName} created the Group Chat: "${gcName}"`;

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
        avatar: `https://placehold.co/40x40.png?text=SYS`, // Placeholder for system messages
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                {isLoadingData ? (
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
                        onClick={() => !isCreatingGC && handleSelectFriend(friend.id)}
                        onKeyDown={(e) => { if (!isCreatingGC && (e.key === ' ' || e.key === 'Enter')) handleSelectFriend(friend.id); }}
                      >
                        <Checkbox
                          id={`friend-${friend.id}`}
                          checked={selectedFriends.includes(friend.id)}
                          aria-labelledby={`friend-label-${friend.id}`}
                          disabled={isCreatingGC}
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
                    {(currentUser && friendsToDisplay.length === 0 && !isLoadingData) ? "You have no friends to invite yet." : "No friends to display or an error occurred."}
                  </p>
                )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isCreatingGC}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={!gcName.trim() || isLoadingData || isCreatingGC}>
              {isCreatingGC ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create GC
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
