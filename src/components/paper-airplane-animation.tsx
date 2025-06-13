
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

const MIN_INTERVAL = 90 * 1000; // 1.5 minutes for automatic spawning
const MAX_INTERVAL = 150 * 1000; // 2.5 minutes for automatic spawning
const ANIMATION_DURATION_S_MIN = 5; // Minimum animation duration
const ANIMATION_DURATION_S_MAX = 7; // Maximum animation duration
const MAX_AIRPLANES_AUTO = 3; // Max airplanes from automatic spawning to prevent clutter

interface Airplane {
  id: string;
  top: string;
  fromLeft: boolean;
  startRotation: number;
  endRotation: number;
  animationDuration: number;
}

const PaperAirplaneAnimation: React.FC = () => {
  const [airplanes, setAirplanes] = useState<Airplane[]>([]);
  const autoSpawnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addAirplane = useCallback(() => {
    const animationDuration = Math.random() * (ANIMATION_DURATION_S_MAX - ANIMATION_DURATION_S_MIN) + ANIMATION_DURATION_S_MIN;
    const newAirplane: Airplane = {
      id: `airplane-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fromLeft: Math.random() < 0.5,
      top: `${Math.floor(Math.random() * 70) + 10}vh`, // 10vh to 80vh
      startRotation: Math.floor(Math.random() * 20 - 10), // -10 to +10 degrees
      endRotation: Math.floor(Math.random() * 40 - 20),   // -20 to +20 degrees
      animationDuration: animationDuration,
    };

    setAirplanes((prevAirplanes) => [...prevAirplanes, newAirplane]);

    setTimeout(() => {
      setAirplanes((prevs) => prevs.filter((p) => p.id !== newAirplane.id));
    }, animationDuration * 1000 + 500); // Remove after animation + buffer
  }, []);


  const scheduleNextAutoFlight = useCallback(() => {
    if (autoSpawnTimerRef.current) {
      clearTimeout(autoSpawnTimerRef.current);
    }
    const nextInterval = Math.random() * (MAX_INTERVAL - MIN_INTERVAL) + MIN_INTERVAL;
    autoSpawnTimerRef.current = setTimeout(() => {
      setAirplanes(currentAirplanes => {
        const autoSpawnedCount = currentAirplanes.filter(ap => ap.id.startsWith("airplane-auto-")).length;
        if (autoSpawnedCount < MAX_AIRPLANES_AUTO) {
           const animationDuration = Math.random() * (ANIMATION_DURATION_S_MAX - ANIMATION_DURATION_S_MIN) + ANIMATION_DURATION_S_MIN;
            const newAirplane: Airplane = {
              id: `airplane-auto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              fromLeft: Math.random() < 0.5,
              top: `${Math.floor(Math.random() * 70) + 10}vh`,
              startRotation: Math.floor(Math.random() * 20 - 10),
              endRotation: Math.floor(Math.random() * 40 - 20),
              animationDuration: animationDuration,
            };
            
            setTimeout(() => {
              setAirplanes((prevs) => prevs.filter((p) => p.id !== newAirplane.id));
            }, animationDuration * 1000 + 500);
            
            return [...currentAirplanes, newAirplane];
        }
        return currentAirplanes;
      });
      scheduleNextAutoFlight(); // Schedule the next one
    }, nextInterval);
  }, []);

  useEffect(() => {
    const initialDelay = Math.random() * (MAX_INTERVAL / 4) + (MIN_INTERVAL / 4);
    const initialTimer = setTimeout(() => {
      addAirplane(); // Add one initial airplane
      scheduleNextAutoFlight(); // Then start the regular schedule
    }, initialDelay);
    
    return () => {
      clearTimeout(initialTimer);
      if (autoSpawnTimerRef.current) clearTimeout(autoSpawnTimerRef.current);
    };
  }, [addAirplane, scheduleNextAutoFlight]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '`') {
        event.preventDefault(); // Prevent typing the backtick if in an input
        addAirplane();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addAirplane]);

  return (
    <>
      {airplanes.map((plane) => (
        <div
          key={plane.id}
          style={{
            top: plane.top,
            ['--start-rotation' as string]: `${plane.startRotation}deg`,
            ['--end-rotation' as string]: `${plane.endRotation}deg`,
            animationDuration: `${plane.animationDuration}s`,
            // Random small vertical offset at the end for variation
            ['--end-offset-y' as string]: `${Math.floor(Math.random() * 40 - 20)}px`, 
          }}
          className={cn(
            'fixed z-[9999] pointer-events-none opacity-0',
            plane.fromLeft ? 'animate-glide' : 'animate-glide-reverse'
          )}
        >
          {/* Side View Paper Airplane SVG Icon */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6 md:w-8 md:h-8 text-primary drop-shadow-lg"
            // Apply a base rotation if the SVG isn't "pointing" the right way for horizontal flight
            // This SVG (standard send icon) points right, so direct animation rotation is fine.
            // style={{ transform: 'rotate(-45deg)' }} // Example if SVG needs base rotation
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
          </svg>
        </div>
      ))}
    </>
  );
};

export default PaperAirplaneAnimation;
