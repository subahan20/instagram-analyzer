import { useState, useRef, useEffect } from 'react';

/**
 * getTimeAgo - Helper to calculate readable time spans
 */
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
    return `${Math.floor(diffInDays / 30)}m ago`;
  } catch (e) { return ''; }
};

export default function VideoCard({ video, isViral = false, onVideoClick }) {
  const { 
    video_url, 
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
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  // Normalize metrics
  // Normalize metrics - Use || instead of ?? to fall back if count is 0
  const views = Number(video_play_count || videoPlayCount || play_count || viewsRaw || 0);
  const comments = Number(comments_count ?? comment_count ?? commentsRaw ?? 0);
  const timeAgo = getTimeAgo(posted_at);
  const videoSrc = video_url || media_url;
  const thumbSrc = display_url || thumbnail_url;
  const influencer = video.influencer;

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

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

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
      className="group relative bg-[#0a0f1e] border border-white/5 rounded-[3rem] overflow-hidden hover:border-indigo-500/40 transition-all duration-700 hover:shadow-[0_0_50px_rgba(99,102,241,0.15)] flex flex-col cursor-pointer"
    >
      {/* Video Content Layer */}
      <div className="aspect-[9/16] relative bg-black flex items-center justify-center overflow-hidden">
        {/* Top Badges Area */}
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
 
        {/* The Media */}
        {isInView ? (
          videoSrc ? (
            <video 
              ref={videoRef}
              src={videoSrc} 
              autoPlay={false}
              muted 
              loop 
              playsInline 
              poster={thumbSrc ? `https://images.weserv.nl/?url=${encodeURIComponent(thumbSrc)}&w=500&h=900&fit=cover` : undefined}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
            />
          ) : thumbSrc ? (
            <img 
              src={`https://images.weserv.nl/?url=${encodeURIComponent(thumbSrc)}&w=500&h=900&fit=cover`} 
              alt={caption || 'Neural Intelligence'} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out opacity-80"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center gap-4">
              <span className="text-4xl opacity-10">🎞️</span>
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">No Signal</span>
            </div>
          )
        ) : (
          <div className="w-full h-full bg-slate-950 animate-pulse"></div>
        )}

        {/* Engagement Footer Overlay */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none"></div>

        <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl group/stat hover:border-rose-500/30 transition-colors">
              <span className="text-[#f43f5e] text-xs">❤️</span>
              <span className="text-white text-[11px] font-black tracking-tight">{likes.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl transition-colors">
              <span className="text-white text-[10px] font-black tracking-widest">{views.toLocaleString()} PLAYS</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
