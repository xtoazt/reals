
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SendHorizonal } from 'lucide-react';
import { cn } from '@/lib/utils';

const MIN_INTERVAL = 90 * 1000; // 1.5 minutes
const MAX_INTERVAL = 150 * 1000; // 2.5 minutes
const ANIMATION_DURATION_S = 10; // 10 seconds for glide

interface AnimationProps {
  top: string;
  fromLeft: boolean;
  startRotation: number;
  endRotation: number;
}

const PaperAirplaneAnimation: React.FC = () => {
  const [isFlying, setIsFlying] = useState(false);
  const [animationProps, setAnimationProps] = useState<AnimationProps | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const flightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startFlight = () => {
    const fromLeft = Math.random() < 0.5;
    const top = `${Math.floor(Math.random() * 70) + 10}vh`; // 10vh to 80vh to avoid edges
    const startRotation = Math.floor(Math.random() * 30 - 15); // -15 to +15 degrees
    const endRotationDelta = Math.floor(Math.random() * 20 - 10); // change rotation by -10 to +10
    const endRotation = startRotation + endRotationDelta;

    setAnimationProps({ top, fromLeft, startRotation, endRotation });
    setIsFlying(true);

    if (flightTimeoutRef.current) clearTimeout(flightTimeoutRef.current);
    flightTimeoutRef.current = setTimeout(() => {
      setIsFlying(false);
      setAnimationProps(null); // Clear props after animation
    }, ANIMATION_DURATION_S * 1000);
  };

  useEffect(() => {
    const scheduleNextFlight = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const nextInterval = Math.random() * (MAX_INTERVAL - MIN_INTERVAL) + MIN_INTERVAL;
      timerRef.current = setTimeout(() => {
        startFlight();
        scheduleNextFlight();
      }, nextInterval);
    };

    // Delay initial flight slightly, especially for production
    const initialDelay = Math.random() * (MAX_INTERVAL / 4) + (MIN_INTERVAL / 4);
    timerRef.current = setTimeout(() => {
      startFlight();
      scheduleNextFlight();
    }, initialDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (flightTimeoutRef.current) clearTimeout(flightTimeoutRef.current);
    };
  }, []);

  if (!isFlying || !animationProps) {
    return null;
  }

  return (
    <div
      style={{
        top: animationProps.top,
        ['--start-rotation' as string]: `${animationProps.startRotation}deg`,
        ['--end-rotation' as string]: `${animationProps.endRotation}deg`,
        animationDuration: `${ANIMATION_DURATION_S}s`,
      }}
      className={cn(
        'fixed z-[9999] pointer-events-none opacity-0', // Start with opacity 0, animation handles fade in/out
        animationProps.fromLeft ? 'animate-glide' : 'animate-glide-reverse'
      )}
    >
      <SendHorizonal className="w-10 h-10 text-primary drop-shadow-lg" />
    </div>
  );
};

export default PaperAirplaneAnimation;
