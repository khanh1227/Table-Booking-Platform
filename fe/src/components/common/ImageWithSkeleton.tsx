import { useState } from "react";
import { PLACEHOLDER_IMAGE } from "@/lib/imageUtils";

// Module-level cache: once an image URL is loaded, remember it forever
// so scrolling up/down never re-fetches or blanks it out
const loadedCache = new Set<string>();

interface ImageWithSkeletonProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
}

export default function ImageWithSkeleton({
  src,
  alt,
  className = "",
  containerClassName = "",
}: ImageWithSkeletonProps) {
  const effectiveSrc = src || PLACEHOLDER_IMAGE;

  // If this image was already loaded in this session, skip skeleton entirely
  const [loaded, setLoaded] = useState(() => loadedCache.has(effectiveSrc));
  const [error, setError] = useState(false);

  const handleLoad = () => {
    loadedCache.add(effectiveSrc);
    setLoaded(true);
  };

  const handleError = () => {
    if (!error) {
      setError(true);
      setLoaded(true);
    }
  };

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${containerClassName}`}>
      {/* Skeleton shimmer — hidden once image is ready */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-white to-slate-200 animate-[shimmer_1.5s_infinite]" />
      )}

      <img
        src={error ? PLACEHOLDER_IMAGE : effectiveSrc}
        alt={alt}
        decoding="async"
        className={`w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
