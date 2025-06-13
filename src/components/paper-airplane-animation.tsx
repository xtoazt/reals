
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

const MIN_INTERVAL = 90 * 1000; 
const MAX_INTERVAL = 150 * 1000;
const ANIMATION_DURATION_S_MIN = 3; // Faster: 3 seconds min
const ANIMATION_DURATION_S_MAX = 5; // Faster: 5 seconds max
const MAX_AIRPLANES_AUTO = 3; 

interface Airplane {
  id: string;
  top: string;
  fromLeft: boolean;
  startRotation: number;
  endRotation: number;
  animationDuration: number;
  endOffsetY: number; // For varied end vertical position
}

const PaperAirplaneAnimation: React.FC = () => {
  const [airplanes, setAirplanes] = useState<Airplane[]>([]);
  const autoSpawnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addAirplane = useCallback(() => {
    const animationDuration = Math.random() * (ANIMATION_DURATION_S_MAX - ANIMATION_DURATION_S_MIN) + ANIMATION_DURATION_S_MIN;
    const fromLeft = Math.random() < 0.5;
    const newAirplane: Airplane = {
      id: `airplane-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fromLeft: fromLeft,
      top: `${Math.floor(Math.random() * 70) + 10}vh`, 
      startRotation: Math.floor(Math.random() * 10 - 5), // More subtle start: -5 to +5 degrees
      endRotation: Math.floor(Math.random() * 30 - 15),   // More subtle end: -15 to +15 degrees
      animationDuration: animationDuration,
      endOffsetY: Math.floor(Math.random() * 60 - 30), // Random vertical offset at end: -30px to +30px
    };

    setAirplanes((prevAirplanes) => [...prevAirplanes, newAirplane]);

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
           const fromLeft = Math.random() < 0.5;
            const newAirplane: Airplane = {
              id: `airplane-auto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              fromLeft: fromLeft,
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
    const initialDelay = Math.random() * (MAX_INTERVAL / 4) + (MIN_INTERVAL / 4);
    const initialTimer = setTimeout(() => {
      addAirplane(); 
      scheduleNextAutoFlight(); 
    }, initialDelay);
    
    return () => {
      clearTimeout(initialTimer);
      if (autoSpawnTimerRef.current) clearTimeout(autoSpawnTimerRef.current);
    };
  }, [addAirplane, scheduleNextAutoFlight]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '`') {
        event.preventDefault(); 
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
            transform: !plane.fromLeft ? 'scaleX(-1)' : 'scaleX(1)', // Flip if flying from right
          }}
          className={cn(
            'fixed z-[9999] pointer-events-none opacity-0',
            plane.fromLeft ? 'animate-glide' : 'animate-glide-reverse'
          )}
        >
          {/* New Side View Paper Airplane SVG Icon */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5 md:w-6 md:h-6 text-primary drop-shadow-lg"
          >
            {/* Path for a side-view paper airplane */}
            <path d="M1.74,12.08l10.8-3.09L1.74,4.24V1.9L22.26,12,1.74,22.1V19.76l10.8-3.09Z"/>
          </svg>
        </div>
      ))}
    </>
  );
};

export default PaperAirplaneAnimation;
