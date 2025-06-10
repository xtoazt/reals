
'use client';
import { AuthForm } from '@/components/auth-form';
import ParticlesBackground from '@/components/particles-background';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

const authPageThemes = [
    { name: 'light', background: 'hsl(0 0% 95%)', foreground: 'hsl(20 10% 10%)' },
    { name: 'dark', background: 'hsl(20 10% 10%)', foreground: 'hsl(0 0% 95%)' },
    { name: 'oceanic-light', background: 'hsl(200 30% 96%)', foreground: 'hsl(210 25% 25%)' },
    { name: 'oceanic-dark', background: 'hsl(210 25% 12%)', foreground: 'hsl(200 15% 88%)' },
    { name: 'forest-light', background: 'hsl(40 30% 96%)', foreground: 'hsl(30 25% 25%)' },
    { name: 'forest-dark', background: 'hsl(120 25% 12%)', foreground: 'hsl(40 20% 88%)' },
];

export default function AuthPage() {
  const { setTheme, resolvedTheme } = useTheme();
  const [currentAuthPageIndex, setCurrentAuthPageIndex] = useState(0);
  const [pageStyle, setPageStyle] = useState({});

  // Store the original theme to restore it on unmount
  useEffect(() => {
    const originalTheme = resolvedTheme || 'dark'; // Capture the theme when component mounts

    const intervalId = setInterval(() => {
      setCurrentAuthPageIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % authPageThemes.length;
        const nextThemeStyle = authPageThemes[nextIndex];
        setPageStyle({
          backgroundColor: nextThemeStyle.background,
          color: nextThemeStyle.foreground,
          transition: 'background-color 1s ease-in-out, color 1s ease-in-out',
        });
        return nextIndex;
      });
    }, 3000); // Change theme every 3 seconds

    // Set initial style
    const initialThemeStyle = authPageThemes[0];
     setPageStyle({
        backgroundColor: initialThemeStyle.background,
        color: initialThemeStyle.foreground,
      });

    return () => {
      clearInterval(intervalId);
      // Restore the original theme when the component unmounts
      // This ensures other pages are not affected by the auth page's rapid theme cycling
      const currentAppTheme = localStorage.getItem('theme') || 'dark'; // Or read from next-themes state if possible
      setTheme(currentAppTheme);
    };
  }, [setTheme, resolvedTheme]);

  return (
    <div
      className="flex items-center justify-center min-h-screen w-full relative p-4"
      style={pageStyle}
    >
      <ParticlesBackground />
      <AuthForm />
    </div>
  );
}
