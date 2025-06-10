'use client';

import * as React from 'react';
import { Moon, Sun, Palette } from 'lucide-react';
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
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          {/* Fallback Icon for other themes or when both Sun/Moon are hidden by theme class */}
          <Palette className="absolute h-[1.2rem] w-[1.2rem] rotate-0 scale-0 transition-all [.oceanic-light_&]:scale-100 [.oceanic-dark_&]:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Default Theme</DropdownMenuLabel>
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
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
