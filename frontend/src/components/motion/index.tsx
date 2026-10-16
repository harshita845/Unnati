import { forwardRef, useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { animate, motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { fadeUp, inViewOnce, spring, tap, duration, ease } from "../../lib/motion";

/** Fades and rises into view the first time it scrolls on screen. */
export function FadeInView({
  children,
  delay = 0,
  className,
  ...rest
}: { children: ReactNode; delay?: number; className?: string } & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={inViewOnce}
      transition={{ delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** A <button> with press feedback. Same props and behaviour as a normal button. */
export const PressableButton = forwardRef<HTMLButtonElement, HTMLMotionProps<"button">>(function PressableButton(
  { whileTap, transition, ...rest },
  ref
) {
  return <motion.button ref={ref} whileTap={rest.disabled ? undefined : whileTap ?? tap} transition={transition ?? spring.snappy} {...rest} />;
});

/** A number that rolls to its new value instead of jumping. */
export function AnimatedCounter({
  value,
  format = (n: number) => String(Math.round(n)),
  ...rest
}: { value: number; format?: (n: number) => string } & Omit<ComponentPropsWithoutRef<"span">, "children">) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: duration.slow,
      ease: ease.out,
      onUpdate: setShown,
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return <span {...rest}>{format(shown)}</span>;
}

/** Grey shimmering block shown while content loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`} aria-hidden="true" />;
}

/**
 * <img> that fades in once loaded, over a shimmer placeholder. Same props as <img>; the wrapper
 * takes the size, so the layout is reserved before the picture arrives (no jump).
 */
export function FadeImage({
  wrapperClassName = "",
  className = "",
  onLoad,
  onError,
  ...img
}: ComponentPropsWithoutRef<"img"> & { wrapperClassName?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={`relative block overflow-hidden ${loaded ? "" : "skeleton-shimmer"} ${wrapperClassName}`}>
      <img
        {...img}
        className={`${className} ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ transition: "opacity 300ms ease-out, transform 300ms ease-out", ...img.style }}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          // Show whatever the browser renders for a broken image (alt text), never an endless shimmer
          setLoaded(true);
          onError?.(e);
        }}
      />
    </span>
  );
}
