import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LiveBanner } from '../sync/displayTypes';

/**
 * Looping image/video slider for the Customer Display.
 * - Images show for their duration; videos play muted to the end.
 * - Slides move right-to-left; the next slide waits (preloaded) just off-screen.
 * - Slides fill the banner area. Cloudinary images are requested at the area's real size
 *   (smart-cropped, auto format/quality), so each screen downloads only what it shows.
 * - Only the current, the next and the outgoing slide exist in the DOM, so long playlists of
 *   videos don't pile up in memory. Outgoing videos are paused and unmounted.
 */

interface Slide {
  key: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  posterUrl?: string;
  durationSeconds: number;
}

interface BannerSliderProps {
  banners: LiveBanner[];
  /** Shown when there are no live banners (Display Settings → default banner). */
  fallback?: { mediaType: 'image' | 'video'; mediaUrl: string } | null;
  defaultImageSeconds?: number;
  /** Rendered when there's nothing to show at all (e.g. logo + welcome text). */
  emptyContent?: ReactNode;
  background?: string;
  className?: string;
}

const SLIDE_MS = 800;
const SLIDE_EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const MAX_VIDEO_MS = 10 * 60 * 1000; // safety net if a video never fires "ended"

const toSlides = (banners: LiveBanner[], fallback: BannerSliderProps['fallback'], defaultSeconds: number): Slide[] => {
  const live = banners
    .filter((b) => b.mediaUrl)
    .map((b) => ({
      key: b._id,
      mediaType: b.mediaType,
      mediaUrl: b.mediaUrl,
      posterUrl: b.posterUrl,
      durationSeconds: b.durationSeconds || defaultSeconds,
    }));
  if (live.length) return live;
  if (fallback?.mediaUrl) {
    return [{ key: 'default', mediaType: fallback.mediaType, mediaUrl: fallback.mediaUrl, durationSeconds: defaultSeconds }];
  }
  return [];
};

/** Area size rounded up to steps of 200px (× screen density, max 2×) so URLs stay cacheable. */
const bucket = (px: number) => Math.min(2560, Math.max(200, Math.ceil(px / 200) * 200));

/**
 * Cloudinary image URL resized/cropped for the banner area: c_fill + g_auto keeps the subject in
 * frame, f_auto/q_auto pick the lightest format/quality. Other URLs are returned unchanged.
 */
export const optimizedImageUrl = (url: string, width: number, height: number): string => {
  if (!width || !height || !/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\//.test(url)) return url;
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const w = bucket(width * dpr);
  const h = bucket(height * dpr);
  return url.replace(/\/upload\//, `/upload/c_fill,g_auto,w_${w},h_${h},f_auto,q_auto/`);
};

const useElementSize = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      // Only re-request images when the bucket actually changes
      setSize((prev) =>
        bucket(prev.width) === bucket(r.width) && bucket(prev.height) === bucket(r.height) && prev.width
          ? prev
          : { width: r.width, height: r.height }
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
};

const SlideMedia = ({
  slide,
  role,
  loop,
  onDone,
  onError,
  background,
  size,
}: {
  slide: Slide;
  role: 'current' | 'leaving' | 'preload';
  loop: boolean;
  onDone?: () => void;
  onError?: () => void;
  background: string;
  size: { width: number; height: number };
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (role === 'current') {
      video.currentTime = 0;
      video.play().catch(() => {
        // Autoplay can be refused (e.g. power saving); skip rather than freeze on a still frame
        window.setTimeout(() => onError?.(), 1500);
      });
    } else {
      video.pause();
    }
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      // Release the decoder/buffer as soon as the slide leaves the DOM
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    },
    []
  );

  const visible = role === 'current';
  // current: on screen · leaving: slides out to the left · preload: waits off-screen right.
  // Moving into "preload" is instant (no transition) so a slide never sweeps back across.
  const style: React.CSSProperties = {
    transform: `translate3d(${visible ? 0 : role === 'leaving' ? -100 : 100}%, 0, 0)`,
    transition: role === 'preload' ? 'none' : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`,
    zIndex: visible ? 2 : 1,
    willChange: 'transform',
  };

  if (slide.mediaType === 'video') {
    return (
      <div className="absolute inset-0" style={{ ...style, background: '#000' }} aria-hidden={!visible}>
        <video
          ref={videoRef}
          src={slide.mediaUrl}
          poster={slide.posterUrl ? optimizedImageUrl(slide.posterUrl, size.width, size.height) : undefined}
          muted
          playsInline
          loop={loop && visible}
          preload="auto"
          onEnded={visible ? onDone : undefined}
          onError={visible ? onError : undefined}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ ...style, background }} aria-hidden={!visible}>
      {size.width > 0 && (
        <img
          src={optimizedImageUrl(slide.mediaUrl, size.width, size.height)}
          alt=""
          draggable={false}
          decoding="async"
          onError={visible ? onError : undefined}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
};

const BannerSlider = ({
  banners,
  fallback,
  defaultImageSeconds = 5,
  emptyContent,
  background = '#0f172a',
  className = '',
}: BannerSliderProps) => {
  const slides = useMemo(() => toSlides(banners, fallback, defaultImageSeconds), [banners, fallback, defaultImageSeconds]);
  const [currentKey, setCurrentKey] = useState<string | null>(slides[0]?.key ?? null);
  const [leavingKey, setLeavingKey] = useState<string | null>(null);
  const [failedKeys, setFailedKeys] = useState<Set<string>>(new Set());
  const leaveTimer = useRef<number | null>(null);
  const { ref: areaRef, size } = useElementSize();

  const playable = slides.filter((s) => !failedKeys.has(s.key));
  const currentIndex = Math.max(0, playable.findIndex((s) => s.key === currentKey));
  const current = playable[currentIndex] || null;
  const next = playable.length > 1 ? playable[(currentIndex + 1) % playable.length] : null;
  const leaving = leavingKey && leavingKey !== current?.key ? slides.find((s) => s.key === leavingKey) || null : null;

  // Playlist changed (refresh/admin edit): keep the current slide if it's still there
  useEffect(() => {
    if (!slides.some((s) => s.key === currentKey)) setCurrentKey(slides[0]?.key ?? null);
    setFailedKeys((prev) => new Set([...prev].filter((k) => slides.some((s) => s.key === k))));
  }, [slides]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => {
    if (!current || playable.length < 2) return;
    setLeavingKey(current.key);
    setCurrentKey(next!.key);
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setLeavingKey(null), SLIDE_MS + 50);
  };

  const markFailed = () => {
    if (!current) return;
    const failed = current.key;
    advance();
    setFailedKeys((prev) => new Set(prev).add(failed));
  };

  // Image timer / video safety timer
  useEffect(() => {
    if (!current || playable.length < 2) return;
    const ms = current.mediaType === 'image' ? Math.max(2, current.durationSeconds) * 1000 : MAX_VIDEO_MS;
    const t = window.setTimeout(advance, ms);
    return () => window.clearTimeout(t);
  }, [current?.key, playable.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
  }, []);

  if (!current) {
    return (
      <div ref={areaRef} className={`relative h-full w-full overflow-hidden ${className}`} style={{ background }}>
        {emptyContent}
      </div>
    );
  }

  return (
    <div ref={areaRef} className={`relative h-full w-full overflow-hidden ${className}`} style={{ background }}>
      {/* One keyed list so the preloaded next slide becomes the current one without reloading */}
      {[
        leaving ? { slide: leaving, role: 'leaving' as const } : null,
        { slide: current, role: 'current' as const },
        next && next.key !== leaving?.key ? { slide: next, role: 'preload' as const } : null,
      ]
        .filter((x): x is { slide: Slide; role: 'leaving' | 'current' | 'preload' } => !!x)
        .map(({ slide, role }) => (
          <SlideMedia
            key={slide.key}
            slide={slide}
            role={role}
            loop={role === 'current' && playable.length === 1}
            onDone={role === 'current' ? advance : undefined}
            onError={role === 'current' ? markFailed : undefined}
            background={background}
            size={size}
          />
        ))}
      {playable.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-1.5">
          {playable.map((s) => (
            <span
              key={s.key}
              className="h-1.5 rounded-full bg-white/80 shadow transition-all duration-500"
              style={{ width: s.key === current.key ? 22 : 6, opacity: s.key === current.key ? 1 : 0.5 }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerSlider;
