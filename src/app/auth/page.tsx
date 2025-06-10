
'use client';
import { AuthForm } from '@/components/auth-form';
import ParticlesBackground from '@/components/particles-background';

export default function AuthPage() {
  // Removed useEffect and state related to dynamic theme cycling for the auth page.
  // The page will now use the currently active theme's background.
  return (
    <div
      className="flex items-center justify-center min-h-screen w-full relative p-4 bg-background text-foreground"
      // Removed style={pageStyle}
    >
      <ParticlesBackground />
      <AuthForm />
    </div>
  );
}
