
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Palette, Loader2, User as UserIcon, Users, MessageSquare } from "lucide-react";
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { auth, database } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { ref, get, off } from 'firebase/database'; // Removed onValue as we only fetch once
import { useRouter, useParams, notFound } from 'next/navigation';
import Link from 'next/link';

interface UserProfileData {
  uid: string;
  username: string;
  displayName: string;
  avatar: string; 
  banner?: string; 
  bio: string;
  title?: string;
  nameColor?: string;
  friendsCount?: number; // Added friendsCount
}

const generateDmChatId = (uid1: string, uid2: string): string => {
  const ids = [uid1, uid2].sort();
  return `dm_${ids[0]}_${ids[1]}`;
};

export default function ViewProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams(); 
  const usernameFromParams = typeof params.username === 'string' ? params.username : null;

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [viewedUserProfile, setViewedUserProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!usernameFromParams) {
      setIsLoading(false);
      notFound(); 
      return;
    }

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const usernameRef = ref(database, `usernames/${usernameFromParams.toLowerCase()}`);
        const usernameSnapshot = await get(usernameRef);

        if (!usernameSnapshot.exists()) {
          toast({ title: "User Not Found", description: `Profile for @${usernameFromParams} does not exist.`, variant: "destructive" });
          setViewedUserProfile(null);
          setIsLoading(false);
          notFound();
          return;
        }

        const uid = usernameSnapshot.val();
        
        // If the current user is viewing their own profile via /profile/[username], redirect to /profile
        if (currentUser && currentUser.uid === uid) {
          router.replace('/dashboard/profile'); // Use replace to avoid adding to history
          return; // Exit early, no need to fetch further
        }


        const userProfileRef = ref(database, `users/${uid}`);
        const profileSnapshot = await get(userProfileRef);

        if (profileSnapshot.exists()) {
          const data = profileSnapshot.val();
          
          setViewedUserProfile({
            uid: uid,
            username: data.username,
            displayName: data.displayName,
            avatar: data.avatar || `https://placehold.co/128x128.png?text=${data.displayName.substring(0,2).toUpperCase()}`,
            banner: data.banner || "https://placehold.co/1200x300.png?text=Banner",
            bio: data.bio || "No bio yet.",
            title: data.title,
            nameColor: data.nameColor,
            friendsCount: data.friendsCount || 0, // Use friendsCount from profile data
          });
          setIsOwnProfile(currentUser?.uid === uid);
        } else {
          toast({ title: "Profile Data Missing", description: `Could not load full profile for @${usernameFromParams}.`, variant: "destructive" });
          setViewedUserProfile(null);
          notFound();
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        toast({ title: "Error", description: "Failed to fetch profile.", variant: "destructive" });
        setViewedUserProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch profile if currentUser is loaded, to handle redirection logic correctly
    if (currentUser !== undefined) { // Check if auth state is resolved
       fetchProfile();
    }
  }, [usernameFromParams, toast, router, currentUser]); 

  if (isLoading || currentUser === undefined) { // Also show loader while currentUser is resolving
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!viewedUserProfile) {
    // notFound() would have been called if profile was truly not found.
    // This state might occur if there was an error after initial loading checks.
    return (
      <div className="flex flex-col justify-center items-center h-full space-y-4">
        <p className="text-xl">Profile could not be loaded.</p>
        <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
      </div>
    );
  }
  
  // This case should be handled by the redirect within useEffect, but as a fallback UI:
  if (isOwnProfile && currentUser?.uid === viewedUserProfile.uid) {
     return (
        <div className="flex flex-col justify-center items-center h-full space-y-4">
            <p className="text-xl">Redirecting to your editable profile...</p>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
     );
  }

  const userTitleStyle = viewedUserProfile.nameColor ? { color: viewedUserProfile.nameColor } : { color: 'hsl(var(--foreground))'};

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-lg">
        <div className="relative bg-muted h-48 md:h-56">
          <Image 
            src={viewedUserProfile.banner || "https://placehold.co/1200x300.png?text=Banner"} 
            alt="Profile banner" 
            layout="fill" 
            objectFit="cover" 
            className="w-full h-full"
            data-ai-hint="abstract banner"
            key={viewedUserProfile.banner} 
            priority
          />
        </div>
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col md:flex-row items-center md:items-end -mt-16 md:-mt-20 space-y-4 md:space-y-0 md:space-x-6">
            <div className="relative">
              <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-md">
                <AvatarImage src={viewedUserProfile.avatar} alt={viewedUserProfile.displayName} data-ai-hint="profile picture" key={viewedUserProfile.avatar}/>
                <AvatarFallback className="text-4xl">{viewedUserProfile.displayName.split(' ').map(n => n[0]).join('') || viewedUserProfile.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 text-center md:text-left pt-4 md:pt-0">
              <h1 className="text-3xl font-bold font-headline" style={{ color: viewedUserProfile.nameColor || 'hsl(var(--foreground))' }}>
                {viewedUserProfile.displayName}
              </h1>
              {viewedUserProfile.username && <p className="text-sm text-muted-foreground">@{viewedUserProfile.username}</p>}
              {viewedUserProfile.title && (
                <p className="text-sm font-semibold italic" style={userTitleStyle}>
                  {viewedUserProfile.title}
                </p>
              )}
              <div className="text-sm text-muted-foreground flex items-center justify-center md:justify-start mt-1">
                <Users size={16} className="mr-1"/> Friends: {viewedUserProfile.friendsCount ?? 0}
              </div>
            </div>
            {!isOwnProfile && currentUser && viewedUserProfile.uid !== currentUser.uid && (
                 <Link href={`/dashboard/chat/${generateDmChatId(currentUser.uid, viewedUserProfile.uid)}`} passHref>
                    <Button variant="outline">
                        <MessageSquare className="mr-2 h-4 w-4" /> Message @{viewedUserProfile.username}
                    </Button>
                </Link>
            )}
          </div>
          
          <Separator className="my-6" />

          <div>
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Bio</h3>
            </div>
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">{viewedUserProfile.bio || "No bio provided."}</p>
          </div>
          
          <Separator className="my-6" />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Profile Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="displayNameInput" className="flex items-center"><UserIcon size={14} className="mr-1" />Display Name</Label>
                <Input id="displayNameInput" value={viewedUserProfile.displayName} disabled />
              </div>
               <div>
                <Label htmlFor="usernameInput" className="flex items-center"><UserIcon size={14} className="mr-1" />Username</Label>
                <Input id="usernameInput" value={viewedUserProfile.username} disabled />
              </div>
               {viewedUserProfile.title && (
                <div>
                  <Label htmlFor="titleInput"><span className="text-sm font-semibold italic">Title:</span></Label>
                  <Input id="titleInput" value={viewedUserProfile.title} disabled className="italic" style={userTitleStyle}/>
                </div>
              )}
              {viewedUserProfile.nameColor && (
                <div>
                  <Label htmlFor="nameColorDisplay" className="flex items-center"><Palette size={14} className="mr-1" />Name Color</Label>
                  <div className="flex items-center gap-2">
                    <div style={{ backgroundColor: viewedUserProfile.nameColor }} className="w-10 h-10 rounded border" />
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

    