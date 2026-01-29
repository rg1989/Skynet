import { useEffect, useRef } from 'react';
import type { AvatarDesign } from '../store';

interface CyberFaceProps {
  design: Exclude<AvatarDesign, 'image'>;
  isSpeaking: boolean;
  className?: string;
}

/**
 * Cyber face avatar component with 3 design variants and mouth animation.
 * The mouth animates when isSpeaking is true.
 */
export function CyberFace({ design, isSpeaking, className = '' }: CyberFaceProps) {
  const mouthRef = useRef<SVGPathElement | SVGEllipseElement | null>(null);
  const animationRef = useRef<number | undefined>(undefined);

  // Animate mouth when speaking
  useEffect(() => {
    if (!mouthRef.current) return;

    if (isSpeaking) {
      let time = 0;
      const animate = () => {
        time += 0.15;
        // Create a natural-looking mouth movement
        const openAmount = 1 + Math.sin(time * 3) * 0.3 + Math.sin(time * 7) * 0.2;
        
        if (mouthRef.current) {
          mouthRef.current.style.transform = `scaleY(${openAmount})`;
        }
        
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Reset mouth to closed position
      if (mouthRef.current) {
        mouthRef.current.style.transform = 'scaleY(1)';
      }
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

  switch (design) {
    case 'geometric':
      return <GeometricFace mouthRef={mouthRef} isSpeaking={isSpeaking} className={className} />;
    case 'holographic':
      return <HolographicFace mouthRef={mouthRef} isSpeaking={isSpeaking} className={className} />;
    case 'android':
      return <AndroidFace mouthRef={mouthRef} isSpeaking={isSpeaking} className={className} />;
    default:
      return <GeometricFace mouthRef={mouthRef} isSpeaking={isSpeaking} className={className} />;
  }
}

interface FaceProps {
  mouthRef: React.RefObject<SVGPathElement | SVGEllipseElement | null>;
  isSpeaking: boolean;
  className?: string;
}

/**
 * Design 1: Geometric - Angular, neon-outlined face with circuit patterns
 */
function GeometricFace({ mouthRef, isSpeaking, className }: FaceProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`w-full h-full ${className}`}
      style={{ filter: isSpeaking ? 'drop-shadow(0 0 20px #10b981)' : 'drop-shadow(0 0 10px #10b981)' }}
    >
      <defs>
        <linearGradient id="geo-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
        </linearGradient>
        <filter id="geo-blur">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Background glow */}
      <circle cx="100" cy="100" r="90" fill="url(#geo-glow)" opacity="0.1" />

      {/* Face outline - angular hexagon shape */}
      <path
        d="M100 15 L170 50 L170 130 L100 185 L30 130 L30 50 Z"
        fill="none"
        stroke="url(#geo-glow)"
        strokeWidth="2"
        className={isSpeaking ? 'animate-pulse' : ''}
      />

      {/* Inner face lines - circuit pattern */}
      <path
        d="M50 70 L80 70 L90 60 L110 60 L120 70 L150 70"
        fill="none"
        stroke="#10b981"
        strokeWidth="1"
        opacity="0.5"
      />
      <path
        d="M60 130 L80 130 L90 140 L110 140 L120 130 L140 130"
        fill="none"
        stroke="#10b981"
        strokeWidth="1"
        opacity="0.5"
      />

      {/* Left eye - diamond shape */}
      <g className={isSpeaking ? 'animate-pulse' : ''}>
        <path
          d="M65 85 L80 75 L95 85 L80 95 Z"
          fill="#10b981"
          opacity="0.8"
        />
        <circle cx="80" cy="85" r="5" fill="#fff" />
      </g>

      {/* Right eye - diamond shape */}
      <g className={isSpeaking ? 'animate-pulse' : ''}>
        <path
          d="M105 85 L120 75 L135 85 L120 95 Z"
          fill="#10b981"
          opacity="0.8"
        />
        <circle cx="120" cy="85" r="5" fill="#fff" />
      </g>

      {/* Mouth - horizontal line that scales */}
      <path
        ref={mouthRef as React.RefObject<SVGPathElement>}
        d="M75 130 L100 135 L125 130"
        fill="none"
        stroke="#10b981"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ transformOrigin: '100px 132px' }}
      />

      {/* Decorative elements */}
      <circle cx="100" cy="50" r="3" fill="#06b6d4" className={isSpeaking ? 'animate-ping' : ''} />
      <circle cx="50" cy="100" r="2" fill="#10b981" opacity="0.6" />
      <circle cx="150" cy="100" r="2" fill="#10b981" opacity="0.6" />
    </svg>
  );
}

/**
 * Design 2: Holographic - Soft glowing orbs for eyes, translucent layers
 */
function HolographicFace({ mouthRef, isSpeaking, className }: FaceProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`w-full h-full ${className}`}
      style={{ filter: isSpeaking ? 'drop-shadow(0 0 25px #8b5cf6)' : 'drop-shadow(0 0 12px #8b5cf6)' }}
    >
      <defs>
        <radialGradient id="holo-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.1" />
        </radialGradient>
        <radialGradient id="eye-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="50%" stopColor="#c4b5fd" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
        </radialGradient>
        <filter id="holo-blur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Outer glow rings */}
      <circle cx="100" cy="100" r="95" fill="none" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.3" />
      <circle cx="100" cy="100" r="85" fill="none" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.4" />
      <circle cx="100" cy="100" r="75" fill="none" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.5" />

      {/* Face base - translucent oval */}
      <ellipse
        cx="100"
        cy="100"
        rx="70"
        ry="85"
        fill="url(#holo-glow)"
        className={isSpeaking ? 'animate-pulse' : ''}
      />

      {/* Left eye - glowing orb */}
      <g>
        <circle cx="70" cy="85" r="20" fill="url(#eye-glow)" filter="url(#holo-blur)" opacity="0.5" />
        <circle cx="70" cy="85" r="12" fill="url(#eye-glow)" />
        <circle cx="70" cy="85" r="6" fill="#fff" className={isSpeaking ? 'animate-pulse' : ''} />
        <circle cx="73" cy="82" r="2" fill="#fff" opacity="0.8" />
      </g>

      {/* Right eye - glowing orb */}
      <g>
        <circle cx="130" cy="85" r="20" fill="url(#eye-glow)" filter="url(#holo-blur)" opacity="0.5" />
        <circle cx="130" cy="85" r="12" fill="url(#eye-glow)" />
        <circle cx="130" cy="85" r="6" fill="#fff" className={isSpeaking ? 'animate-pulse' : ''} />
        <circle cx="133" cy="82" r="2" fill="#fff" opacity="0.8" />
      </g>

      {/* Mouth - soft ellipse */}
      <ellipse
        ref={mouthRef as React.RefObject<SVGEllipseElement>}
        cx="100"
        cy="140"
        rx="25"
        ry="6"
        fill="#8b5cf6"
        opacity="0.7"
        style={{ transformOrigin: '100px 140px' }}
      />

      {/* Floating particles */}
      <circle cx="45" cy="60" r="2" fill="#c4b5fd" className="animate-bounce" style={{ animationDelay: '0s' }} />
      <circle cx="155" cy="65" r="1.5" fill="#c4b5fd" className="animate-bounce" style={{ animationDelay: '0.3s' }} />
      <circle cx="100" cy="30" r="2" fill="#c4b5fd" className="animate-bounce" style={{ animationDelay: '0.6s' }} />
      <circle cx="60" cy="170" r="1.5" fill="#c4b5fd" className="animate-bounce" style={{ animationDelay: '0.9s' }} />
      <circle cx="140" cy="165" r="2" fill="#c4b5fd" className="animate-bounce" style={{ animationDelay: '1.2s' }} />
    </svg>
  );
}

/**
 * Design 3: Android - Metallic panels, visible seams, LED indicators
 */
function AndroidFace({ mouthRef, isSpeaking, className }: FaceProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`w-full h-full ${className}`}
      style={{ filter: isSpeaking ? 'drop-shadow(0 0 15px #f59e0b)' : 'drop-shadow(0 0 8px #64748b)' }}
    >
      <defs>
        <linearGradient id="metal-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="50%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="panel-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* Head - metallic rounded rectangle */}
      <rect
        x="30"
        y="25"
        width="140"
        height="160"
        rx="30"
        fill="url(#metal-gradient)"
        stroke="#94a3b8"
        strokeWidth="2"
      />

      {/* Face plate - inner panel */}
      <rect
        x="45"
        y="40"
        width="110"
        height="130"
        rx="15"
        fill="url(#panel-gradient)"
        stroke="#475569"
        strokeWidth="1"
      />

      {/* Panel seams */}
      <line x1="100" y1="40" x2="100" y2="60" stroke="#475569" strokeWidth="1" />
      <line x1="100" y1="140" x2="100" y2="170" stroke="#475569" strokeWidth="1" />
      <line x1="45" y1="100" x2="65" y2="100" stroke="#475569" strokeWidth="1" />
      <line x1="135" y1="100" x2="155" y2="100" stroke="#475569" strokeWidth="1" />

      {/* Left eye - LED display */}
      <g>
        <rect x="55" y="70" width="35" height="25" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1" />
        <rect
          x="60"
          y="75"
          width="25"
          height="15"
          rx="3"
          fill={isSpeaking ? '#f59e0b' : '#22c55e'}
          className={isSpeaking ? 'animate-pulse' : ''}
        />
        <circle cx="65" cy="82" r="3" fill="#fff" opacity="0.5" />
      </g>

      {/* Right eye - LED display */}
      <g>
        <rect x="110" y="70" width="35" height="25" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1" />
        <rect
          x="115"
          y="75"
          width="25"
          height="15"
          rx="3"
          fill={isSpeaking ? '#f59e0b' : '#22c55e'}
          className={isSpeaking ? 'animate-pulse' : ''}
        />
        <circle cx="120" cy="82" r="3" fill="#fff" opacity="0.5" />
      </g>

      {/* Mouth - LED bar */}
      <g>
        <rect x="70" y="125" width="60" height="20" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1" />
        <rect
          ref={mouthRef as React.RefObject<SVGRectElement>}
          x="75"
          y="130"
          width="50"
          height="10"
          rx="2"
          fill={isSpeaking ? '#f59e0b' : '#64748b'}
          style={{ transformOrigin: '100px 135px' }}
        />
      </g>

      {/* Status LEDs */}
      <circle cx="55" cy="50" r="4" fill={isSpeaking ? '#22c55e' : '#475569'} className={isSpeaking ? 'animate-ping' : ''} />
      <circle cx="145" cy="50" r="4" fill="#3b82f6" />
      <circle cx="100" cy="165" r="3" fill={isSpeaking ? '#f59e0b' : '#475569'} />

      {/* Antenna / sensor */}
      <rect x="95" y="10" width="10" height="20" rx="3" fill="#64748b" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="100" cy="8" r="5" fill={isSpeaking ? '#22c55e' : '#64748b'} className={isSpeaking ? 'animate-pulse' : ''} />

      {/* Side vents */}
      <g opacity="0.5">
        <rect x="20" y="80" width="8" height="3" fill="#334155" />
        <rect x="20" y="90" width="8" height="3" fill="#334155" />
        <rect x="20" y="100" width="8" height="3" fill="#334155" />
        <rect x="172" y="80" width="8" height="3" fill="#334155" />
        <rect x="172" y="90" width="8" height="3" fill="#334155" />
        <rect x="172" y="100" width="8" height="3" fill="#334155" />
      </g>
    </svg>
  );
}

export default CyberFace;
