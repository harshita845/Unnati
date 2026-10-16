import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion system for the customer app: every animation takes its timing from here, so the
 * whole app moves the same way.
 *
 * To make everything faster or slower, change MOTION_SPEED: 1 is the default, 0.8 is 20% faster,
 * 1.25 is 25% slower. Users with "reduce motion" switched on get almost no movement (see
 * <MotionConfig reducedMotion="user"> in App.tsx).
 */
export const MOTION_SPEED = 1;

const d = (seconds: number) => seconds * MOTION_SPEED;

export const duration = {
  fast: d(0.15),
  base: d(0.25),
  slow: d(0.4),
} as const;

export const ease = {
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

/** Physical feel: soft for large surfaces, snappy for controls, bouncy for small rewards (badges, counts) */
export const spring = {
  soft: { type: "spring", stiffness: 220, damping: 28, mass: 0.9 } as Transition,
  snappy: { type: "spring", stiffness: 500, damping: 34 } as Transition,
  bouncy: { type: "spring", stiffness: 520, damping: 18 } as Transition,
};

/** Press feedback for anything tappable */
export const tap = { scale: 0.95 };
export const tapSoft = { scale: 0.97 };
/** Hover lift; framer-motion only fires whileHover for real mouse pointers, so touch screens never see it */
export const hoverLift = { y: -2 };

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.base, ease: ease.out } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: spring.snappy },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: duration.slow, ease: ease.out } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  show: { opacity: 1, x: 0, transition: { duration: duration.slow, ease: ease.out } },
};

/** Parent of a staggered list: children using staggerItem appear one after another */
export const staggerContainer = (stagger = 0.05, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: d(stagger), delayChildren: d(delayChildren) } },
});

export const staggerItem: Variants = fadeUp;

/** Route change: quick fade with a small rise, no layout jump */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.inOut } },
};

/** Error feedback on a field: a short horizontal shake */
export const shake = {
  x: [0, -6, 6, -4, 4, 0],
  transition: { duration: d(0.35) },
};

/** whileInView settings: reveal once, slightly before the element is fully on screen */
export const inViewOnce = { once: true, margin: "0px 0px -10% 0px" } as const;
