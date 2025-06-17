
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Shield, UserPlus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, database } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { ref, get, push, serverTimestamp, update } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface FriendForDialog {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
}

interface UserProfileData {
    uid: string;
    username: string;
    displayName: string;
    avatar?: string;
}

interface CreateTeamDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  propsCurrentUser: FirebaseUser | null;
}

export function CreateTeamDialog({ isOpen, onOpenChange, propsCurrentUser }: CreateTeamDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [friendsToDisplay, setFriendsToDisplay] = useState<FriendForDialog[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfileData | null> => {
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        return {
          uid,
          username: userData.username,
          displayName: userData.displayName || userData.username,
          avatar: userData.avatar,
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching user profile for ${uid}:`, error);
      return null;
    }
  }, []);

  const loadFriends = useCallback(async () => {
    if (!propsCurrentUser?.uid) {
      setFriendsToDisplay([]);
      setIsLoadingFriends(false);
      return;
    }

    setIsLoadingFriends(true);
    setFriendsToDisplay([]); // Clear previous friends

    try {
      const friendsRef = ref(database, `friends/${propsCurrentUser.uid}`);
      const snapshot = await get(friendsRef);
      if (snapshot.exists()) {
        const friendUids = Object.keys(snapshot.val());
        const friendProfilesPromises = friendUids.map(uid => fetchUserProfile(uid));
        const resolvedProfiles = await Promise.all(friendProfilesPromises);
        
        if (!isOpenRef.current) return; // Check if dialog is still open

        const validProfiles = resolvedProfiles.filter(p => p !== null) as UserProfileData[];
        setFriendsToDisplay(validProfiles.map(p => ({
            id: p.uid,
            username: p.username,
            displayName: p.displayName,
            avatar: p.avatar
        })));
      } else {
        if (isOpenRef.current) setFriendsToDisplay([]);
      }
    } catch (error) {
      console.error("Error loading friends for team creation:", error);
      if (isOpenRef.current) {
        toast({ title: "Error", description: "Could not load friends list.", variant: "destructive" });
        setFriendsToDisplay([]);
      }
    } finally {
      if (isOpenRef.current) setIsLoadingFriends(false);
    }
  }, [propsCurrentUser?.uid, fetchUserProfile, toast]);

  useEffect(() => {
    if (isOpen && propsCurrentUser?.uid) {
      // Reset states when dialog opens
      setTeamName('');
      setSelectedFriends(new Set());
      setSearchTerm('');
      // setIsLoadingFriends(true); // Moved into loadFriends
      // setFriendsToDisplay([]); // Moved into loadFriends
      loadFriends();
    } else if (!isOpen) {
      // Optional: Reset states when dialog closes if desired, though re-opening will also reset.
      // setIsLoadingFriends(false); // Ensure loading is off if closed mid-load
    }
  }, [isOpen, propsCurrentUser?.uid, loadFriends]);


  const handleToggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!teamName.trim()) {
      toast({ title: "Team Name Required", description: "Please enter a name for your team.", variant: "destructive" });
      return;
    }
    if (selectedFriends.size === 0) {
      toast({ title: "Select Members", description: "Please select at least one friend to add to the team.", variant: "destructive" });
      return;
    }
    if (!propsCurrentUser?.uid) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }

    setIsCreatingTeam(true);
    try {
      const teamChatRef = ref(database, 'chats');
      const newTeamChatKey = push(teamChatRef).key;

      if (!newTeamChatKey) {
        throw new Error("Failed to generate new team chat key.");
      }
      
      const teamChatId = `team-${newTeamChatKey}`;

      const members: { [uid: string]: boolean } = {};
      members[propsCurrentUser.uid] = true; // Add creator to members
      selectedFriends.forEach(friendUid => {
        members[friendUid] = true;
      });

      const newTeamData = {
        teamName: teamName.trim(),
        createdBy: propsCurrentUser.uid,
        createdAt: serverTimestamp(),
        members: members,
        // messages node will be created implicitly when first message is sent
      };
      
      const updates: { [key: string]: any } = {};
      updates[`/chats/${teamChatId}`] = newTeamData;

      await update(ref(database), updates);

      toast({ title: "Team Created!", description: `Team "${teamName}" has been created.` });
      onOpenChange(false); // Close dialog
      router.push(`/dashboard/chat/${teamChatId}`); // Navigate to new team chat

    } catch (error: any) {
      console.error("Error creating team:", error);
      toast({ title: "Team Creation Failed", description: error.message || "Could not create team.", variant: "destructive" });
    } finally {
      setIsCreatingTeam(false);
    }
  };
  
  const filteredFriends = friendsToDisplay.filter(friend => 
    friend.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!propsCurrentUser) {
      return null; // Or a loading/auth required state if preferred for open dialog
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center"><Shield className="mr-2 h-5 w-5 text-primary" /> Create New Team</DialogTitle>
          <DialogDescription>
            Give your team a name and invite your friends to start chatting.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2 flex-grow overflow-y-hidden flex flex-col">
          <div>
            <Label htmlFor="teamName">Team Name</Label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="E.g., Project Squad, Gaming Crew"
              disabled={isCreatingTeam}
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="searchFriends">Invite Friends ({selectedFriends.size} selected)</Label>
            <Input 
              id="searchFriends"
              placeholder="Search friends..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
              disabled={isCreatingTeam || isLoadingFriends}
            />
            <ScrollArea className="h-[200px] md:h-[250px] border rounded-md">
              <div className="p-2 space-y-1">
                {isLoadingFriends ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {friendsToDisplay.length === 0 ? "You have no friends to invite yet." : "No friends match your search."}
                  </p>
                ) : (
                  filteredFriends.map(friend => (
                    <div
                      key={friend.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer",
                        selectedFriends.has(friend.id) && "bg-primary/10"
                      )}
                      onClick={() => !isCreatingTeam && handleToggleFriendSelection(friend.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={friend.avatar} alt={friend.displayName} data-ai-hint="friend avatar" />
                          <AvatarFallback>{friend.displayName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{friend.displayName}</p>
                          <p className="text-xs text-muted-foreground">@{friend.username}</p>
                        </div>
                      </div>
                      <Checkbox
                        checked={selectedFriends.has(friend.id)}
                        onCheckedChange={() => handleToggleFriendSelection(friend.id)}
                        aria-label={`Select ${friend.displayName}`}
                        disabled={isCreatingTeam}
                      />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="mt-auto pt-4 border-t">
          <DialogClose asChild>
            <Button variant="outline" disabled={isCreatingTeam}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isCreatingTeam || !teamName.trim() || selectedFriends.size === 0}>
            {isCreatingTeam ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Create Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
