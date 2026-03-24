import { useEffect } from 'react';

/**
 * VideoModal component to display and play Instagram reels.
 * Uses Instagram's official embed approach for reliability.
 */
export default function VideoModal({ video, onClose }) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!video) return null;

  const { shortcode, video_url: videoUrl, reel_url: pageUrl, caption, views, likes, comments, posted_at } = video;
  
  // Direct video URL detection (prioritize direct MP4/CDN links)
  const isDirectVideo = !!videoUrl;

  // Extract shortcode if missing
  const finalShortcode = shortcode || pageUrl?.split('/').filter(Boolean).pop();

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-2xl animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="relative w-full h-full sm:h-[90vh] sm:max-w-[420px] md:max-w-[450px] lg:max-w-[480px] xl:max-w-[520px] 2xl:max-w-[560px] sm:aspect-[9/16] bg-black sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex items-center justify-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Overlays: Reel Badge + Caption */}
        <div className="absolute top-6 left-6 right-16 z-20 flex flex-col gap-4 pointer-events-none">
          <div className="flex items-center gap-1.5 w-fit bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <span className="text-xs text-white">▶</span>
            <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase">Reel</span>
          </div>
          
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-[110] w-12 h-12 flex items-center justify-center bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all border border-white/20 shadow-xl"
          aria-label="Close modal"
        >
          <span className="text-xl">✕</span>
        </button>

        {/* Video Playback */}
        <div className="w-full h-full relative">
          {isDirectVideo ? (
            <video 
              src={videoUrl} 
              className="w-full h-full object-cover" 
              controls 
              autoPlay 
              playsInline
              loop
            />
          ) : (
            <iframe
              src={`https://www.instagram.com/p/${finalShortcode}/embed/`}
              className="w-full h-full border-none scale-105"
              allowFullScreen={true}
              scrolling="no"
              title="Instagram Reel"
            ></iframe>
          )}
        </div>

        {/* Metrics Overlay (Bottom) */}
        <div className="absolute bottom-10 left-6 right-6 z-20 flex flex-col gap-4 pointer-events-none">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 shadow-lg">
                <span className="text-sm sm:text-lg md:text-xl text-white">👁</span>
                <span className="text-xs sm:text-base font-black text-white">{(views || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 shadow-lg">
                <span className="text-sm sm:text-lg md:text-xl text-pink-500">❤</span>
                <span className="text-xs sm:text-base font-black text-white">{(likes || 0).toLocaleString()}</span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg inline-flex items-center gap-2 mb-2">
                <span className="text-[10px] sm:text-sm text-slate-300">💬</span>
                <span className="text-[10px] sm:text-sm font-bold text-white">{(comments || 0).toLocaleString()}</span>
              </div>
              <div className="text-[8px] sm:text-[10px] text-slate-300 font-black uppercase tracking-widest opacity-80 px-2 py-1 bg-black/40 rounded-lg w-fit ml-auto">
                {posted_at
                  ? new Date(posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'RECENT REEL'}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Ambient Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10"></div>
      </div>
    </div>
  );
}
