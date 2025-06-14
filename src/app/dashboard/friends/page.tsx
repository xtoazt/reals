
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, UserCheck, UserX, Search, Loader2, Users, MessageSquare, ShieldOff, Circle, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { auth, database } from "@/lib/firebase";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { ref, onValue, off, set, remove, serverTimestamp, get, query, update, runTransaction, increment } from "firebase/database";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface FriendRequestData { // Raw data from Firebase for a request
  senderUsername: string;
  senderUid: string;
  timestamp: number;
  status: 'pending';
}

interface FriendRequest { // Processed request with full profile
  id: string; // senderUid
  senderUsername: string;
  senderAvatar?: string;
  senderNameColor?: string;
  senderIsShinyGold?: boolean;
  senderIsShinySilver?: boolean;
  senderIsAdmin?: boolean;
  timestamp: number;
}

interface FriendData { // Raw data for a friend relationship
    since: number;
}

interface Friend { // Processed friend with full profile
  id: string; // friendUid
  username: string;
  displayName: string;
  avatar?: string;
  nameColor?: string;
  isShinyGold?: boolean;
  isShinySilver?: boolean;
  isAdmin?: boolean;
  isOnline?: boolean;
  lastChanged?: number;
}

interface UserProfileData {
    uid: string;
    username: string;
    displayName: string;
    avatar?: string;
    nameColor?: string;
    isShinyGold?: boolean;
    isShinySilver?: boolean;
    isAdmin?: boolean;
    friendsCount?: number;
}

interface PresenceData {
    isOnline: boolean;
    lastChanged: number;
}

export default function FriendsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfileData | null>(null);

  const [friendUsernameToAdd, setFriendUsernameToAdd] = useState('');
  const [isLoadingAddFriend, setIsLoadingAddFriend] = useState(false);

  const [rawFriendRequests, setRawFriendRequests] = useState<Record<string, FriendRequestData>>({});
  const [rawFriends, setRawFriends] = useState<Record<string, FriendData>>({});
  const [usersCache, setUsersCache] = useState<Record<string, UserProfileData | null>>({});

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);

  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);

  // Use useCallback for fetchAndCacheUserProfile to stabilize its reference
  const fetchAndCacheUserProfile = useCallback(async (uid: string): Promise<UserProfileData | null> => {
    // Removed usersCache from dependencies here, as it's a "write-only" from this function's perspective
    // The actual state update is done via setUsersCache, which is stable.
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const profile: UserProfileData = {
          uid,
          username: userData.username,
          displayName: userData.displayName || userData.username, 
          avatar: userData.avatar,
          nameColor: userData.nameColor,
          isShinyGold: userData.isShinyGold || false,
          isShinySilver: userData.isShinySilver || false,
          isAdmin: userData.isAdmin || false,
          friendsCount: userData.friendsCount,
        };
        setUsersCache(prev => ({ ...prev, [uid]: profile }));
        return profile;
      } else {
        setUsersCache(prev => ({ ...prev, [uid]: null }));
        return null;
      }
    } catch (error) {
      console.error(`Error fetching user profile for ${uid}:`, error);
      setUsersCache(prev => ({ ...prev, [uid]: null }));
      return null;
    }
  }, []); // Empty dependency array means this function's reference is stable

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setCurrentUserProfile(null);
        setRawFriendRequests({});
        setRawFriends({});
        // setUsersCache({}); // Consider if cache should persist across logout/login
        setFriendRequests([]);
        setFriends([]);
        setIsLoadingRequests(false);
        setIsLoadingFriends(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Fetch current user's profile if logged in and not in cache
    if (currentUser?.uid && usersCache[currentUser.uid] === undefined) {
      fetchAndCacheUserProfile(currentUser.uid);
    }
  }, [currentUser?.uid, usersCache, fetchAndCacheUserProfile]); // Depend on currentUser.uid

  useEffect(() => {
    // Set current user profile from cache once available
    if (currentUser && usersCache[currentUser.uid]) {
      setCurrentUserProfile(usersCache[currentUser.uid]);
    } else if (!currentUser) { 
      setCurrentUserProfile(null);
    }
  }, [currentUser, usersCache]);


  useEffect(() => {
    if (!currentUser?.uid) {
      setRawFriendRequests({});
      setIsLoadingRequests(false);
      return;
    }
    const requestsRef = ref(database, `friend_requests/${currentUser.uid}`);
    setIsLoadingRequests(true);
    const listener = onValue(requestsRef, (snapshot) => {
      const requestsData = snapshot.val() as Record<string, FriendRequestData> | null;
      setRawFriendRequests(requestsData || {});
    }, (error) => {
      console.error("Error fetching friend requests:", error);
      toast({ title: "Error", description: "Could not load friend requests.", variant: "destructive" });
      setRawFriendRequests({});
      setIsLoadingRequests(false);
    });
    return () => off(requestsRef, 'value', listener);
  }, [currentUser?.uid, toast]);

  useEffect(() => {
    const requestUids = Object.keys(rawFriendRequests);
    const uidsToFetchFromRequests = requestUids.filter(uid => usersCache[uid] === undefined);

    if (uidsToFetchFromRequests.length > 0) {
      Promise.allSettled(uidsToFetchFromRequests.map(uid => fetchAndCacheUserProfile(uid)));
    }

    const processedRequests: FriendRequest[] = [];
    let allRequestProfilesLoaded = true;

    if (requestUids.length > 0) {
        for (const senderUid in rawFriendRequests) {
            if (rawFriendRequests[senderUid]?.status !== 'pending') continue;
            const requestData = rawFriendRequests[senderUid];
            const senderProfile = usersCache[senderUid];

            if (senderProfile === undefined) {
                allRequestProfilesLoaded = false;
                continue; 
            }
            if (senderProfile) {
                processedRequests.push({
                    id: senderUid,
                    senderUsername: senderProfile.username || requestData.senderUsername || "Unknown User",
                    senderAvatar: senderProfile.avatar,
                    senderNameColor: senderProfile.nameColor,
                    senderIsShinyGold: senderProfile.isShinyGold || false,
                    senderIsShinySilver: senderProfile.isShinySilver || false,
                    senderIsAdmin: senderProfile.isAdmin || false,
                    timestamp: requestData.timestamp,
                });
            }
        }
    }
    
    setFriendRequests(processedRequests.sort((a, b) => b.timestamp - a.timestamp));
    
    if (requestUids.length === 0) {
        setIsLoadingRequests(false);
    } else {
        setIsLoadingRequests(!allRequestProfilesLoaded);
    }
  }, [rawFriendRequests, usersCache, fetchAndCacheUserProfile]);


  useEffect(() => {
    if (!currentUser?.uid) {
      setRawFriends({});
      setIsLoadingFriends(false);
      return;
    }
    const friendsDbRef = ref(database, `friends/${currentUser.uid}`);
    setIsLoadingFriends(true);
    const listener = onValue(friendsDbRef, (snapshot) => {
      const friendsData = snapshot.val() as Record<string, FriendData> | null;
      setRawFriends(friendsData || {});
    }, (error) => {
      console.error("Error fetching friends list:", error);
      toast({ title: "Error", description: "Could not load friends list.", variant: "destructive" });
      setRawFriends({});
      setIsLoadingFriends(false);
    });
    return () => off(friendsDbRef, 'value', listener);
  }, [currentUser?.uid, toast]);

  useEffect(() => {
    const friendUids = Object.keys(rawFriends);
    const uidsToFetchFromFriends = friendUids.filter(uid => usersCache[uid] === undefined);

    if (uidsToFetchFromFriends.length > 0) {
      Promise.allSettled(uidsToFetchFromFriends.map(uid => fetchAndCacheUserProfile(uid)));
    }

    const processedFriends: Friend[] = [];
    let allFriendProfilesLoaded = true;

    if (friendUids.length > 0) {
        for (const friendUid in rawFriends) {
            const friendProfile = usersCache[friendUid];
            if (friendProfile === undefined) {
                allFriendProfilesLoaded = false;
                continue;
            }
            if (friendProfile) {
                processedFriends.push({
                    id: friendUid,
                    username: friendProfile.username,
                    displayName: friendProfile.displayName,
                    avatar: friendProfile.avatar,
                    nameColor: friendProfile.nameColor,
                    isShinyGold: friendProfile.isShinyGold || false,
                    isShinySilver: friendProfile.isShinySilver || false,
                    isAdmin: friendProfile.isAdmin || false,
                    isOnline: false, 
                });
            }
        }
    }
    setFriends(processedFriends);

    if (friendUids.length === 0) {
        setIsLoadingFriends(false);
    } else {
        setIsLoadingFriends(!allFriendProfilesLoaded);
    }
  }, [rawFriends, usersCache, fetchAndCacheUserProfile]);

  const memoizedFriendsForPresence = useMemo(() => friends.map(f => ({ id: f.id, isOnline: f.isOnline, lastChanged: f.lastChanged })), [friends]);

  useEffect(() => {
    if (memoizedFriendsForPresence.length === 0) return;

    const presenceListeners: Record<string, () => void> = {};
    memoizedFriendsForPresence.forEach(friend => {
      const presenceRef = ref(database, `/presence/${friend.id}`);
      const listener = onValue(presenceRef, (presenceSnap) => {
        const presenceData = presenceSnap.val() as PresenceData | null;
        setFriends(prevFriends =>
          prevFriends.map(f =>
            f.id === friend.id
              ? { ...f, isOnline: presenceData?.isOnline || false, lastChanged: presenceData?.lastChanged }
              : f
          )
        );
      });
      presenceListeners[friend.id] = () => off(presenceRef, 'value', listener);
    });

    return () => {
      Object.values(presenceListeners).forEach(unsubscribe => unsubscribe());
    };
  }, [memoizedFriendsForPresence]);


  const generateDmChatId = (uid1: string, uid2: string): string => {
    const ids = [uid1, uid2].sort();
    return `dm_${ids[0]}_${ids[1]}`;
  };

  const handleAddFriend = async () => {
    if (!friendUsernameToAdd.trim()) {
      toast({ title: "Error", description: "Please enter a username.", variant: "destructive" });
      return;
    }
    if (!currentUser || !currentUserProfile) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (friendUsernameToAdd.trim().toLowerCase() === currentUserProfile.username.toLowerCase()) {
      toast({ title: "Error", description: "You cannot add yourself as a friend.", variant: "destructive" });
      return;
    }

    setIsLoadingAddFriend(true);
    try {
      const usernameRef = ref(database, `usernames/${friendUsernameToAdd.trim().toLowerCase()}`);
      const usernameSnapshot = await get(usernameRef);

      if (!usernameSnapshot.exists()) {
        toast({ title: "User Not Found", description: `User "${friendUsernameToAdd}" does not exist.`, variant: "destructive" });
        setIsLoadingAddFriend(false);
        return;
      }

      const targetUid = usernameSnapshot.val();

      const blockedByTargetRef = ref(database, `users_blocked_by/${currentUser.uid}/${targetUid}`);
      const blockedByTargetSnap = await get(blockedByTargetRef);
      if (blockedByTargetSnap.exists()) {
        toast({ title: "Cannot Add Friend", description: `You cannot send a friend request to this user at this time.`, variant: "destructive" });
        setIsLoadingAddFriend(false);
        return;
      }

      const targetBlockedByMeRef = ref(database, `blocked_users/${currentUser.uid}/${targetUid}`);
      const targetBlockedByMeSnap = await get(targetBlockedByMeRef);
      if (targetBlockedByMeSnap.exists()) {
        toast({ title: "Unblock User", description: `You have blocked ${friendUsernameToAdd}. Unblock them to send a friend request.`, variant: "destructive" });
        setIsLoadingAddFriend(false);
        return;
      }

      const friendCheckRef = ref(database, `friends/${currentUser.uid}/${targetUid}`);
      const friendSnapshot = await get(friendCheckRef);
      if(friendSnapshot.exists()){
        toast({ title: "Already Friends", description: `You are already friends with ${friendUsernameToAdd}.`});
        setIsLoadingAddFriend(false);
        setFriendUsernameToAdd('');
        return;
      }

      const sentRequestRef = ref(database, `friend_requests/${targetUid}/${currentUser.uid}`);
      const sentSnapshot = await get(sentRequestRef);
      if(sentSnapshot.exists()){
         toast({ title: "Request Already Sent", description: `You already sent a friend request to ${friendUsernameToAdd}.`});
         setIsLoadingAddFriend(false);
         setFriendUsernameToAdd('');
         return;
      }
      const receivedRequestRef = ref(database, `friend_requests/${currentUser.uid}/${targetUid}`);
      const receivedSnapshot = await get(receivedRequestRef);
      if(receivedSnapshot.exists()){
         toast({ title: "Request Exists", description: `${friendUsernameToAdd} has already sent you a friend request. Check your incoming requests.`});
         setIsLoadingAddFriend(false);
         setFriendUsernameToAdd('');
         return;
      }

      const requestPayloadRef = ref(database, `friend_requests/${targetUid}/${currentUser.uid}`);
      await set(requestPayloadRef, {
        senderUsername: currentUserProfile.username,
        senderUid: currentUser.uid,
        timestamp: serverTimestamp(),
        status: "pending"
      });

      toast({ title: "Friend Request Sent", description: `Friend request sent to ${friendUsernameToAdd}.` });
      setFriendUsernameToAdd('');
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      toast({ title: "Error", description: `Could not send friend request: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingAddFriend(false);
    }
  };

  const handleAcceptRequest = async (senderUid: string, senderUsername: string) => {
    if (!currentUser) return;

    const iBlockedSenderRef = ref(database, `blocked_users/${currentUser.uid}/${senderUid}`);
    const iBlockedSenderSnap = await get(iBlockedSenderRef);
    if (iBlockedSenderSnap.exists()) {
        toast({ title: "Cannot Accept", description: `You have blocked ${senderUsername}. Unblock them to accept.`, variant: "destructive" });
        return;
    }
    const senderBlockedMeRef = ref(database, `users_blocked_by/${currentUser.uid}/${senderUid}`);
    const senderBlockedMeSnap = await get(senderBlockedMeRef);
    if (senderBlockedMeSnap.exists()) {
        toast({ title: "Cannot Accept", description: `${senderUsername} has blocked you.`, variant: "destructive" });
        const requestToRemoveRef = ref(database, `friend_requests/${currentUser.uid}/${senderUid}`);
        await remove(requestToRemoveRef);
        return;
    }

    try {
      const updates: { [key: string]: any } = {};
      const friendData = { since: serverTimestamp() };

      updates[`/friends/${currentUser.uid}/${senderUid}`] = friendData;
      updates[`/friends/${senderUid}/${currentUser.uid}`] = friendData;
      updates[`/friend_requests/${currentUser.uid}/${senderUid}`] = null;

      const currentUserFriendsCountRef = ref(database, `users/${currentUser.uid}/friendsCount`);
      const senderFriendsCountRef = ref(database, `users/${senderUid}/friendsCount`);

      await update(ref(database), updates);

      await runTransaction(currentUserFriendsCountRef, (currentCount) => (currentCount || 0) + 1);
      await runTransaction(senderFriendsCountRef, (currentCount) => (currentCount || 0) + 1);

      toast({ title: "Friend Request Accepted", description: `You are now friends with ${senderUsername}.`});
    } catch (error: any) {
      console.error("Error accepting friend request:", error);
      toast({ title: "Error", description: `Could not accept friend request: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeclineRequest = async (senderUid: string) => {
    if (!currentUser) return;
    try {
      const requestToRemoveRef = ref(database, `friend_requests/${currentUser.uid}/${senderUid}`);
      await remove(requestToRemoveRef);
      toast({ title: "Friend Request Declined", description: `Friend request declined.`});
    } catch (error: any) {
      console.error("Error declining friend request:", error);
      toast({ title: "Error", description: `Could not decline friend request: ${error.message}`, variant: "destructive" });
    }
  };

  const handleBlockUser = async (friendUid: string, friendUsername: string) => {
    if (!currentUser || !currentUserProfile) return;
    if (currentUser.uid === friendUid) {
        toast({ title: "Error", description: "You cannot block yourself.", variant: "destructive" });
        return;
    }

    toast({
        title: `Blocking ${friendUsername}`,
        description: "This will remove them as a friend and prevent further interaction.",
    });

    try {
        const updates: { [key: string]: any } = {};
        updates[`/blocked_users/${currentUser.uid}/${friendUid}`] = true;
        updates[`/users_blocked_by/${friendUid}/${currentUser.uid}`] = true;

        const areFriendsRef = ref(database, `friends/${currentUser.uid}/${friendUid}`);
        const areFriendsSnap = await get(areFriendsRef);
        const wereFriends = areFriendsSnap.exists();

        updates[`/friends/${currentUser.uid}/${friendUid}`] = null;
        updates[`/friends/${friendUid}/${currentUser.uid}`] = null;

        updates[`/friend_requests/${currentUser.uid}/${friendUid}`] = null;
        updates[`/friend_requests/${friendUid}/${currentUser.uid}`] = null;

        await update(ref(database), updates);

        if (wereFriends) {
            const currentUserFriendsCountRef = ref(database, `users/${currentUser.uid}/friendsCount`);
            const targetUserFriendsCountRef = ref(database, `users/${friendUid}/friendsCount`);
            await runTransaction(currentUserFriendsCountRef, (currentCount) => Math.max(0, (currentCount || 0) - 1));
            await runTransaction(targetUserFriendsCountRef, (currentCount) => Math.max(0, (currentCount || 0) - 1));
        }

        toast({ title: "User Blocked", description: `You have blocked ${friendUsername}. They have been removed from your friends list.` });
    } catch (error: any) {
        console.error("Error blocking user:", error);
        toast({ title: "Error", description: `Could not block user: ${error.message}`, variant: "destructive" });
    }
  };

  const handleViewProfile = (username: string) => {
    router.push(`/dashboard/profile/${username}`);
  };


  return (
    <div className="space-y-6">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="font-headline">Manage Friends</CardTitle>
          <CardDescription>Connect with others on real.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Username to add friend"
              className="flex-1"
              value={friendUsernameToAdd}
              onChange={(e) => setFriendUsernameToAdd(e.target.value)}
              disabled={isLoadingAddFriend || !currentUser || !currentUserProfile?.username}
            />
            <Button onClick={handleAddFriend} disabled={isLoadingAddFriend || !currentUser || !currentUserProfile?.username || !friendUsernameToAdd.trim()} className="transition-colors">
              {isLoadingAddFriend ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Add Friend
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all-friends">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all-friends">All Friends ({friends.length})</TabsTrigger>
          <TabsTrigger value="friend-requests">
            Friend Requests
            {friendRequests.length > 0 &&
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-primary-foreground bg-primary rounded-full">{friendRequests.length}</span>
            }
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all-friends">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Your Friends ({friends.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoadingFriends ? (
                 <div className="col-span-full flex justify-center items-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
              ) : friends.length === 0 ? (
                <p className="col-span-full text-muted-foreground text-center py-4">You haven't added any friends yet.</p>
              ) : (
                friends.map(friend => {
                  let nameClass = "";
                  let nameStyle = {};
                  if (friend.isShinyGold) {
                    nameClass = 'text-shiny-gold';
                  } else if (friend.isShinySilver) {
                    nameClass = 'text-shiny-silver';
                  } else if (friend.nameColor) {
                    nameStyle = { color: friend.nameColor };
                  } else {
                    nameStyle = { color: 'hsl(var(--foreground))' };
                  }

                  return (
                  <Card key={friend.id} className="p-4 flex flex-col space-y-3 shadow-sm transition-all duration-150 ease-in-out hover:shadow-lg">
                    <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12 cursor-pointer relative" onClick={() => handleViewProfile(friend.username)}>
                        <AvatarImage src={friend.avatar} alt={friend.displayName} data-ai-hint="profile avatar" />
                        <AvatarFallback>{friend.displayName.charAt(0)}</AvatarFallback>
                        <Circle className={cn(
                            "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background",
                            friend.isOnline ? "fill-green-500 stroke-green-600" : "fill-gray-400 stroke-gray-500"
                         )} />
                        </Avatar>
                        <div className="flex-1">
                        <p
                            className={cn("font-semibold cursor-pointer hover:underline", nameClass)}
                            style={nameStyle}
                            onClick={() => handleViewProfile(friend.username)}
                        >
                            {friend.displayName}
                            {friend.isAdmin && <ShieldCheck className="inline-block ml-1.5 h-4 w-4 text-destructive" />}
                        </p>
                        <p className="text-xs text-muted-foreground">@{friend.username}</p>
                        <p className={`text-xs ${friend.isOnline ? 'text-green-500' : 'text-muted-foreground'}`}>{friend.isOnline ? 'Online' : 'Offline'}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full pt-2">
                        <Button variant="outline" size="sm" className="flex-1 transition-colors" onClick={() => handleViewProfile(friend.username)}>
                            <Users className="mr-2 h-3 w-3"/> Profile
                        </Button>
                        <Link href={`/dashboard/chat/${currentUser ? generateDmChatId(currentUser.uid, friend.id) : '#'}`} passHref className="flex-1">
                             <Button variant="default" size="sm" className="w-full transition-colors" disabled={!currentUser}>
                                <MessageSquare className="mr-2 h-3 w-3"/> Chat
                            </Button>
                        </Link>
                    </div>
                     <Button variant="destructive" size="sm" className="w-full justify-center transition-colors" onClick={() => handleBlockUser(friend.id, friend.username)}>
                        <UserX className="mr-1 h-4 w-4" /> Block & Remove
                    </Button>
                  </Card>
                )})
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="friend-requests">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader><CardTitle>Incoming Requests ({friendRequests.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isLoadingRequests ? (
                <div className="flex justify-center items-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
              ) : friendRequests.length === 0 ? (
                <p className="text-muted-foreground">No new friend requests.</p>
              ) : (
                friendRequests.map(request => {
                  let nameClass = "";
                  let nameStyle = {};
                  if (request.senderIsShinyGold) {
                    nameClass = 'text-shiny-gold';
                  } else if (request.senderIsShinySilver) {
                    nameClass = 'text-shiny-silver';
                  } else if (request.senderNameColor) {
                    nameStyle = { color: request.senderNameColor };
                  } else {
                     nameStyle = { color: 'hsl(var(--foreground))' };
                  }

                  return (
                  <Card key={request.id} className="p-4 flex items-center justify-between shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10 cursor-pointer" onClick={() => handleViewProfile(request.senderUsername)}>
                        <AvatarImage src={request.senderAvatar} alt={request.senderUsername} data-ai-hint="profile avatar" />
                        <AvatarFallback>{request.senderUsername.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p
                            className={cn("font-medium cursor-pointer hover:underline", nameClass)}
                            style={nameStyle}
                            onClick={() => handleViewProfile(request.senderUsername)}
                        >
                            {request.senderUsername}
                            {request.senderIsAdmin && <ShieldCheck className="inline-block ml-1.5 h-3.5 w-3.5 text-destructive" />}
                        </p>
                        <p className="text-xs text-muted-foreground">wants to be your friend.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-100 transition-colors" onClick={() => handleAcceptRequest(request.id, request.senderUsername)}><UserCheck className="mr-1 h-4 w-4" /> Accept</Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-100 transition-colors" onClick={() => handleDeclineRequest(request.id)}><UserX className="mr-1 h-4 w-4" /> Decline</Button>
                    </div>
                  </Card>
                )})
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

    