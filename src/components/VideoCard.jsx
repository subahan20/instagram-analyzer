import { useState, useRef, useEffect } from 'react';

const getTimeAgo = (dateString) => {
  if (!dateString) return '';
  try {
    const now = new Date();
    const past = new Date(dateString);
    if (isNaN(past.getTime())) return '';
    const diffInMs = now - past;
    const diffInSecs = Math.floor(diffInMs / 1000);
    const diffInMins = Math.floor(diffInSecs / 60);
    const diffInHours = Math.floor(diffInMins / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInSecs < 60) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)}mo ago`;
    return `${Math.floor(diffInDays / 365)}yr ago`;
  } catch (e) { return ''; }
};

// Detects if a URL is a video file by extension or CDN pattern
const isVideoUrl = (url) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('.mp4') || lower.includes('video') || lower.includes('cdninstagram.com/v/');
};

// Wraps an image URL through the weserv proxy to bypass Instagram CORS
const proxyImg = (url) => {
  if (!url) return null;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=500&h=900&fit=cover`;
};

export default function VideoCard({ video, isViral = false, onVideoClick }) {
  const {
    video_url,
    videoUrl,        // Apify camelCase key — may be stored directly
    media_url,
    display_url,
    thumbnail_url,
    video_play_count,
    videoPlayCount,
    play_count,
    views: viewsRaw,
    likes = 0,
    comments_count,
    comment_count,
    comments: commentsRaw,
    posted_at,
    caption,
    reel_url
  } = video;

  const [isInView, setIsInView] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const views = Number(video_play_count || videoPlayCount || play_count || viewsRaw || 0);
  const timeAgo = getTimeAgo(posted_at);

  // Smart source resolution — handles both snake_case (DB) and camelCase (Apify raw)
  const resolvedVideoSrc = video_url || videoUrl || media_url || (isVideoUrl(display_url) ? display_url : null);

  // Thumbnail: use display_url only if it is NOT a video file
  const resolvedThumbSrc = (!isVideoUrl(display_url) && display_url)
    ? display_url
    : thumbnail_url || null;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const proxiedThumb = proxyImg(resolvedThumbSrc);

  // Extract shortcode from reel_url for fallback thumbnail
  const shortcode = reel_url?.split('/').filter(Boolean).pop() || null;

  // Fallback thumbnail from Instagram's public media endpoint via proxy
  const shortcodeThumb = shortcode 
    ? `https://wsrv.nl/?url=${encodeURIComponent(`https://www.instagram.com/p/${shortcode}/media/?size=l`)}&w=500&h=900&fit=cover`
    : null;

  const [shortcodeImgError, setShortcodeImgError] = useState(false);
  const [oembedThumb, setOembedThumb] = useState(null);
  const [oembedTried, setOembedTried] = useState(false);

  // oEmbed fallback — fetch thumbnail from Instagram's public oEmbed endpoint
  useEffect(() => {
    if (!reel_url || !imgError || !shortcodeImgError || oembedTried) return;
    setOembedTried(true);
    fetch(`https://api.instagram.com/oembed/?url=${encodeURIComponent(reel_url)}`)
      .then(r => r.json())
      .then(data => {
        if (data?.thumbnail_url) {
          setOembedThumb(proxyImg(data.thumbnail_url));
        }
      })
      .catch(() => {});
  }, [reel_url, imgError, shortcodeImgError, oembedTried]);

  // Determine what to render in the card
  const renderMedia = () => {
    if (!isInView) return <div className="w-full h-full bg-slate-300 dark:bg-slate-900 animate-pulse" />;

    // 1. Try video player
    if (resolvedVideoSrc && !videoError) {
      return (
        <video
          ref={videoRef}
          src={resolvedVideoSrc}
          autoPlay={false}
          muted
          loop
          playsInline
          poster={proxiedThumb || shortcodeThumb || undefined}
          onError={() => setVideoError(true)}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
        />
      );
    }

    // 2. Try original thumbnail image via proxy
    if (proxiedThumb && !imgError) {
      return (
        <img
          src={proxiedThumb}
          alt={caption || 'Reel'}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      );
    }

    // 3. Try shortcode-based thumbnail from Instagram's media endpoint
    if (shortcodeThumb && !shortcodeImgError) {
      return (
        <img
          src={shortcodeThumb}
          alt={caption || 'Reel'}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
          referrerPolicy="no-referrer"
          onError={() => setShortcodeImgError(true)}
        />
      );
    }

    // 4. Try oEmbed thumbnail
    if (oembedThumb) {
      return (
        <img
          src={oembedThumb}
          alt={caption || 'Reel'}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
          referrerPolicy="no-referrer"
          onError={() => setOembedThumb(null)}
        />
      );
    }

    // 5. Last resort — play icon overlay on dark background
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-900 via-[#0d1117] to-slate-900 flex flex-col items-center justify-center gap-3 px-4 relative overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/10">
          <svg className="w-7 h-7 text-white/70 ml-1" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
        <p className="text-white/30 text-[9px] font-bold uppercase tracking-[0.2em]">Tap to view reel</p>
      </div>
    );
  };





  return (
    <div
      ref={containerRef}
      onClick={() => onVideoClick?.(video)}
      onMouseEnter={() => videoRef.current?.play()}
      onMouseLeave={() => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
      className="group relative bg-canvas dark:bg-[#0a0f1e] border border-slate-200 dark:border-white/5 rounded-[3rem] overflow-hidden hover:border-indigo-500/40 transition-all duration-700 hover:shadow-[0_0_50px_rgba(99,102,241,0.15)] flex flex-col cursor-pointer"
    >
      <div className="aspect-[9/16] relative bg-slate-100 dark:bg-black flex items-center justify-center overflow-hidden transition-colors">
        {/* Top Badges */}
        <div className="absolute top-5 left-5 right-5 z-30 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-2">
            {isViral && (
              <div className="bg-[#f43f5e] text-white text-[9px] font-black tracking-widest uppercase px-4 py-1.5 rounded-xl shadow-2xl flex items-center gap-1.5 border border-white/10">
                <span className="text-[10px]">🔥</span> VIRAL
              </div>
            )}
          </div>
          {timeAgo && (
            <div className="bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-xl border border-white/10 text-[9px] font-black text-white/80 uppercase tracking-widest shadow-2xl">
              {timeAgo.toUpperCase()}
            </div>
          )}
        </div>

        {/* Media */}
        {renderMedia()}

        {/* Engagement Footer */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-30">
          <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl">
            <span className="text-[#f43f5e] text-xs">❤️</span>
            <span className="text-white text-[11px] font-black tracking-tight">{likes.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl">
            <span className="text-white text-[10px] font-black tracking-widest">{views.toLocaleString()} PLAYS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
