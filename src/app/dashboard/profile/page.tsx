
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Edit3, Palette, ShieldCheck, Copy, Loader2 } from "lucide-react";
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { auth, database } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { ref, onValue, update } from 'firebase/database';
import { Textarea } from '@/components/ui/textarea'; // Added for bio editing

interface UserProfile {
  uid: string;
  name: string; // This will be displayName from Firebase Auth or DB
  email: string;
  avatar: string;
  bio: string;
  title?: string;
  nameColor?: string;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioEdit, setBioEdit] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        const userProfileRef = ref(database, 'users/' + user.uid);
        onValue(userProfileRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setUserProfile({
              uid: user.uid,
              name: data.displayName || user.displayName || "User",
              email: data.email || user.email || "",
              avatar: data.avatar || `https://placehold.co/128x128.png?text=${(data.displayName || user.displayName || "U").substring(0,2).toUpperCase()}`,
              bio: data.bio || "No bio yet.",
              title: data.title,
              nameColor: data.nameColor,
            });
            setBioEdit(data.bio || "");
          } else {
             // Create a basic profile if none exists
            const basicProfile = {
                uid: user.uid,
                displayName: user.displayName || "User",
                email: user.email || "",
                avatar: `https://placehold.co/128x128.png?text=${(user.displayName || "U").substring(0,2).toUpperCase()}`,
                bio: "New user! Ready to chat.",
            };
            update(ref(database, 'users/' + user.uid), basicProfile);
            setUserProfile({ ...basicProfile, name: basicProfile.displayName });
            setBioEdit(basicProfile.bio);
          }
          setIsLoading(false);
        }, (error) => {
            console.error("Error fetching profile:", error);
            toast({ title: "Error", description: "Could not fetch profile.", variant: "destructive"});
            setIsLoading(false);
        });
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setIsLoading(false);
        // router.push('/auth'); // Consider redirecting if not authenticated
      }
    });
    return () => unsubscribe();
  }, [toast]);

  const handleCopyUserID = () => {
    if (userProfile?.uid) {
      navigator.clipboard.writeText(userProfile.uid);
      toast({ title: "Copied!", description: "User ID copied to clipboard." });
    }
  };

  const handleBioEditToggle = () => {
    if (isEditingBio && userProfile) { // Save bio
      const userProfileRef = ref(database, 'users/' + userProfile.uid);
      update(userProfileRef, { bio: bioEdit })
        .then(() => {
          toast({ title: "Success", description: "Bio updated." });
          setUserProfile(prev => prev ? {...prev, bio: bioEdit} : null);
        })
        .catch(error => {
          toast({ title: "Error", description: "Could not update bio.", variant: "destructive" });
        });
    }
    setIsEditingBio(!isEditingBio);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser || !userProfile) {
    return (
      <div className="flex flex-col justify-center items-center h-full space-y-4">
        <p className="text-xl">Please log in to view your profile.</p>
        <Button onClick={() => window.location.href = '/auth'}>Go to Login</Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-lg">
        <div className="bg-muted h-32 md:h-40">
          <Image src="https://placehold.co/1200x300.png" alt="Profile banner" width={1200} height={300} className="object-cover w-full h-full" data-ai-hint="abstract banner"/>
        </div>
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col md:flex-row items-center md:items-end -mt-16 md:-mt-20 space-y-4 md:space-y-0 md:space-x-6">
            <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-md">
              <AvatarImage src={userProfile.avatar} alt={userProfile.name} data-ai-hint="profile picture"/>
              <AvatarFallback className="text-4xl">{userProfile.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold font-headline" style={{ color: userProfile.nameColor || 'hsl(var(--foreground))' }}>
                {userProfile.name}
              </h1>
              {userProfile.title && (
                <p className="text-sm text-accent font-semibold flex items-center justify-center md:justify-start">
                  <ShieldCheck size={16} className="mr-1" /> {userProfile.title}
                </p>
              )}
              <p className="text-muted-foreground">{userProfile.email}</p>
            </div>
            {/* <Button variant="outline"><Edit3 className="mr-2 h-4 w-4" /> Edit Profile</Button> */}
          </div>
          
          <Separator className="my-6" />

          <div>
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Bio</h3>
                <Button variant="ghost" size="sm" onClick={handleBioEditToggle}>
                    <Edit3 className="mr-2 h-4 w-4" /> {isEditingBio ? "Save Bio" : "Edit Bio"}
                </Button>
            </div>
            {isEditingBio ? (
                <Textarea 
                    value={bioEdit}
                    onChange={(e) => setBioEdit(e.target.value)}
                    placeholder="Tell us about yourself..."
                    className="min-h-[100px]"
                />
            ) : (
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">{userProfile.bio || "No bio provided."}</p>
            )}
          </div>
          
          <Separator className="my-6" />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Profile Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" value={userProfile.name} disabled />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={userProfile.email} disabled />
              </div>
              <div>
                <Label htmlFor="userId">User ID</Label>
                <div className="flex items-center gap-2">
                  <Input id="userId" value={userProfile.uid} disabled className="flex-1" />
                  <Button variant="outline" size="icon" onClick={handleCopyUserID} aria-label="Copy User ID">
                    <Copy size={16} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Your unique ID for others to add you.</p>
              </div>
               {userProfile.title && (
                <div>
                  <Label htmlFor="title" className="flex items-center"><ShieldCheck size={14} className="mr-1 text-accent" />Title</Label>
                  <Input id="title" value={userProfile.title} disabled />
                </div>
              )}
              {userProfile.nameColor && (
                <div>
                  <Label htmlFor="nameColor" className="flex items-center"><Palette size={14} className="mr-1" />Name Color</Label>
                  <div className="flex items-center gap-2">
                    <div style={{ backgroundColor: userProfile.nameColor }} className="w-10 h-10 rounded border" />
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

    