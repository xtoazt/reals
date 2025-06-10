import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, UserCheck, UserX, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockFriends = [
  { id: '1', name: 'Alice Wonderland', avatar: 'https://placehold.co/80x80/E6A4B4/FFFFFF.png?text=A', status: 'Online' },
  { id: '2', name: 'Bob The Builder', avatar: 'https://placehold.co/80x80/A4B4E6/FFFFFF.png?text=B', status: 'Offline' },
  { id: '3', name: 'Charlie Brown', avatar: 'https://placehold.co/80x80/E6D4A4/FFFFFF.png?text=C', status: 'Online' },
];

const mockRequests = [
  { id: '4', name: 'David Copperfield', avatar: 'https://placehold.co/80x80/A4E6D4/FFFFFF.png?text=D' },
];

export default function FriendsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Manage Friends</CardTitle>
          <CardDescription>Connect with others on RealTalk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Enter User ID to add friend" className="flex-1" />
            <Button><UserPlus className="mr-2 h-4 w-4" /> Add Friend</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all-friends">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all-friends">All Friends</TabsTrigger>
          <TabsTrigger value="friend-requests">Friend Requests <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">{mockRequests.length}</span></TabsTrigger>
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
                    <p className="font-semibold">{friend.name}</p>
                    <p className={`text-xs ${friend.status === 'Online' ? 'text-green-500' : 'text-muted-foreground'}`}>{friend.status}</p>
                  </div>
                  <Button variant="outline" size="sm">View Profile</Button>
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
                    <p className="font-medium">{request.name} wants to be your friend.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-100"><UserCheck className="mr-1 h-4 w-4" /> Accept</Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-100"><UserX className="mr-1 h-4 w-4" /> Decline</Button>
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
