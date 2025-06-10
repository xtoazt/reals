import { AuthForm } from '@/components/auth-form';
import ParticlesBackground from '@/components/particles-background';

export default function AuthPage() {
  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-background relative p-4">
      <ParticlesBackground />
      <AuthForm />
    </div>
  );
}
