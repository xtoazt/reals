
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Edit3, Palette, ShieldCheck, Copy } from "lucide-react";
import Image from 'next/image'; // Ensure Image is imported

export default function ProfilePage() {
  // Mock user data
  const user = {
    id: "user123abc", // Mock User ID
    name: "John Doe",
    email: "john.doe@example.com",
    avatar: "https://placehold.co/128x128.png?text=JD",
    bio: "Loves coding, hiking, and coffee. Building the future, one line of code at a time.",
    title: "RealTalk Pro", // Example special title
    nameColor: "hsl(var(--primary))", // Example special name color (from theme primary)
  };

  // Dummy function for copy to clipboard
  const handleCopyUserID = () => {
    navigator.clipboard.writeText(user.id);
    // Add toast notification here in a real app
    alert("User ID copied to clipboard!");
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-lg">
        <div className="bg-muted h-32 md:h-40" data-ai-hint="profile banner abstract">
          <Image src="https://placehold.co/1200x300.png" alt="Profile banner" width={1200} height={300} className="object-cover w-full h-full" data-ai-hint="abstract banner" />
        </div>
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col md:flex-row items-center md:items-end -mt-16 md:-mt-20 space-y-4 md:space-y-0 md:space-x-6">
            <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-md">
              <AvatarImage src={user.avatar} alt={user.name} data-ai-hint="profile picture" />
              <AvatarFallback className="text-4xl">{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold font-headline" style={{ color: user.nameColor || 'inherit' }}>
                {user.name}
              </h1>
              {user.title && (
                <p className="text-sm text-accent font-semibold flex items-center justify-center md:justify-start">
                  <ShieldCheck size={16} className="mr-1" /> {user.title}
                </p>
              )}
              <p className="text-muted-foreground">{user.email}</p>
            </div>
            <Button variant="outline"><Edit3 className="mr-2 h-4 w-4" /> Edit Profile</Button>
          </div>
          
          <Separator className="my-6" />

          <div>
            <h3 className="text-lg font-semibold mb-2">Bio</h3>
            <p className="text-muted-foreground text-sm">{user.bio || "No bio provided."}</p>
          </div>
          
          <Separator className="my-6" />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Profile Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" defaultValue={user.name} disabled />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue={user.email} disabled />
              </div>
              <div>
                <Label htmlFor="userId">User ID</Label>
                <div className="flex items-center gap-2">
                  <Input id="userId" defaultValue={user.id} disabled className="flex-1" />
                  <Button variant="outline" size="icon" onClick={handleCopyUserID} aria-label="Copy User ID">
                    <Copy size={16} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Your unique ID for others to add you.</p>
              </div>
               {user.title && (
                <div>
                  <Label htmlFor="title" className="flex items-center"><ShieldCheck size={14} className="mr-1 text-accent" />Title</Label>
                  <Input id="title" defaultValue={user.title} disabled />
                </div>
              )}
              {user.nameColor && (
                <div>
                  <Label htmlFor="nameColor" className="flex items-center"><Palette size={14} className="mr-1" />Name Color</Label>
                  <div className="flex items-center gap-2">
                    <Input id="nameColor" type="color" value={user.nameColor} disabled className="w-12 h-10 p-1" />
                    <span className="text-sm text-muted-foreground">Current name color</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
