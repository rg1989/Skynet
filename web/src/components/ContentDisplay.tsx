interface ContentDisplayProps {
  url: string | null;
  onClose: () => void;
}

/**
 * Content display area for showing images, maps, or other content
 * that the agent wants to share in Avatar Mode.
 */
export function ContentDisplay({ url, onClose }: ContentDisplayProps) {
  if (!url) return null;

  // Determine content type based on URL
  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || url.startsWith('data:image');
  const isVideo = url.match(/\.(mp4|webm|ogg)$/i);

  return (
    <div className="absolute inset-0 bg-[#1a1d21]/95 backdrop-blur-sm flex flex-col z-10">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
        <span className="text-sm text-slate-400">Shared Content</span>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        {isImage && (
          <img
            src={url}
            alt="Shared content"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        )}
        
        {isVideo && (
          <video
            src={url}
            controls
            className="max-w-full max-h-full rounded-lg shadow-2xl"
          />
        )}
        
        {!isImage && !isVideo && (
          <iframe
            src={url}
            className="w-full h-full rounded-lg border border-slate-700"
            title="Shared content"
          />
        )}
      </div>
    </div>
  );
}

export default ContentDisplay;
