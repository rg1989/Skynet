import { useEffect, useState, useRef } from 'react';

// Avatar frame images - order from closed to wide open
const AVATAR_FRAMES = [
  '/avatars/avatar-mouth-closed.png',
  '/avatars/avatar-mouth-slight.png',
  '/avatars/avatar-mouth-medium.png',
  '/avatars/avatar-mouth-wide.png',
];

interface ImageAvatarProps {
  isSpeaking: boolean;
  className?: string;
}

/**
 * Image-based avatar component that cycles through mouth animation frames.
 * Uses pre-generated images with different mouth positions for a talking effect.
 */
export function ImageAvatar({ isSpeaking, className = '' }: ImageAvatarProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const animationRef = useRef<number | undefined>(undefined);
  const lastFrameTime = useRef(0);
  
  // Animation parameters
  const frameInterval = 120; // ms between frame changes (adjust for speed)

  useEffect(() => {
    if (isSpeaking) {
      let patternIndex = 0;
      // Natural speaking pattern using all 4 frames (0=closed, 1=slight, 2=medium, 3=wide)
      const pattern = [0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 3, 2, 1, 0];
      
      const animate = (timestamp: number) => {
        if (timestamp - lastFrameTime.current >= frameInterval) {
          patternIndex = (patternIndex + 1) % pattern.length;
          setCurrentFrame(pattern[patternIndex]);
          lastFrameTime.current = timestamp;
        }
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Reset to closed mouth when not speaking
      setCurrentFrame(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSpeaking]);

  return (
    <div className={`relative ${className}`}>
      {/* Preload all frames */}
      <div className="hidden">
        {AVATAR_FRAMES.map((src, i) => (
          <img key={i} src={src} alt="" />
        ))}
      </div>
      
      {/* Current frame */}
      <img
        src={AVATAR_FRAMES[currentFrame]}
        alt="AI Avatar"
        className={`w-full h-full object-contain transition-opacity duration-75 ${
          isSpeaking ? 'drop-shadow-[0_0_30px_rgba(16,185,129,0.4)]' : ''
        }`}
      />
      
      {/* Speaking glow effect */}
      {isSpeaking && (
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent pointer-events-none animate-pulse" />
      )}
    </div>
  );
}

export default ImageAvatar;
