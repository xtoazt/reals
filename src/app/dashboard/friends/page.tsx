
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, UserCheck, UserX, Search, Loader2, Users, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import React, { useState, useEffect, useCallback } from "react";
import { auth, database } from "@/lib/firebase";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { ref, onValue, off, set, remove, serverTimestamp, get, query, orderByChild, equalTo } from "firebase/database";
import Link from "next/link";

interface FriendRequest {
  id: string; // sender's UID
  senderUsername: string;
  senderAvatar?: string;
  senderNameColor?: string;
  timestamp: number;
}

interface Friend {
  id: string; // friend's UID
  username: string;
  displayName: string;
  avatar?: string;
  nameColor?: string;
  status?: string; // For UI, mock for now
}

interface UserProfileData {
    uid: string;
    username: string;
    displayName: string;
    avatar?: string;
    nameColor?: string;
}


export default function FriendsPage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfileData | null>(null);
  
  const [friendUsernameToAdd, setFriendUsernameToAdd] = useState('');
  const [isLoadingAddFriend, setIsLoadingAddFriend] = useState(false);

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);

  const [usersCache, setUsersCache] = useState<{[uid: string]: UserProfileData}>({});

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
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchUserProfile(user.uid).then(profile => {
            if(profile) setCurrentUserProfile(profile);
        });
      } else {
        setCurrentUserProfile(null);
        setFriendRequests([]);
        setFriends([]);
        setIsLoadingRequests(false);
        setIsLoadingFriends(false);
      }
    });
    return () => unsubscribeAuth();
  }, [fetchUserProfile]);

  // Fetch Friend Requests
  useEffect(() => {
    if (!currentUser) return;
    setIsLoadingRequests(true);
    const requestsRef = ref(database, `friend_requests/${currentUser.uid}`);
    const listener = onValue(requestsRef, async (snapshot) => {
      const requestsData = snapshot.val();
      if (requestsData) {
        const loadedRequests: FriendRequest[] = [];
        for (const senderUid in requestsData) {
          const request = requestsData[senderUid];
          const senderProfile = await fetchUserProfile(senderUid);
          loadedRequests.push({
            id: senderUid,
            senderUsername: senderProfile?.username || request.senderUsername || "Unknown User",
            senderAvatar: senderProfile?.avatar,
            senderNameColor: senderProfile?.nameColor,
            timestamp: request.timestamp,
          });
        }
        setFriendRequests(loadedRequests.sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setFriendRequests([]);
      }
      setIsLoadingRequests(false);
    }, (error) => {
        console.error("Error fetching friend requests:", error);
        toast({title: "Error", description: "Could not load friend requests.", variant: "destructive"});
        setIsLoadingRequests(false);
    });
    return () => off(requestsRef, 'value', listener);
  }, [currentUser, fetchUserProfile, toast]);

  // Fetch Friends
  useEffect(() => {
    if (!currentUser) return;
    setIsLoadingFriends(true);
    const friendsRef = ref(database, `friends/${currentUser.uid}`);
    const listener = onValue(friendsRef, async (snapshot) => {
      const friendsData = snapshot.val();
      if (friendsData) {
        const loadedFriends: Friend[] = [];
        for (const friendUid in friendsData) {
          // const friendInfo = friendsData[friendUid]; // Contains { since: timestamp }
          const profile = await fetchUserProfile(friendUid);
          if (profile) {
            loadedFriends.push({
              id: friendUid,
              username: profile.username,
              displayName: profile.displayName,
              avatar: profile.avatar,
              nameColor: profile.nameColor,
              status: Math.random() > 0.5 ? 'Online' : 'Offline', // Mock status
            });
          }
        }
        setFriends(loadedFriends);
      } else {
        setFriends([]);
      }
      setIsLoadingFriends(false);
    }, (error) => {
        console.error("Error fetching friends:", error);
        toast({title: "Error", description: "Could not load friends list.", variant: "destructive"});
        setIsLoadingFriends(false);
    });
    return () => off(friendsRef, 'value', listener);
  }, [currentUser, fetchUserProfile, toast]);


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
      const snapshot = await get(usernameRef);

      if (!snapshot.exists()) {
        toast({ title: "User Not Found", description: `User "${friendUsernameToAdd}" does not exist.`, variant: "destructive" });
        setIsLoadingAddFriend(false);
        return;
      }
      
      const targetUid = snapshot.val();

      // Check if already friends
      const friendCheckRef = ref(database, `friends/${currentUser.uid}/${targetUid}`);
      const friendSnapshot = await get(friendCheckRef);
      if(friendSnapshot.exists()){
        toast({ title: "Already Friends", description: `You are already friends with ${friendUsernameToAdd}.`});
        setIsLoadingAddFriend(false);
        setFriendUsernameToAdd('');
        return;
      }

      // Check if request already sent TO this user
      const sentRequestRef = ref(database, `friend_requests/${targetUid}/${currentUser.uid}`);
      const sentSnapshot = await get(sentRequestRef);
      if(sentSnapshot.exists()){
         toast({ title: "Request Already Sent", description: `You already sent a friend request to ${friendUsernameToAdd}.`});
         setIsLoadingAddFriend(false);
         setFriendUsernameToAdd('');
         return;
      }
      // Check if request already received FROM this user
      const receivedRequestRef = ref(database, `friend_requests/${currentUser.uid}/${targetUid}`);
      const receivedSnapshot = await get(receivedRequestRef);
      if(receivedSnapshot.exists()){
         toast({ title: "Request Exists", description: `${friendUsernameToAdd} has already sent you a friend request. Check your incoming requests.`});
         setIsLoadingAddFriend(false);
         setFriendUsernameToAdd('');
         return;
      }

      const requestRef = ref(database, `friend_requests/${targetUid}/${currentUser.uid}`);
      await set(requestRef, {
        senderUsername: currentUserProfile.username,
        senderUid: currentUser.uid, // Added for clarity, though path has it
        timestamp: serverTimestamp(),
        status: "pending" // status might not be strictly needed if structure implies pending
      });

      toast({ title: "Friend Request Sent", description: `Friend request sent to ${friendUsernameToAdd}.` });
      setFriendUsernameToAdd('');
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast({ title: "Error", description: "Could not send friend request.", variant: "destructive" });
    } finally {
      setIsLoadingAddFriend(false);
    }
  };
  
  const handleAcceptRequest = async (senderUid: string, senderUsername: string) => {
    if (!currentUser) return;
    try {
      const currentUserFriendsRef = ref(database, `friends/${currentUser.uid}/${senderUid}`);
      const senderFriendsRef = ref(database, `friends/${senderUid}/${currentUser.uid}`);
      const requestToRemoveRef = ref(database, `friend_requests/${currentUser.uid}/${senderUid}`);

      const friendData = { since: serverTimestamp() };
      await set(currentUserFriendsRef, friendData);
      await set(senderFriendsRef, friendData);
      await remove(requestToRemoveRef);

      toast({ title: "Friend Request Accepted", description: `You are now friends with ${senderUsername}.`});
    } catch (error) {
      console.error("Error accepting friend request:", error);
      toast({ title: "Error", description: "Could not accept friend request.", variant: "destructive" });
    }
  };

  const handleDeclineRequest = async (senderUid: string) => {
    if (!currentUser) return;
    try {
      const requestToRemoveRef = ref(database, `friend_requests/${currentUser.uid}/${senderUid}`);
      await remove(requestToRemoveRef);
      toast({ title: "Friend Request Declined", description: `Friend request declined.`});
    } catch (error) {
      console.error("Error declining friend request:", error);
      toast({ title: "Error", description: "Could not decline friend request.", variant: "destructive" });
    }
  };

  const handleRemoveFriend = async (friendUid: string, friendUsername: string) => {
    if (!currentUser) return;
    // Consider adding a confirmation dialog here in a real app
    try {
      const currentUserFriendEntryRef = ref(database, `friends/${currentUser.uid}/${friendUid}`);
      const otherUserFriendEntryRef = ref(database, `friends/${friendUid}/${currentUser.uid}`);

      await remove(currentUserFriendEntryRef);
      await remove(otherUserFriendEntryRef);

      toast({ title: "Friend Removed", description: `You are no longer friends with ${friendUsername}.` });
    } catch (error) {
      console.error("Error removing friend:", error);
      toast({ title: "Error", description: "Could not remove friend.", variant: "destructive" });
    }
  };

  const handleViewProfile = (username: string) => {
    toast({ title: "View Profile", description: `Clicked to view profile of @${username} (UI only).` });
    // Future: router.push(`/dashboard/profile/${username}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Manage Friends</CardTitle>
          <CardDescription>Connect with others on RealTalk by adding their username.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              placeholder="Enter Username to add friend" 
              className="flex-1" 
              value={friendUsernameToAdd}
              onChange={(e) => setFriendUsernameToAdd(e.target.value)}
              disabled={isLoadingAddFriend || !currentUser}
            />
            <Button onClick={handleAddFriend} disabled={isLoadingAddFriend || !currentUser || !friendUsernameToAdd.trim()}>
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
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Your Friends ({friends.length})</CardTitle>
                {/* <div className="relative w-1/3">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search friends..." className="pl-8" />
                </div> */}
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
                friends.map(friend => (
                  <Card key={friend.id} className="p-4 flex flex-col space-y-3 shadow-sm">
                    <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12 cursor-pointer" onClick={() => handleViewProfile(friend.username)}>
                        <AvatarImage src={friend.avatar} alt={friend.displayName} data-ai-hint="profile avatar" />
                        <AvatarFallback>{friend.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                        <p className="font-semibold cursor-pointer hover:underline" style={{ color: friend.nameColor || 'hsl(var(--foreground))' }} onClick={() => handleViewProfile(friend.username)}>{friend.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{friend.username}</p>
                        <p className={`text-xs ${friend.status === 'Online' ? 'text-green-500' : 'text-muted-foreground'}`}>{friend.status}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewProfile(friend.username)}>
                            <Users className="mr-2 h-3 w-3"/> Profile
                        </Button>
                        <Link href={`/dashboard/chat/dm-${friend.id}`} passHref className="flex-1">
                             <Button variant="default" size="sm" className="w-full">
                                <MessageSquare className="mr-2 h-3 w-3"/> Chat
                            </Button>
                        </Link>
                    </div>
                     <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-100 w-full justify-center" onClick={() => handleRemoveFriend(friend.id, friend.username)}>
                        <UserX className="mr-1 h-4 w-4" /> Remove Friend
                    </Button>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="friend-requests">
          <Card>
            <CardHeader><CardTitle>Incoming Requests ({friendRequests.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isLoadingRequests ? (
                <div className="flex justify-center items-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
              ) : friendRequests.length === 0 ? (
                <p className="text-muted-foreground">No new friend requests.</p>
              ) : (
                friendRequests.map(request => (
                  <Card key={request.id} className="p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10 cursor-pointer" onClick={() => handleViewProfile(request.senderUsername)}>
                        <AvatarImage src={request.senderAvatar} alt={request.senderUsername} data-ai-hint="profile avatar" />
                        <AvatarFallback>{request.senderUsername.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium cursor-pointer hover:underline" style={{ color: request.senderNameColor || 'hsl(var(--foreground))' }} onClick={() => handleViewProfile(request.senderUsername)}>{request.senderUsername}</p>
                        <p className="text-xs text-muted-foreground">wants to be your friend.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => handleAcceptRequest(request.id, request.senderUsername)}><UserCheck className="mr-1 h-4 w-4" /> Accept</Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleDeclineRequest(request.id)}><UserX className="mr-1 h-4 w-4" /> Decline</Button>
                    </div>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
