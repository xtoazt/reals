
'use client'; // Required for useEffect and useState

import ParticlesBackground from '@/components/particles-background';
import { TopNavBar } from '@/components/top-nav-bar';
import { auth, database, setupPresence, goOnline, goOffline } from '@/lib/firebase'; // Import database instance
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect } from 'react'; // Import React and useEffect
import PaperAirplaneAnimation from '@/components/paper-airplane-animation'; // Import the new component

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setupPresence(user.uid);
        goOnline(database); // Use the imported database instance
      }
    });

    // Handle browser tab focus/blur for more accurate presence
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (auth.currentUser) {
            // goOffline(database); // Optional: more aggressive offline marking
        }
      } else {
        if (auth.currentUser) {
            goOnline(database); // Use the imported database instance
            setupPresence(auth.currentUser.uid); // Re-assert presence
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Ensure user is marked online when the app loads/layout mounts, if logged in
    if (auth.currentUser) {
        goOnline(database); // Use the imported database instance
        setupPresence(auth.currentUser.uid);
    }


    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // No explicit goOffline on layout unmount, onDisconnect should handle it
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <ParticlesBackground />
      <PaperAirplaneAnimation /> {/* Added Paper Airplane Animation Component */}
      <TopNavBar />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-[calc(57px+1rem)] md:pt-[calc(57px+1.5rem)]">
        {children}
      </main>
    </div>
  );
}
