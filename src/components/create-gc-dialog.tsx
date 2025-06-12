
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
import { ref, onValue, get, off, serverTimestamp, set, push } from 'firebase/database';

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

type UserCacheEntry = UserProfileData | null; // null means fetch attempted, not found or error
interface UsersCache {
  [uid: string]: UserCacheEntry;
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
  
  const [friendUIDs, setFriendUIDs] = useState<string[]>([]);
  const [usersCache, setUsersCache] = useState<UsersCache>({});
  const [friendsList, setFriendsList] = useState<Friend[]>([]);

  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
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

  // Effect 1: Listen to Firebase for friend UIDs when dialog is open and user is available
  useEffect(() => {
    if (!currentUser || !isOpen) {
      setFriendUIDs([]); 
      return;
    }

    // setIsLoadingFriends(true); // Initial loading state for UIDs
    const friendsDbRef = ref(database, `friends/${currentUser.uid}`);
    const listener = onValue(friendsDbRef, (snapshot) => {
      const friendsData = snapshot.val();
      setFriendUIDs(friendsData ? Object.keys(friendsData) : []);
    }, (error) => {
      console.error("Error fetching friend UIDs:", error);
      toast({ title: "Error", description: "Could not load friend UIDs.", variant: "destructive" });
      setFriendUIDs([]);
      // setIsLoadingFriends(false); // Clear loading on error
    });

    return () => {
      off(friendsDbRef, 'value', listener);
    };
  }, [currentUser, isOpen, toast]);


  // Memoized function to fetch and cache a single user profile
  const fetchAndCacheUserProfile = useCallback(async (uid: string) => {
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const profile: UserProfileData = {
          uid,
          username: userData.username || "unknown_user",
          displayName: userData.displayName || "Unknown User", // Or use userData.username
          avatar: userData.avatar,
          nameColor: userData.nameColor,
        };
        setUsersCache(prevCache => ({ ...prevCache, [uid]: profile }));
      } else {
        setUsersCache(prevCache => ({ ...prevCache, [uid]: null })); // Cache null if not found
      }
    } catch (error) {
      console.error(`Error fetching user profile for UID ${uid}:`, error);
      setUsersCache(prevCache => ({ ...prevCache, [uid]: null })); // Cache null on error
    }
  }, [setUsersCache]); // setUsersCache is stable


  // Effect 2: Initiate Profile Fetches for Missing UIDs
  // This effect runs when the dialog opens, or when the list of friend UIDs changes.
  // It does not depend on usersCache to avoid loops.
  useEffect(() => {
    if (!isOpen || !currentUser || friendUIDs.length === 0) {
      return; 
    }

    const uidsThatNeedFetching = friendUIDs.filter(uid => usersCache[uid] === undefined);

    if (uidsThatNeedFetching.length > 0) {
      // For each UID that hasn't been fetched yet, initiate the fetch.
      // fetchAndCacheUserProfile will update usersCache, triggering Effect 3.
      uidsThatNeedFetching.forEach(uid => {
        fetchAndCacheUserProfile(uid);
      });
    }
  }, [isOpen, currentUser, friendUIDs, fetchAndCacheUserProfile]); // Note: usersCache is NOT a dependency here


  // Effect 3: Rebuild friendsList and manage isLoadingFriends state
  // This effect runs when isOpen, friendUIDs, or usersCache changes.
  useEffect(() => {
    if (!isOpen) {
      setFriendsList([]);
      setIsLoadingFriends(false); // Reset when dialog is closed
      return;
    }

    // Build the list of displayable friends from the current cache
    const newFriendsList = friendUIDs
      .map(uid => {
        const profile = usersCache[uid]; // usersCache[uid] can be UserProfileData or null
        if (profile) { // Check if profile is truthy (i.e., not null and not undefined)
          return {
            id: uid,
            username: profile.username,
            displayName: profile.displayName,
            avatar: profile.avatar,
            nameColor: profile.nameColor,
          };
        }
        return null; // If profile is null (fetch failed/not found) or undefined (not yet fetched)
      })
      .filter(f => f !== null) as Friend[]; // Filter out nulls
    setFriendsList(newFriendsList);

    // Determine the loading state
    if (friendUIDs.length > 0) {
      // True if any friendUID is still 'undefined' in usersCache (meaning its fetch hasn't completed or been attempted)
      const stillLoading = friendUIDs.some(uid => usersCache[uid] === undefined);
      setIsLoadingFriends(stillLoading);
    } else {
      setIsLoadingFriends(false); // No friends to load
    }
  }, [isOpen, friendUIDs, usersCache]);


  // Effect 4: Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setGCName('');
      setSelectedFriends([]);
      setIsCreatingGC(false);
      // setUsersCache({}); // Optionally clear cache, or keep for faster re-open.
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
                    {(currentUser && friendUIDs.length === 0 && !isLoadingFriends) ? "You have no friends to invite yet." : "Could not load friends list or no friends found."}
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
