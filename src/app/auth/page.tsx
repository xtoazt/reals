
'use client';
import { AuthForm } from '@/components/auth-form';
import ParticlesBackground from '@/components/particles-background';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in, redirect to dashboard
        router.push('/dashboard');
      } else {
        // User is not logged in, stop loading and show auth form
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full relative p-4 bg-background text-foreground">
        <ParticlesBackground />
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading...</p>
      </div>
    );
  }

  // If not loading and no user, show the AuthForm
  return (
    <div
      className="flex items-center justify-center min-h-screen w-full relative p-4 bg-background text-foreground"
    >
      <ParticlesBackground />
      <AuthForm />
    </div>
  );
}
