import { useEffect, useState, useRef } from 'react';

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
  const [videoFailed, setVideoFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Extract shortcode
  const finalShortcode = shortcode || pageUrl?.split('/').filter(Boolean).pop();

  // Thumbnail from shortcode
  const thumbUrl = finalShortcode 
    ? `https://images.weserv.nl/?url=${encodeURIComponent(`https://www.instagram.com/p/${finalShortcode}/media/?size=l`)}&w=600&h=1000&fit=cover` 
    : null;

  // Embed URL for the iframe
  const embedUrl = finalShortcode 
    ? `https://www.instagram.com/reel/${finalShortcode}/embed/` 
    : null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="relative w-full h-full sm:h-[90vh] sm:max-w-[420px] md:max-w-[450px] lg:max-w-[480px] xl:max-w-[520px] 2xl:max-w-[560px] sm:aspect-[9/16] bg-black sm:rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center animate-in zoom-in-95 duration-300 border border-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button — Ultra-clean */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 z-[110] w-10 h-10 flex items-center justify-center bg-black/20 hover:bg-black/40 backdrop-blur-xl rounded-full text-white/70 hover:text-white transition-all border border-white/10 shadow-xl active:scale-90 cursor-pointer"
          aria-label="Close modal"
        >
          <span className="text-lg">✕</span>
        </button>

        {/* Video Content */}
        <div className="w-full h-full relative">
          {/* State 1: Try direct video URL first */}
          {!videoFailed && videoUrl && !playing ? (
            <video 
              src={videoUrl} 
              className="w-full h-full object-cover" 
              controls 
              autoPlay 
              playsInline
              loop
              poster={thumbUrl || undefined}
              onError={() => setVideoFailed(true)}
            />
          ) : playing && embedUrl ? (
            /* State 2: Playing — Zoomed iframe to act like 'object-cover' */
            <div className="w-full h-full overflow-hidden relative bg-black">
              <iframe
                src={embedUrl}
                className="absolute border-none"
                style={{ 
                  top: '50%',
                  left: '50%',
                  width: '100%',
                  height: '100%',
                  minWidth: '200%', /* Higher scaling to ensure cover */
                  minHeight: '200%',
                  transform: 'translate(-50%, -50%)',
                }}
                allowFullScreen
                scrolling="no"
                title="Instagram Reel"
              />
            </div>
          ) : (
            /* State 3: Thumbnail with play button */
            <div className="w-full h-full relative">
              {thumbUrl && (
                <img
                  src={thumbUrl}
                  alt={caption || 'Reel'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />

              {/* Minimal Reel badge */}
              <div className="absolute top-5 left-5 z-20">
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                  <span className="text-[10px] text-white/90 font-bold uppercase tracking-widest">Reel</span>
                </div>
              </div>

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => setPlaying(true)}
                  className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-2xl flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all hover:scale-110 cursor-pointer active:scale-95 shadow-2xl group"
                >
                  <svg className="w-8 h-8 text-white transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ultra-Compact Metrics */}
        <div className="absolute bottom-5 left-5 right-5 z-20 pointer-events-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-lg px-2 py-0.5 rounded-md border border-white/5">
                <span className="text-[9px] text-white/40">▶</span>
                <span className="text-[9px] font-medium text-white/80">{displayViews.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-lg px-2 py-0.5 rounded-md border border-white/5">
                <span className="text-[9px] text-pink-500/60">♥</span>
                <span className="text-[9px] font-medium text-white/80">{(likes || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-lg px-2 py-0.5 rounded-md border border-white/5">
                <span className="text-[9px] text-white/40">💬</span>
                <span className="text-[9px] font-medium text-white/80">{(comments || 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="text-[8px] font-bold text-white/30 uppercase tracking-tighter">
              {posted_at
                ? new Date(posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : ''}
            </div>
          </div>
        </div>

        {/* Subtle bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10"></div>
      </div>
    </div>
  );
}
