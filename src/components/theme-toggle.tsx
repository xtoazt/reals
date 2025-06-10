'use client';

import * as React from 'react';
import { Moon, Sun, Palette, Leaf } from 'lucide-react'; // Added Leaf
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  const renderIcon = () => {
    if (theme?.includes('oceanic')) {
      return <Palette className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />;
    }
    if (theme?.includes('forest')) {
      return <Leaf className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />;
    }
    // Default to Sun/Moon for light/dark themes
    return (
      <>
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {renderIcon()}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Warm Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Light (Warm)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Dark (Warm)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Oceanic Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('oceanic-light')}>
          Light (Oceanic)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('oceanic-dark')}>
          Dark (Oceanic)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Forest Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('forest-light')}>
          Light (Forest)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('forest-dark')}>
          Dark (Forest)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
