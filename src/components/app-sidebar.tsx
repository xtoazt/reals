
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, MessageSquare, Users, UserCircle, Settings, LogOut as LogOutIcon, Bot, PlusCircle, Loader2 } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreatePartyDialog } from './create-party-dialog';
import { auth, database } from '@/lib/firebase';
import { signOut, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/chat/global', label: 'Global Chat', icon: MessageSquare }, // Badge removed, can be dynamic later
  { href: '/dashboard/chat/ai-chatbot', label: 'AI Chatbot', icon: Bot },
  { href: '/dashboard/friends', label: 'Friends', icon: Users },
  { href: '/dashboard/profile', label: 'Profile', icon: UserCircle },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

interface UserProfileData {
  displayName?: string;
  avatar?: string;
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfileData, setUserProfileData] = useState<UserProfileData | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

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
            });
          } else {
             setUserProfileData({ displayName: user.displayName || "User", avatar: `https://placehold.co/100x100.png?text=${(user.displayName || "U").substring(0,1)}` });
          }
        }, (error) => {
            console.error("Error fetching user profile for sidebar:", error);
            // Fallback display if DB fetch fails but user is authenticated
            setUserProfileData({ displayName: user.displayName || "User", avatar: `https://placehold.co/100x100.png?text=${(user.displayName || "U").substring(0,1)}` });
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

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left">
      <SidebarHeader className="items-center justify-center p-4">
        <Link href="/dashboard" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-primary">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
          <h1 className="text-2xl font-bold font-headline">real.</h1>
        </Link>
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-primary hidden group-data-[collapsible=icon]:block">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
      </SidebarHeader>
      
      <SidebarContent className="p-2 flex-grow">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                  tooltip={{ children: item.label, side: 'right' }}
                  className="justify-start"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  {item.badge && (
                    <SidebarMenuBadge className="ml-auto group-data-[collapsible=icon]:hidden">
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <CreatePartyDialog>
               <SidebarMenuButton
                tooltip={{ children: "Create Party", side: 'right' }}
                className="justify-start w-full"
              >
                <PlusCircle className="w-5 h-5" />
                <span className="group-data-[collapsible=icon]:hidden">Create Party</span>
              </SidebarMenuButton>
            </CreatePartyDialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarSeparator />

      <SidebarFooter className="p-4 space-y-2">
        {isLoadingAuth ? (
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <Loader2 className="h-9 w-9 animate-spin" />
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold">Loading...</span>
            </div>
          </div>
        ) : currentUser && userProfileData ? (
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <Avatar className="h-9 w-9">
              <AvatarImage src={userProfileData.avatar || `https://placehold.co/100x100.png?text=U`} alt="User Avatar" data-ai-hint="user avatar"/>
              <AvatarFallback>{(userProfileData.displayName || "U").charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold truncate max-w-[120px]">{userProfileData.displayName || 'User'}</span>
              <span className="text-xs text-green-500">Online</span>
            </div>
          </div>
        ) : (
           <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
             <Avatar className="h-9 w-9">
                <AvatarFallback>G</AvatarFallback>
            </Avatar>
             <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold">Guest</span>
            </div>
           </div>
        )}
        {/* ThemeToggle can be added back here if needed */}
        {/* <div className="group-data-[collapsible=icon]:hidden">
          <ThemeToggle />
        </div> */}
        <Button variant="ghost" className="w-full justify-start group-data-[collapsible=icon]:justify-center" onClick={handleLogout} disabled={isLoadingAuth || !currentUser}>
          <LogOutIcon className="w-5 h-5 group-data-[collapsible=icon]:mr-0 mr-2" />
          <span className="group-data-[collapsible=icon]:hidden">Logout</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

    