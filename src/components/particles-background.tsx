'use client';

import React, { useEffect, useRef } from 'react';

const ParticlesBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const particles: Particle[] = [];
    const particleCount = 50;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;

      constructor(color: string) {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 1 - 0.5;
        this.speedY = Math.random() * 1 - 0.5;
        this.color = color;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.size > 0.1) this.size -= 0.01;

        if (this.x < 0 || this.x > canvas!.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas!.height) this.speedY *= -1;
      }

      draw() {
        ctx!.fillStyle = this.color;
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    const init = () => {
      particles.length = 0; // Clear existing particles
      // Use --muted-foreground for particle color for a subtle effect
      const particleColor = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() || '#888888'; // Fallback color
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(particleColor));
      }
    };

    const animate = () => {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      particles.forEach(particle => {
        if (particle.size > 0.1) {
          particle.update();
          particle.draw();
        }
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        init(); // Re-initialize particles on resize
      }
    };
    
    init();
    animate();

    window.addEventListener('resize', handleResize);

    // Observe theme changes to update particle color
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mutation.target === document.documentElement) {
          // Theme might have changed, re-initialize particles with new color
          setTimeout(init, 50); // Timeout to allow CSS vars to update
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });


    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed top-0 left-0 -z-10 pointer-events-none" />;
};

export default ParticlesBackground;
