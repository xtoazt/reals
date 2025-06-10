
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, MessageSquare, Users, UserCircle, Settings, LogOut, Bot, PlusCircle, Bell, Menu, Shield } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'; 
// ThemeToggle is removed from here
import { CreatePartyDialog } from './create-party-dialog';
import { auth, database } from '@/lib/firebase';
import { signOut, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/chat/global', label: 'Global Chat', icon: MessageSquare },
  { href: '/dashboard/chat/ai-chatbot', label: 'AI Chatbot', icon: Bot },
  { href: '/dashboard/friends', label: 'Friends', icon: Users },
  { href: '/dashboard/profile', label: 'Profile', icon: UserCircle },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

interface UserProfileData {
  displayName?: string;
  avatar?: string;
  nameColor?: string;
  title?: string;
}

export function TopNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfileData, setUserProfileData] = useState<UserProfileData | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoadingAuth(false);
      if (user) {
        const userProfileRef = ref(database, 'users/' + user.uid);
        onValue(userProfileRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setUserProfileData({
              displayName: data.displayName || user.displayName,
              avatar: data.avatar,
              nameColor: data.nameColor,
              title: data.title,
            });
          } else {
            setUserProfileData({ displayName: user.displayName || "User" });
          }
        });
      } else {
        setUserProfileData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast({ title: 'Logout Failed', description: 'Could not log you out. Please try again.', variant: 'destructive' });
    }
  };
  
  const getAvatarFallback = (name?: string) => {
    return name ? name.substring(0, 1).toUpperCase() : 'U';
  };


  return (
    <header className="fixed top-0 left-0 right-0 z-20 flex h-[57px] items-center gap-4 border-b bg-nav-background/80 px-4 backdrop-blur-sm text-nav-foreground">
      {/* Mobile Menu Trigger */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 pt-10 w-72 bg-nav-background text-nav-foreground">
          <nav className="grid gap-2 text-lg font-medium p-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)) ? 'text-primary bg-muted' : 'text-muted-foreground'}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
            <CreatePartyDialog>
              <Button variant="ghost" className="w-full justify-start gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary" onClick={() => setIsMobileMenuOpen(false)}>
                <PlusCircle className="h-5 w-5" /> Create Party
              </Button>
            </CreatePartyDialog>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2">
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-primary">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
        <h1 className="text-xl font-bold font-headline hidden sm:block">real.</h1>
      </Link>

      {/* Desktop Tabs Navigation */}
      <nav className="hidden md:flex flex-1 items-center justify-center">
        <Tabs value={pathname.startsWith('/dashboard/chat/') ? pathname : (pathname.startsWith('/dashboard/friends') ? '/dashboard/friends' : (pathname.startsWith('/dashboard/profile') ? '/dashboard/profile' : (pathname.startsWith('/dashboard/settings') ? '/dashboard/settings' : pathname)))} className="w-auto">
          <TabsList>
            {navItems.map((item) => (
              <TabsTrigger key={item.label} value={item.href} asChild>
                <Link href={item.href} className="flex items-center gap-1.5 px-3 py-1.5">
                  <item.icon className="h-4 w-4" /> {item.label}
                </Link>
              </TabsTrigger>
            ))}
             <CreatePartyDialog>
                <Button variant="ghost" size="sm" className="ml-2 flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                    <PlusCircle className="h-4 w-4" /> Create Party
                </Button>
            </CreatePartyDialog>
          </TabsList>
        </Tabs>
      </nav>
      
      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* ThemeToggle removed from here */}
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={userProfileData?.avatar} alt={userProfileData?.displayName || "User"} data-ai-hint="user avatar" />
                <AvatarFallback>{getAvatarFallback(userProfileData?.displayName)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {currentUser && userProfileData && (
              <>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none" style={{ color: userProfileData.nameColor }}>
                      {userProfileData.displayName}
                    </p>
                    {userProfileData.title && (
                      <p className="text-xs leading-none text-muted-foreground flex items-center">
                        <Shield size={12} className="mr-1 text-accent"/>{userProfileData.title}
                      </p>
                    )}
                    <p className="text-xs leading-none text-muted-foreground">
                      @{currentUser.email?.split('@')[0]}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile" className="w-full justify-start cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="w-full justify-start cursor-pointer">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
