import { useEffect } from 'react';

/**
 * VideoModal component to display and play Instagram reels.
 * Uses Instagram's official embed approach for reliability.
 */
export default function VideoModal({ video, onClose }) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    const { body } = document;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = 'unset';
    };
  }, []);

  if (!video) return null;

  const { 
    shortcode, 
    video_url: videoUrl, 
    reel_url: pageUrl, 
    caption, 
    views: vRaw, 
    video_play_count: vpc,
    likes, 
    comments, 
    posted_at 
  } = video;

  const displayViews = vpc ?? vRaw ?? 0;
  
  // Direct video URL detection (prioritize direct MP4/CDN links)
  const isDirectVideo = !!videoUrl;

  // Extract shortcode if missing
  const finalShortcode = shortcode || pageUrl?.split('/').filter(Boolean).pop();

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-canvas/80 dark:bg-slate-950/80 backdrop-blur-2xl animate-in fade-in duration-300 transition-colors"
      onClick={onClose}
    >
      <div 
        className="relative w-full h-full sm:h-[90vh] sm:max-w-[420px] md:max-w-[450px] lg:max-w-[480px] xl:max-w-[520px] 2xl:max-w-[560px] sm:aspect-[9/16] bg-black sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex items-center justify-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Overlays: Reel Badge + Caption */}
        <div className="absolute top-6 left-6 right-16 z-20 flex flex-col gap-4 pointer-events-none">
          <div className="flex items-center gap-1.5 w-fit bg-slate-900/40 dark:bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 transition-colors">
            <span className="text-xs text-primary dark:text-white transition-colors">▶</span>
            <span className="text-[10px] font-black tracking-[0.2em] text-primary dark:text-white uppercase transition-colors">Reel</span>
          </div>
          
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-[110] w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-black/40 hover:bg-slate-200 dark:hover:bg-black/60 backdrop-blur-md rounded-full text-primary dark:text-white transition-all border border-slate-200 dark:border-white/20 shadow-xl active:scale-95"
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
              <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-lg transition-colors">
                <span className="text-sm sm:text-lg md:text-xl text-primary dark:text-white transition-colors">▶</span>
                <span className="text-xs sm:text-base font-black text-primary dark:text-white transition-colors">{displayViews.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-lg transition-colors">
                <span className="text-sm sm:text-lg md:text-xl text-pink-500">❤</span>
                <span className="text-xs sm:text-base font-black text-primary dark:text-white transition-colors">{(likes || 0).toLocaleString()}</span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="bg-slate-100 dark:bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 shadow-lg inline-flex items-center gap-2 mb-2 transition-colors">
                <span className="text-[10px] sm:text-sm text-secondary transition-colors">💬</span>
                <span className="text-[10px] sm:text-sm font-bold text-primary dark:text-white transition-colors">{(comments || 0).toLocaleString()}</span>
              </div>
              <div className="text-[8px] sm:text-[10px] text-secondary font-black uppercase tracking-widest opacity-80 px-2 py-1 bg-slate-100 dark:bg-black/40 rounded-lg w-fit ml-auto transition-colors">
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
