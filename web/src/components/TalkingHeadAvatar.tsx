import { useEffect, useRef, useCallback, useState } from 'react';
import type { TalkingHead as TalkingHeadClass } from '@met4citizen/talkinghead';

interface TalkingHeadAvatarProps {
  isSpeaking: boolean;
  textToSpeak?: string | null;
  className?: string;
  mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'fear' | 'disgust' | 'love' | 'sleep';
  avatarUrl?: string;
  bodyType?: 'M' | 'F';
}

// Default avatar URL - using a free Ready Player Me avatar
// Users can create their own at https://readyplayer.me
const DEFAULT_AVATAR_URL = '/avatars/avatar-3d.glb';

/**
 * 3D Talking Head Avatar component using the TalkingHead library.
 * Provides realistic lip-sync and expressions for a more immersive experience.
 */
export function TalkingHeadAvatar({
  isSpeaking,
  textToSpeak,
  className = '',
  mood = 'neutral',
  avatarUrl = DEFAULT_AVATAR_URL,
  bodyType = 'F',
}: TalkingHeadAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<TalkingHeadClass | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const prevSpeakingRef = useRef(false);
  const lastSpokenTextRef = useRef<string | null>(null);

  // Initialize TalkingHead
  const initTalkingHead = useCallback(async () => {
    if (!containerRef.current || headRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      // Dynamically import TalkingHead (ES module)
      const { TalkingHead } = await import('@met4citizen/talkinghead');

      // Create TalkingHead instance
      const head = new TalkingHead(containerRef.current, {
        ttsEndpoint: null, // We'll use our own TTS
        ttsApikey: null,
        lipsyncModules: ['en'],
        lipsyncLang: 'en',
        cameraView: 'full', // Full body view
        cameraDistance: 0,
        cameraRotateEnable: true,
        cameraPanEnable: false,
        cameraZoomEnable: true,
        lightAmbientColor: 0x1a1d21,
        lightAmbientIntensity: 2,
        lightDirectColor: 0x10b981, // Emerald accent
        lightDirectIntensity: 15,
        lightSpotIntensity: 0,
        avatarMood: mood,
        modelFPS: 30,
      });

      headRef.current = head;

      // Load avatar
      await head.showAvatar({
        url: avatarUrl,
        body: bodyType,
        avatarMood: mood,
        lipsyncLang: 'en',
      });

      // Set initial view - full body with appropriate distance
      head.setView('full', {
        cameraDistance: 0.5,
        cameraY: 0,
      });

      setIsInitialized(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to initialize TalkingHead:', err);
      setError(err instanceof Error ? err.message : 'Failed to load 3D avatar');
      setIsLoading(false);
    }
  }, [avatarUrl, bodyType, mood]);

  // Initialize on mount
  useEffect(() => {
    initTalkingHead();

    return () => {
      if (headRef.current) {
        headRef.current.stop();
        headRef.current = null;
      }
    };
  }, [initTalkingHead]);

  // Handle mood changes
  useEffect(() => {
    if (headRef.current && isInitialized) {
      headRef.current.setMood(mood);
    }
  }, [mood, isInitialized]);

  // Handle text to speak - trigger lip sync animation
  useEffect(() => {
    if (!headRef.current || !isInitialized || !textToSpeak) return;
    
    // Only speak if this is new text
    if (textToSpeak === lastSpokenTextRef.current) return;
    lastSpokenTextRef.current = textToSpeak;

    const head = headRef.current;
    
    // Use TalkingHead's speakText for lip sync animation
    // The audio is muted since we use browser TTS for actual audio
    try {
      head.speakText(textToSpeak, {
        avatarMood: 'happy',
        avatarMute: true, // Mute TalkingHead audio - we use browser TTS
      });
      head.lookAtCamera(30000);
    } catch (err) {
      console.warn('TalkingHead speakText failed:', err);
    }
  }, [textToSpeak, isInitialized]);

  // Handle speaking state changes - animate mood
  useEffect(() => {
    if (!headRef.current || !isInitialized) return;

    const head = headRef.current;

    if (isSpeaking && !prevSpeakingRef.current) {
      // Started speaking
      head.setMood('happy');
      head.lookAtCamera(30000);
    } else if (!isSpeaking && prevSpeakingRef.current) {
      // Stopped speaking - return to neutral and reset spoken text
      head.setMood(mood);
      lastSpokenTextRef.current = null;
    }

    prevSpeakingRef.current = isSpeaking;
  }, [isSpeaking, isInitialized, mood]);

  return (
    <div className={`relative ${className}`}>
      {/* TalkingHead container - ALWAYS rendered so ref is available for initialization */}
      <div
        ref={containerRef}
        className={`w-full h-full min-h-[400px] rounded-xl overflow-hidden ${
          isLoading || error ? 'invisible' : ''
        }`}
        style={{ background: 'transparent' }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-400">Loading 3D Avatar...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-6 bg-slate-800/50 rounded-xl border border-red-500/20">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-400 mb-2">Failed to load 3D avatar</p>
            <p className="text-xs text-slate-500">{error}</p>
            <p className="text-xs text-slate-500 mt-2">
              Make sure you have a GLB avatar file at:<br />
              <code className="text-emerald-400">{avatarUrl}</code>
            </p>
            <button
              onClick={() => {
                setError(null);
                setIsLoading(true);
                headRef.current = null;
                initTalkingHead();
              }}
              className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-sm text-slate-300 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Speaking glow effect */}
      {isSpeaking && !isLoading && !error && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-emerald-500/20 to-transparent animate-pulse" />
        </div>
      )}
    </div>
  );
}

export default TalkingHeadAvatar;
