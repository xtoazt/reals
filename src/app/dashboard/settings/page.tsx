import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Lock, Palette, Shield, Languages, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SettingsPage() {
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
          <CardTitle className="text-xl flex items-center"><Shield className="mr-2 h-5 w-5 text-primary" />Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" defaultValue="user@example.com" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Button variant="outline" className="w-full md:w-auto">Change Password</Button>
          </div>
          <Separator />
          <div>
             <Label htmlFor="language">Language</Label>
            <select id="language" className="w-full p-2 border rounded-md bg-background">
                <option>English (US)</option>
                <option>Español</option>
                <option>Français</option>
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
            <Label htmlFor="email-notifications" className="flex-1">Email Notifications</Label>
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
          <div className="flex items-center justify-between">
            <Label className="flex-1">Theme</Label>
            <ThemeToggle />
          </div>
           <p className="text-xs text-muted-foreground">Choose between light, dark, or system default theme.</p>
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
                <option>Public</option>
                <option>Friends Only</option>
                <option>Private</option>
            </select>
          </div>
           <p className="text-xs text-muted-foreground">Control who can see your profile information.</p>
          <Separator />
          <Button variant="link" className="p-0 text-primary">Manage Blocked Users</Button>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card>
        <CardContent className="pt-6">
          <Button variant="destructive" className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
