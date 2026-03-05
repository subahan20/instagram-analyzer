import { useEffect } from 'react';

/**
 * VideoModal component to display and play Instagram reels.
 * Uses Instagram's official embed approach for reliability.
 */
export default function VideoModal({ shortcode, videoUrl, onClose }) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!shortcode && !videoUrl) return null;

  // Determine if it's a direct video URL (often from FB/IG CDN)
  const isDirectVideo = videoUrl && (
    videoUrl.includes('.mp4') || 
    videoUrl.includes('fbcdn.net') || 
    videoUrl.includes('instagram.com') && videoUrl.includes('_n.mp4')
  );

  // Standard post embed URL often works better than /reels/ embed
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-2xl animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-[min(90vw,450px)] aspect-[9/16] bg-black rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - Larger and more prominent on mobile */}
        <button 
          onClick={onClose}
          className="absolute top-4 sm:top-6 right-4 sm:right-6 z-[110] w-12 h-12 sm:w-10 sm:h-10 flex items-center justify-center bg-black/40 sm:bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all border border-white/20 shadow-xl"
          aria-label="Close modal"
        >
          <span className="text-xl sm:text-base">✕</span>
        </button>

        {isDirectVideo ? (
          <video 
            src={videoUrl} 
            className="w-full h-full object-contain" 
            controls 
            autoPlay 
            playsInline
          />
        ) : (
          <iframe
            src={embedUrl}
            className="w-full h-full border-none"
            allowTransparency="true"
            allowFullScreen="true"
            scrolling="no"
            title="Instagram Reel"
          ></iframe>
        )}
      </div>
    </div>
  );
}
