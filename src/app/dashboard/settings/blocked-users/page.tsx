
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, UserX, ShieldOff } from "lucide-react"; // Replaced UsersSlash with ShieldOff
import { useToast } from "@/hooks/use-toast";
import { auth, database } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { ref, onValue, off, get, update } from 'firebase/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BlockedUser {
  uid: string;
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

export default function BlockedUsersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [blockedUsersList, setBlockedUsersList] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usersCache, setUsersCache] = useState<{[uid: string]: UserProfileData}>({});

  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfileData | null> => {
    if (usersCache[uid]) return usersCache[uid];
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const profile = { 
            uid, 
            username: userData.username || 'unknown_user', 
            displayName: userData.displayName || 'Unknown User', 
            avatar: userData.avatar,
            nameColor: userData.nameColor,
        };
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
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        router.push('/auth'); 
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!currentUser) {
      setBlockedUsersList([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const blockedUsersRef = ref(database, `blocked_users/${currentUser.uid}`);
    
    const listener = onValue(blockedUsersRef, async (snapshot) => {
      const blockedUidsData = snapshot.val();
      if (blockedUidsData) {
        const uids = Object.keys(blockedUidsData);
        const profilesPromises = uids.map(uid => fetchUserProfile(uid));
        const profiles = await Promise.all(profilesPromises);
        
        const loadedBlockedUsers: BlockedUser[] = profiles
          .filter(profile => profile !== null)
          .map(profile => profile as BlockedUser); // Type assertion after filter

        setBlockedUsersList(loadedBlockedUsers);
      } else {
        setBlockedUsersList([]);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching blocked users:", error);
      toast({ title: "Error", description: "Could not load blocked users.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => off(blockedUsersRef, 'value', listener);
  }, [currentUser, fetchUserProfile, toast]);

  const handleUnblockUser = async (targetUid: string, targetUsername: string) => {
    if (!currentUser) return;
    toast({
        title: `Unblocking @${targetUsername}`,
        description: "You will be able to send/receive friend requests with them again.",
    });
    try {
        const updates: { [key: string]: any } = {};
        updates[`/blocked_users/${currentUser.uid}/${targetUid}`] = null;
        updates[`/users_blocked_by/${targetUid}/${currentUser.uid}`] = null;
        
        await update(ref(database), updates);
        toast({ title: "User Unblocked", description: `You have unblocked @${targetUsername}.` });
        // The onValue listener should automatically update the list
    } catch (error: any) {
        console.error("Error unblocking user:", error);
        toast({ title: "Error", description: `Could not unblock user: ${error.message}`, variant: "destructive" });
    }
  };
  
  const getAvatarFallbackText = (displayName?: string) => {
    return displayName ? displayName.charAt(0).toUpperCase() : 'U';
  };

  if (!currentUser && !isLoading) {
      // Should be caught by the auth listener redirect, but as a safeguard
      return <div className="flex justify-center items-center h-full"><p>Please log in.</p></div>
  }


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-headline text-2xl flex items-center">
                <ShieldOff className="mr-3 h-6 w-6 text-primary" /> {/* Replaced UsersSlash with ShieldOff */}
                Manage Blocked Users
            </CardTitle>
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
              </Link>
            </Button>
          </div>
          <CardDescription>
            Users you have blocked will appear here. You can unblock them if you wish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : blockedUsersList.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">You haven't blocked any users.</p>
          ) : (
            <div className="space-y-3">
              {blockedUsersList.map((user) => (
                <Card key={user.uid} className="p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar || `https://placehold.co/40x40.png?text=${getAvatarFallbackText(user.displayName)}`} alt={user.displayName} data-ai-hint="profile avatar" />
                      <AvatarFallback>{getAvatarFallbackText(user.displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium" style={{color: user.nameColor || 'hsl(var(--foreground))'}}>{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleUnblockUser(user.uid, user.username)}
                    className="text-primary border-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <UserX className="mr-2 h-4 w-4" /> Unblock
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
