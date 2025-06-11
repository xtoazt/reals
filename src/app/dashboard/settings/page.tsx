
'use client'; 

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Lock, Palette, Shield, Languages, LogOut, User as UserIcon, KeyRound, Info, UsersSlash } from "lucide-react";
import { auth, database } from '@/lib/firebase';
import { onAuthStateChanged, sendPasswordResetEmail, type User as FirebaseUser } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [isLoadingPasswordReset, setIsLoadingPasswordReset] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        const userProfileRef = ref(database, 'users/' + user.uid);
        onValue(userProfileRef, (snapshot) => {
          const data = snapshot.val();
          setUserUsername(data?.username || user.email?.split('@')[0] || "User");
        });
      } else {
        setCurrentUser(null);
        setUserUsername(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handlePasswordReset = async () => {
    if (!currentUser || !currentUser.email) {
      toast({
        title: "Error",
        description: "Could not send password reset email. User or email not found.",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingPasswordReset(true);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      toast({
        title: "Password Reset Email Sent",
        description: `An email has been sent to ${currentUser.email} with instructions to reset your password.`,
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast({
        title: "Password Reset Failed",
        description: error.message || "Could not send password reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPasswordReset(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast({ title: 'Logout Failed', description: 'Could not log you out. Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Settings</CardTitle>
          <CardDescription>Manage your account and application settings.</CardDescription>
        </CardHeader>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center"><UserIcon className="mr-2 h-5 w-5 text-primary" />Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="username" className="flex items-center"><UserIcon size={16} className="mr-2 opacity-70" />Username</Label>
            <Input id="username" type="text" value={userUsername || "Loading..."} disabled />
            <p className="text-xs text-muted-foreground mt-1">Your username cannot be changed currently.</p>
          </div>
          <div>
            <Label htmlFor="password" className="flex items-center"><KeyRound size={16} className="mr-2 opacity-70" />Password</Label>
            <Button 
              variant="outline" 
              className="w-full md:w-auto" 
              onClick={handlePasswordReset}
              disabled={!currentUser || isLoadingPasswordReset}
            >
              {isLoadingPasswordReset ? "Sending..." : "Send Password Reset Email"}
            </Button>
          </div>
          <Separator />
          <div>
             <Label htmlFor="language">Language</Label>
            <select id="language" className="w-full p-2 border rounded-md bg-background">
                <option>English (US)</option>
                <option disabled>Español (Not implemented)</option>
                <option disabled>Français (Not implemented)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1 flex items-center"><Languages className="mr-1 h-3 w-3" /> Select your preferred language.</p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center"><Bell className="mr-2 h-5 w-5 text-primary" />Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="desktop-notifications" className="flex-1">Desktop Notifications</Label>
            <Switch id="desktop-notifications" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifications" className="flex-1">Email Notifications (for important updates)</Label>
            <Switch id="email-notifications" />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sound-notifications" className="flex-1">Sound Notifications</Label>
            <Switch id="sound-notifications" defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" />Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can change the application theme using the theme toggle button in the top navigation bar.
          </p>
        </CardContent>
      </Card>
      
      {/* Privacy Settings */}
       <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center"><Lock className="mr-2 h-5 w-5 text-primary" />Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="profile-visibility" className="flex-1">Profile Visibility</Label>
            <select id="profile-visibility" className="p-2 border rounded-md bg-background">
                <option disabled>Public (Not implemented)</option>
                <option disabled>Friends Only (Not implemented)</option>
                <option disabled>Private (Not implemented)</option>
            </select>
          </div>
           <p className="text-xs text-muted-foreground">Control who can see your profile information (feature coming soon).</p>
          <Separator />
          <Link href="/dashboard/settings/blocked-users" passHref>
            <Button variant="outline" className="w-full md:w-auto">
              <UsersSlash className="mr-2 h-4 w-4" /> Manage Blocked Users
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* About Section */}
      <Card>
        <CardHeader>
            <CardTitle className="text-xl flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />About RealTalk</CardTitle>
        </CardHeader>
        <CardContent>
            <Link href="/dashboard/settings/about" passHref>
                <Button variant="outline" className="w-full md:w-auto">View About Page</Button>
            </Link>
        </CardContent>
      </Card>


      {/* Logout */}
      <Card>
        <CardContent className="pt-6">
          <Button variant="destructive" className="w-full" onClick={handleLogout} disabled={!currentUser}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
