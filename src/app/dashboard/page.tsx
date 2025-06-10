
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users, Bot, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth, database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";

export default function DashboardPage() {
  const [userName, setUserName] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Welcome to real{userName ? `, ${userName}` : ''}!</CardTitle>
          <CardDescription>
            This is your central hub. Connect, chat, and explore.
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
       {/* Placeholder for Create Party Dialog integration if needed directly on dashboard */}
      {/* <CreatePartyDialog>
        <Button variant="outline" size="lg" className="w-full md:w-auto">
          <PlusCircle className="mr-2 h-5 w-5" /> Create New Party
        </Button>
      </CreatePartyDialog> */}
    </div>
  );
}

    