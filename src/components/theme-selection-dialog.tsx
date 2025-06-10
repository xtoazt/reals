
'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { Palette, Sun, Moon, Leaf } from 'lucide-react';

interface ThemeSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const availableThemes = [
  { name: 'Light (Warm)', value: 'light', icon: Sun },
  { name: 'Dark (Warm)', value: 'dark', icon: Moon },
  { name: 'Light (Oceanic)', value: 'oceanic-light', icon: Palette },
  { name: 'Dark (Oceanic)', value: 'oceanic-dark', icon: Palette },
  { name: 'Light (Forest)', value: 'forest-light', icon: Leaf },
  { name: 'Dark (Forest)', value: 'forest-dark', icon: Leaf },
];

export function ThemeSelectionDialog({ open, onOpenChange }: ThemeSelectionDialogProps) {
  const { setTheme } = useTheme();

  const handleThemeSelect = (themeValue: string) => {
    setTheme(themeValue);
    onOpenChange(false); // Close the dialog
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Choose Your Theme</DialogTitle>
          <DialogDescription>
            Select a theme to personalize your experience. You can always change this later in settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          {availableThemes.map((themeOption) => (
            <Button
              key={themeOption.value}
              variant="outline"
              className="w-full h-auto py-3 flex flex-col items-center justify-center space-y-2"
              onClick={() => handleThemeSelect(themeOption.value)}
            >
              <themeOption.icon className="h-8 w-8 mb-1" />
              <span className="text-sm">{themeOption.name}</span>
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Decide Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
