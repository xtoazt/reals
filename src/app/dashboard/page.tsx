
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users, Bot, VenetianMask, SchoolIcon, MessageCircleQuestion, ShieldAlert } from "lucide-react"; // Added new icons
import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { useSearchParams, useRouter } from 'next/navigation';
import { ThemeSelectionDialog } from "@/components/theme-selection-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


function DashboardPageContent() {
  const [userName, setUserName] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showThemeDialog, setShowThemeDialog] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userProfileRef = ref(database, 'users/' + user.uid);
        onValue(userProfileRef, (snapshot) => {
          const data = snapshot.val();
          setUserName(data?.displayName || user.displayName || "User");
        });
      } else {
        setUserName(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (searchParams.get('showThemePicker') === 'true') {
      setShowThemeDialog(true);
      // Remove the query parameter from the URL without reloading the page
      const newPath = window.location.pathname; // Keep current path
      router.replace(newPath, { scroll: false }); // Use replace to avoid adding to history
    }
  }, [searchParams, router]);

  const specializedChats = [
    { name: "Unblocked Chat", id: "global-unblocked", icon: ShieldAlert, description: "Find new games and unblockers." },
    { name: "School Chat", id: "global-school", icon: SchoolIcon, description: "Discuss school-related topics." },
    { name: "Anonymous Chat", id: "global-anonymous", icon: VenetianMask, description: "Chat anonymously with others." },
    { name: "Support Chat", id: "global-support", icon: MessageCircleQuestion, description: "Report any bugs, or suggest additions." },
  ];

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Welcome to real{userName ? `, ${userName}` : ''}!</CardTitle>
          <CardDescription>
            This is your central hub. connect fr.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Jump into the Global Chat, manage your friends, or create a new party to chat privately.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard/chat/global" passHref>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
            <CardHeader className="flex-row items-center space-x-4">
              <MessageSquare className="w-10 h-10 text-primary" />
              <div>
                <CardTitle>Global Chat</CardTitle>
                <CardDescription>Chat with everyone.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p>Join the public conversation and meet new people.</p>
            </CardContent>
             <CardContent className="pt-0">
               <Button className="w-full">Go to Global Chat</Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/friends" passHref>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
            <CardHeader className="flex-row items-center space-x-4">
              <Users className="w-10 h-10 text-primary" />
              <div>
                <CardTitle>Manage Friends</CardTitle>
                <CardDescription>Connect with others.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p>View your friends, manage requests, and add new connections.</p>
            </CardContent>
             <CardContent className="pt-0">
               <Button className="w-full">Manage Friends</Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/chat/ai-chatbot" passHref>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
            <CardHeader className="flex-row items-center space-x-4">
              <Bot className="w-10 h-10 text-primary" />
              <div>
                <CardTitle>AI Chatbot</CardTitle>
                <CardDescription>Talk to our helpful AI.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p>Ask questions, get information, or just have a chat with the AI.</p>
            </CardContent>
            <CardContent className="pt-0">
               <Button className="w-full">Chat with AI</Button>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Explore More Chats</CardTitle>
          <CardDescription>
            Discover specialized chat rooms for different interests and needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full md:w-auto">
                Select a Specialized Chat
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>Specialized Global Chats</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {specializedChats.map((chat) => (
                <Link key={chat.id} href={`/dashboard/chat/${chat.id}`} passHref>
                  <DropdownMenuItem className="cursor-pointer">
                    <chat.icon className="mr-2 h-4 w-4" />
                    <span>{chat.name}</span>
                  </DropdownMenuItem>
                </Link>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
           <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {specializedChats.map((chat) => (
              <Link key={`card-${chat.id}`} href={`/dashboard/chat/${chat.id}`} passHref>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="flex-row items-center space-x-3 pb-2">
                    <chat.icon className="w-6 h-6 text-muted-foreground" />
                    <CardTitle className="text-base">{chat.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{chat.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {showThemeDialog && <ThemeSelectionDialog open={showThemeDialog} onOpenChange={setShowThemeDialog} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    // Suspense is required by Next.js for pages that use useSearchParams
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}
