/**
 * Type declarations for @met4citizen/talkinghead
 * @see https://github.com/met4citizen/TalkingHead
 */
declare module '@met4citizen/talkinghead' {
  export interface TalkingHeadOptions {
    /** Function to get JWT token for TTS proxy */
    jwtGet?: (() => Promise<string>) | null;
    /** Text-to-speech backend endpoint */
    ttsEndpoint?: string | null;
    /** Google TTS API key (not recommended for production) */
    ttsApikey?: string | null;
    /** Google TTS language */
    ttsLang?: string;
    /** Google TTS voice */
    ttsVoice?: string;
    /** TTS rate (0.25-4.0) */
    ttsRate?: number;
    /** TTS pitch (-20.0 to 20.0) */
    ttsPitch?: number;
    /** TTS volume gain in dB (-96.0 to 16.0) */
    ttsVolume?: number;
    /** Trim viseme sequence start (ms) */
    ttsTrimStart?: number;
    /** Trim viseme sequence end (ms) */
    ttsTrimEnd?: number;
    /** Gain for speech audio */
    mixerGainSpeech?: number;
    /** Gain for background audio */
    mixerGainBackground?: number;
    /** Lip-sync language modules to load */
    lipsyncModules?: string[];
    /** Default lip-sync language */
    lipsyncLang?: string;
    /** PCM sample rate for speakAudio (Hz) */
    pcmSampleRate?: number;
    /** AudioContext to use */
    audioCtx?: AudioContext | null;
    /** Root name of the armature */
    modelRoot?: string;
    /** Device pixel ratio */
    modelPixelRatio?: number;
    /** Target FPS */
    modelFPS?: number;
    /** Upper body movement factor (0-1) */
    modelMovementFactor?: number;
    /** Enable Draco compression */
    dracoEnabled?: boolean;
    /** Draco decoder path */
    dracoDecoderPath?: string;
    /** Initial camera view */
    cameraView?: 'full' | 'mid' | 'upper' | 'head';
    /** Camera distance offset (meters) */
    cameraDistance?: number;
    /** Camera X offset (meters) */
    cameraX?: number;
    /** Camera Y offset (meters) */
    cameraY?: number;
    /** Camera X rotation offset (radians) */
    cameraRotateX?: number;
    /** Camera Y rotation offset (radians) */
    cameraRotateY?: number;
    /** Allow user to rotate model */
    cameraRotateEnable?: boolean;
    /** Allow user to pan model */
    cameraPanEnable?: boolean;
    /** Allow user to zoom model */
    cameraZoomEnable?: boolean;
    /** Ambient light color */
    lightAmbientColor?: number;
    /** Ambient light intensity */
    lightAmbientIntensity?: number;
    /** Direction light color */
    lightDirectColor?: number;
    /** Direction light intensity */
    lightDirectIntensity?: number;
    /** Direction light phi angle */
    lightDirectPhi?: number;
    /** Direction light theta angle */
    lightDirectTheta?: number;
    /** Spot light color */
    lightSpotColor?: number;
    /** Spot light intensity */
    lightSpotIntensity?: number;
    /** Spot light phi angle */
    lightSpotPhi?: number;
    /** Spot light theta angle */
    lightSpotTheta?: number;
    /** Spot light dispersion */
    lightSpotDispersion?: number;
    /** Avatar mood */
    avatarMood?: string;
    /** Mute avatar */
    avatarMute?: boolean;
    /** Eye contact proportion while idle (0-1) */
    avatarIdleEyeContact?: number;
    /** Head movement proportion while idle (0-1) */
    avatarIdleHeadMove?: number;
    /** Eye contact proportion while speaking (0-1) */
    avatarSpeakingEyeContact?: number;
    /** Head movement proportion while speaking (0-1) */
    avatarSpeakingHeadMove?: number;
    /** Avatar ignores camera */
    avatarIgnoreCamera?: boolean;
    /** Avatar-only mode (no scene/renderer) */
    avatarOnly?: boolean;
    /** Camera for avatarOnly mode */
    avatarOnlyCamera?: unknown | null;
    /** Scene for avatarOnly mode */
    avatarOnlyScene?: unknown | null;
    /** Custom update callback */
    update?: ((dt: number) => void) | null;
    /** Stats display parent node */
    statsNode?: HTMLElement | null;
    /** Stats element CSS style */
    statsStyle?: string | null;
  }

  export interface AvatarConfig {
    /** URL to GLB avatar file */
    url: string;
    /** Body type: male or female */
    body?: 'M' | 'F';
    /** Lip-sync language */
    lipsyncLang?: string;
    /** Enable lip-sync head movement */
    lipsyncHeadMovement?: boolean;
    /** Blend shape baseline */
    baseline?: Record<string, number>;
    /** Skeleton retargeting */
    retarget?: Record<string, unknown>;
    /** Dynamic bones configuration */
    modelDynamicBones?: unknown[];
    /** TTS language */
    ttsLang?: string;
    /** TTS voice */
    ttsVoice?: string;
    /** TTS rate */
    ttsRate?: number;
    /** TTS pitch */
    ttsPitch?: number;
    /** TTS volume */
    ttsVolume?: number;
    /** Avatar mood */
    avatarMood?: string;
    /** Mute avatar */
    avatarMute?: boolean;
    /** Idle eye contact */
    avatarIdleEyeContact?: number;
    /** Speaking eye contact */
    avatarSpeakingEyeContact?: number;
    /** Listening eye contact */
    avatarListeningEyeContact?: number;
    /** Ignore camera */
    avatarIgnoreCamera?: boolean;
  }

  export interface SpeakOptions {
    /** Lip-sync language */
    lipsyncLang?: string;
    /** TTS language */
    ttsLang?: string;
    /** TTS voice */
    ttsVoice?: string;
    /** TTS rate */
    ttsRate?: number;
    /** TTS pitch */
    ttsPitch?: number;
    /** TTS volume */
    ttsVolume?: number;
    /** Avatar mood */
    avatarMood?: string;
    /** Mute avatar */
    avatarMute?: boolean;
  }

  export interface AudioData {
    /** Audio buffer or PCM chunks */
    audio: AudioBuffer | ArrayBuffer[];
    /** Words array */
    words?: string[];
    /** Word start times (ms) */
    wtimes?: number[];
    /** Word durations (ms) */
    wdurations?: number[];
    /** Viseme IDs */
    visemes?: string[];
    /** Viseme start times (ms) */
    vtimes?: number[];
    /** Viseme durations (ms) */
    vdurations?: number[];
    /** Marker callbacks */
    markers?: (() => void)[];
    /** Marker times (ms) */
    mtimes?: number[];
    /** Animation template */
    anim?: {
      name: string;
      dt: number[];
      vs: Record<string, number[]>;
    };
  }

  export interface ViewOptions {
    /** Camera distance offset */
    cameraDistance?: number;
    /** Camera X offset */
    cameraX?: number;
    /** Camera Y offset */
    cameraY?: number;
    /** Camera X rotation */
    cameraRotateX?: number;
    /** Camera Y rotation */
    cameraRotateY?: number;
  }

  export class TalkingHead {
    constructor(container: HTMLElement, options?: TalkingHeadOptions);

    /** Load and show avatar */
    showAvatar(config: AvatarConfig, onprogress?: ((progress: number) => void) | null): Promise<void>;

    /** Set camera view */
    setView(view: 'full' | 'mid' | 'upper' | 'head', options?: ViewOptions): void;

    /** Set lighting */
    setLighting(options: Partial<TalkingHeadOptions>): void;

    /** Speak text using TTS */
    speakText(
      text: string,
      options?: SpeakOptions,
      onsubtitles?: ((text: string) => void) | null,
      excludes?: [number, number][]
    ): void;

    /** Speak with custom audio */
    speakAudio(
      audio: AudioData,
      options?: SpeakOptions,
      onsubtitles?: ((text: string) => void) | null
    ): void;

    /** Speak an emoji */
    speakEmoji(emoji: string): void;

    /** Add a break (ms) */
    speakBreak(duration: number): void;

    /** Add a marker callback */
    speakMarker(callback: () => void): void;

    /** Look at screen position */
    lookAt(x: number, y: number, duration: number): void;

    /** Look ahead */
    lookAhead(duration: number): void;

    /** Look at camera */
    lookAtCamera(duration: number): void;

    /** Maintain eye contact */
    makeEyeContact(duration: number): void;

    /** Set mood */
    setMood(mood: string): void;

    /** Play background audio */
    playBackgroundAudio(url: string): void;

    /** Stop background audio */
    stopBackgroundAudio(): void;

    /** Set mixer gain */
    setMixerGain(speech: number | null, background?: number | null, fadeSecs?: number): void;

    /** Play Mixamo animation */
    playAnimation(
      url: string,
      onprogress?: ((progress: number) => void) | null,
      duration?: number,
      index?: number,
      scale?: number
    ): void;

    /** Stop animation */
    stopAnimation(): void;

    /** Play pose */
    playPose(
      url: string,
      onprogress?: ((progress: number) => void) | null,
      duration?: number,
      index?: number,
      scale?: number
    ): void;

    /** Stop pose */
    stopPose(): void;

    /** Play gesture */
    playGesture(name: string, duration?: number, mirror?: boolean, transitionMs?: number): void;

    /** Stop gesture */
    stopGesture(transitionMs?: number): void;

    /** Start listening */
    startListening(
      analyzer: AnalyserNode,
      options?: Partial<TalkingHeadOptions>,
      onchange?: ((state: string) => void) | null
    ): void;

    /** Stop listening */
    stopListening(): void;

    /** Start animation loop */
    start(): void;

    /** Stop animation loop */
    stop(): void;

    /** Animate (for avatarOnly mode) */
    animate(deltaMs: number): void;

    /** The Three.js scene */
    scene: unknown;

    /** The Three.js camera */
    camera: unknown;

    /** The armature object */
    armature: unknown;

    /** Morph target avatar data */
    mtAvatar: Record<string, { realtime: number | null; needsUpdate: boolean }>;

    /** Pose templates */
    poseTemplates: Record<string, unknown>;

    /** Animation moods */
    animMoods: Record<string, unknown>;

    /** Gesture templates */
    gestureTemplates: Record<string, unknown>;

    /** Animated emojis */
    animEmojis: Record<string, unknown>;

    /** Target to speak to */
    speakTo: TalkingHead | unknown | null;
  }
}
