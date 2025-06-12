
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, MessageSquare, Users, UserCircle, Settings, LogOut, Bot, PlusCircle, Bell, Menu, Sparkles, UserCheck } from 'lucide-react'; // Added UserCheck
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
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'; 
import { CreatePartyDialog } from './create-party-dialog';
import { ThemeToggle } from '@/components/theme-toggle'; 
import { auth, database } from '@/lib/firebase';
import { signOut, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import React, { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { ref, onValue, off } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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
  isShinyGold?: boolean;
  username?: string; // Added for fetching profile data if needed
}

interface AppNotification {
  id: string; // senderUid for friend requests
  title: string;
  description: string;
  timestamp: number;
  link?: string; 
  read: boolean;
  icon?: React.ElementType; 
  type: 'friend_request' | 'system' | 'message'; // Added type
}

// Friend request structure from friend_requests path
interface RawFriendRequest {
    senderUsername: string;
    senderUid: string;
    timestamp: number;
    status: 'pending';
}


export function TopNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfileData, setUserProfileData] = useState<UserProfileData | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // Store read notification IDs locally, could be persisted to localStorage or DB
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set()); 


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
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
              isShinyGold: data.isShinyGold || false,
              username: data.username, // Store username
            });
          } else {
            setUserProfileData({ displayName: user.displayName || "User", isShinyGold: false, username: user.email?.split('@')[0] });
          }
        });
      } else {
        setUserProfileData(null);
        setNotifications([]); 
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Effect for listening to friend requests
  useEffect(() => {
    if (!currentUser) {
        setNotifications([]); // Clear notifications if user logs out
        return;
    }

    const friendRequestsRef = ref(database, `friend_requests/${currentUser.uid}`);
    const listener = onValue(friendRequestsRef, (snapshot) => {
        const requestsData = snapshot.val() as { [senderUid: string]: RawFriendRequest } | null;
        const newNotifications: AppNotification[] = [];
        if (requestsData) {
            Object.entries(requestsData).forEach(([senderUid, request]) => {
                if (request.status === 'pending') {
                    newNotifications.push({
                        id: senderUid, // Use senderUid as ID for friend requests
                        title: 'New Friend Request',
                        description: `${request.senderUsername} wants to be your friend.`,
                        timestamp: request.timestamp,
                        link: '/dashboard/friends?tab=friend-requests', // Link to friends page, requests tab
                        read: readNotificationIds.has(senderUid), // Check if already read
                        icon: UserPlus,
                        type: 'friend_request',
                    });
                }
            });
        }
        // Combine with other notification types if any, for now just friend requests
        // Sort by timestamp, newest first
        setNotifications(newNotifications.sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => off(friendRequestsRef, 'value', listener);
  }, [currentUser, readNotificationIds]);


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
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1 && parts[0] && parts[parts.length -1]) {
      return (parts[0][0] + parts[parts.length -1][0]).toUpperCase();
    }
    return name.substring(0, 1).toUpperCase();
  };

  const getActiveTab = () => {
    if (navItems.some(item => item.href === pathname)) {
      return pathname;
    }
    if (pathname.startsWith('/dashboard/chat/')) {
      if (pathname === '/dashboard/chat/global') return '/dashboard/chat/global';
      if (pathname === '/dashboard/chat/ai-chatbot') return '/dashboard/chat/ai-chatbot';
    }
    const currentBase = navItems.find(item => item.href !== '/dashboard' && pathname.startsWith(item.href));
    return currentBase ? currentBase.href : '/dashboard';
  };

  const markNotificationAsRead = useCallback((id: string) => {
    setReadNotificationIds(prev => new Set(prev).add(id));
    // Optionally, update notifications state to immediately reflect read status visually
    // if not relying solely on readNotificationIds for the 'read' prop
     setNotifications(prevNots => prevNots.map(n => n.id === id ? {...n, read: true} : n));
  }, []);
  
  const clearAllNotifications = useCallback(() => {
    const idsToMarkRead = notifications.map(n => n.id);
    setReadNotificationIds(prev => new Set([...prev, ...idsToMarkRead]));
    setNotifications(prevNots => prevNots.map(n => ({...n, read: true}))); // Visually mark all as read
    // For friend requests, they are cleared when handled (accepted/declined) from the DB listener.
    // If other notification types are added that persist, they'd need DB removal here.
    toast({title: "Notifications Cleared", description: "All current notifications marked as read."});
  }, [notifications]);

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;
  const userDisplayNameStyle = userProfileData?.isShinyGold ? {} : (userProfileData?.nameColor ? { color: userProfileData.nameColor } : { color: 'hsl(var(--foreground))'});
  const userTitleStyle = userProfileData?.isShinyGold ? {} : (userProfileData?.nameColor ? { color: userProfileData.nameColor } : { color: 'hsl(var(--foreground))'});

  return (
    <header className="fixed top-0 left-0 right-0 z-20 flex h-[57px] items-center gap-4 border-b bg-nav-background/80 px-4 backdrop-blur-sm text-nav-foreground transition-colors duration-200">
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${getActiveTab() === item.href ? 'text-primary bg-muted' : 'text-muted-foreground'}`}
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

      <Link href="/dashboard" className="flex items-center gap-2">
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-primary">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
        <h1 className="text-xl font-bold font-headline hidden sm:block">real.</h1>
      </Link>

      <nav className="hidden md:flex flex-1 items-center justify-center">
        <Tabs value={getActiveTab()} className="w-auto">
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
      
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle /> 
        
        <DropdownMenu onOpenChange={(open) => {
            // Mark all as read when dropdown opens, if any are unread
            if (open && unreadNotificationsCount > 0) {
                 notifications.filter(n => !n.read).forEach(n => markNotificationAsRead(n.id));
            }
        }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full relative">
              <Bell className="h-5 w-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 md:w-96">
            <DropdownMenuLabel className="flex justify-between items-center">
              <span>Notifications</span>
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); clearAllNotifications();}} className="text-xs h-auto py-0.5 px-1.5">Clear All</Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="max-h-[300px] md:max-h-[400px]">
              {notifications.length === 0 ? (
                <DropdownMenuItem disabled className="text-center text-muted-foreground py-4">No new notifications</DropdownMenuItem>
              ) : (
                notifications.map(notif => {
                  const IconComponent = notif.icon || Sparkles;
                  return (
                    <DropdownMenuItem 
                      key={notif.id} 
                      className={cn(
                        "flex items-start gap-2.5 p-2.5 cursor-pointer transition-colors hover:bg-muted",
                        notif.read ? 'opacity-60' : 'font-medium'
                      )}
                      onClick={() => {
                        markNotificationAsRead(notif.id);
                        if (notif.link) router.push(notif.link);
                      }}
                    >
                      <IconComponent className={`h-4 w-4 mt-0.5 flex-shrink-0 ${notif.read ? 'text-muted-foreground' : 'text-primary'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${notif.read ? '' : 'text-foreground'}`}>{notif.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{notif.description}</p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{formatDistanceToNow(notif.timestamp, { addSuffix: true })}</p>
                      </div>
                       {!notif.read && <div className="h-2 w-2 rounded-full bg-primary self-center mr-1"></div>}
                    </DropdownMenuItem>
                  )
                })
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

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
                    <p className={cn("text-sm font-medium leading-none", userProfileData.isShinyGold ? 'text-shiny-gold' : '')} style={userDisplayNameStyle}>
                      {userProfileData.displayName}
                    </p>
                    {userProfileData.title && (
                      <p className={cn("text-xs leading-none italic", userProfileData.isShinyGold ? 'text-shiny-gold' : '')} style={userTitleStyle}>
                        {userProfileData.title}
                      </p>
                    )}
                    <p className="text-xs leading-none text-muted-foreground">
                      @{userProfileData.username}
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
