
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

const MIN_INTERVAL = 90 * 1000;
const MAX_INTERVAL = 150 * 1000;
const ANIMATION_DURATION_S_MIN = 3;
const ANIMATION_DURATION_S_MAX = 5;
const MAX_AIRPLANES_AUTO = 3;

interface Airplane {
  id: string;
  top: string;
  fromLeft: boolean; // Always true now, but kept in interface for consistency
  startRotation: number;
  endRotation: number;
  animationDuration: number;
  endOffsetY: number;
}

const PaperAirplaneAnimation: React.FC = () => {
  const [airplanes, setAirplanes] = useState<Airplane[]>([]);
  const autoSpawnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addAirplane = useCallback(() => {
    const animationDuration = Math.random() * (ANIMATION_DURATION_S_MAX - ANIMATION_DURATION_S_MIN) + ANIMATION_DURATION_S_MIN;
    const newAirplane: Airplane = {
      id: `airplane-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fromLeft: true, // Always from left
      top: `${Math.floor(Math.random() * 70) + 10}vh`, // Random Y position (10% to 80% of viewport height)
      startRotation: Math.floor(Math.random() * 10 - 5), // Slight random start rotation (-5 to +4 degrees)
      endRotation: Math.floor(Math.random() * 30 - 15),   // More varied end rotation (-15 to +14 degrees)
      animationDuration: animationDuration,
      endOffsetY: Math.floor(Math.random() * 60 - 30),   // Random vertical offset at end (-30px to +29px)
    };

    setAirplanes((prevAirplanes) => [...prevAirplanes, newAirplane]);

    // Remove airplane after animation (plus a small buffer)
    setTimeout(() => {
      setAirplanes((prevs) => prevs.filter((p) => p.id !== newAirplane.id));
    }, animationDuration * 1000 + 500);
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
              fromLeft: true,
              top: `${Math.floor(Math.random() * 70) + 10}vh`,
              startRotation: Math.floor(Math.random() * 10 - 5),
              endRotation: Math.floor(Math.random() * 30 - 15),
              animationDuration: animationDuration,
              endOffsetY: Math.floor(Math.random() * 60 - 30),
            };

            setTimeout(() => {
              setAirplanes((prevs) => prevs.filter((p) => p.id !== newAirplane.id));
            }, animationDuration * 1000 + 500);

            return [...currentAirplanes, newAirplane];
        }
        return currentAirplanes;
      });
      scheduleNextAutoFlight();
    }, nextInterval);
  }, []);

  useEffect(() => {
    // Initial delay before the first auto flight, to make it less predictable on page load
    const initialDelay = Math.random() * (MAX_INTERVAL / 4) + (MIN_INTERVAL / 4); // Between 1/4 and 1/2 of min interval
    const initialTimer = setTimeout(() => {
      addAirplane(); // Add one on initial load after delay
      scheduleNextAutoFlight(); // Then start the regular schedule
    }, initialDelay);

    return () => {
      clearTimeout(initialTimer);
      if (autoSpawnTimerRef.current) clearTimeout(autoSpawnTimerRef.current);
    };
  }, [addAirplane, scheduleNextAutoFlight]);


  // Listener for backtick key to manually summon an airplane
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '`') {
        event.preventDefault(); // Prevent typing the backtick if it's in an input field
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
            ['--end-offset-y' as string]: `${plane.endOffsetY}px`,
          }}
          className={cn(
            'fixed z-[9999] pointer-events-none opacity-0',
            'animate-glide' // Always animate from left to right
          )}
        >
          {/* Side View Paper Airplane SVG */}
          <svg
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 md:w-6 md:h-6 fill-sky-400 drop-shadow-lg" // Changed to light blue
          >
            {/* Classic paper airplane / dart shape */}
            <path d="M2 2 L22 12 L2 22 L7 12 L2 2 Z" />
          </svg>
        </div>
      ))}
    </>
  );
};

export default PaperAirplaneAnimation;
