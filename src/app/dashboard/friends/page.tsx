
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, UserCheck, UserX, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import React, { useState } from "react";

const mockFriends = [
  { id: '1', name: 'Alice Wonderland', avatar: 'https://placehold.co/80x80/E6A4B4/FFFFFF.png?text=A', status: 'Online', username: 'aliceW', nameColor: '#E6A4B4' },
  { id: '2', name: 'Bob The Builder', avatar: 'https://placehold.co/80x80/A4B4E6/FFFFFF.png?text=B', status: 'Offline', username: 'bob_builder' },
  { id: '3', name: 'Charlie Brown', avatar: 'https://placehold.co/80x80/E6D4A4/FFFFFF.png?text=C', status: 'Online', username: 'charlieB', nameColor: '#E6D4A4' },
];

const mockRequests = [
  { id: '4', name: 'David Copperfield', avatar: 'https://placehold.co/80x80/A4E6D4/FFFFFF.png?text=D', username: 'david_magic' },
];

export default function FriendsPage() {
  const { toast } = useToast();
  const [friendUsername, setFriendUsername] = useState('');

  const handleAddFriend = () => {
    if (!friendUsername.trim()) {
      toast({ title: "Error", description: "Please enter a username.", variant: "destructive" });
      return;
    }
    // Mock logic: show a toast, in a real app, this would send a request
    toast({ title: "Friend Request Sent", description: `Friend request sent to ${friendUsername}.` });
    setFriendUsername(''); // Clear input
  };
  
  const handleViewProfile = (name: string) => {
    toast({ title: "View Profile", description: `Clicked to view profile of ${name} (UI only).` });
  };

  const handleAcceptRequest = (name: string) => {
    toast({ title: "Friend Request Accepted", description: `You are now friends with ${name} (UI only).`});
    // In real app: update mockRequests or fetch new data
  };
  const handleDeclineRequest = (name: string) => {
    toast({ title: "Friend Request Declined", description: `Declined friend request from ${name} (UI only).`});
    // In real app: update mockRequests or fetch new data
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
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
            />
            <Button onClick={handleAddFriend}><UserPlus className="mr-2 h-4 w-4" /> Add Friend</Button>
          </div>
           <p className="text-xs text-muted-foreground">User ID is no longer used for adding friends. Use their unique username.</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="all-friends">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all-friends">All Friends</TabsTrigger>
          <TabsTrigger value="friend-requests">Friend Requests <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-primary-foreground bg-primary rounded-full">{mockRequests.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="all-friends">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Your Friends ({mockFriends.length})</CardTitle>
                <div className="relative w-1/3">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search friends..." className="pl-8" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockFriends.map(friend => (
                <Card key={friend.id} className="p-4 flex items-center space-x-4 shadow-sm">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={friend.avatar} alt={friend.name} data-ai-hint="profile avatar" />
                    <AvatarFallback>{friend.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold" style={{ color: friend.nameColor || 'hsl(var(--foreground))' }}>{friend.name}</p>
                    <p className="text-xs text-muted-foreground">@{friend.username}</p>
                    <p className={`text-xs ${friend.status === 'Online' ? 'text-green-500' : 'text-muted-foreground'}`}>{friend.status}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleViewProfile(friend.name)}>View Profile</Button>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="friend-requests">
          <Card>
            <CardHeader><CardTitle>Incoming Requests ({mockRequests.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {mockRequests.length > 0 ? mockRequests.map(request => (
                <Card key={request.id} className="p-4 flex items-center justify-between shadow-sm">
                   <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={request.avatar} alt={request.name} data-ai-hint="profile avatar" />
                      <AvatarFallback>{request.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{request.name}</p>
                      <p className="text-xs text-muted-foreground">@{request.username} wants to be your friend.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => handleAcceptRequest(request.name)}><UserCheck className="mr-1 h-4 w-4" /> Accept</Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleDeclineRequest(request.name)}><UserX className="mr-1 h-4 w-4" /> Decline</Button>
                  </div>
                </Card>
              )) : <p className="text-muted-foreground">No new friend requests.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

