'use client';

// Three-layer star field reacting to the deck's mouse-parallax CSS vars.
// Back layer moves slowest (deepest); front moves fastest. Pure CSS, no
// per-frame work.
export default function ParallaxStars() {
  return (
    <>
      <div
        aria-hidden
        className="stars parallax-layer"
        style={{ transform: 'translate3d(calc(var(--mx, 0) * -0.4px), calc(var(--my, 0) * -0.4px), 0)' }}
      />
      <div
        aria-hidden
        className="parallax-layer"
        style={{
          transform: 'translate3d(calc(var(--mx, 0) * -1.1px), calc(var(--my, 0) * -1.1px), 0)',
          backgroundImage: [
            'radial-gradient(1.5px 1.5px at 14% 72%, rgba(107, 168, 184, 0.75), transparent 1px)',
            'radial-gradient(2px 2px at 78% 14%, rgba(212, 168, 74, 0.85), transparent 1.5px)',
            'radial-gradient(1px 1px at 42% 20%, rgba(236, 223, 192, 0.85), transparent 1px)',
            'radial-gradient(1.5px 1.5px at 22% 48%, rgba(139, 111, 166, 0.7), transparent 1px)',
            'radial-gradient(1.5px 1.5px at 87% 62%, rgba(196, 90, 90, 0.55), transparent 1px)',
          ].join(','),
          opacity: 0.55,
        }}
      />
      <div
        aria-hidden
        className="parallax-layer"
        style={{
          transform: 'translate3d(calc(var(--mx, 0) * -2.4px), calc(var(--my, 0) * -2.4px), 0)',
          backgroundImage: [
            'radial-gradient(2px 2px at 54% 88%, rgba(236, 223, 192, 1), transparent 1.5px)',
            'radial-gradient(2.5px 2.5px at 8% 12%, rgba(212, 168, 74, 1), transparent 2px)',
            'radial-gradient(1.5px 1.5px at 92% 36%, rgba(107, 168, 184, 0.95), transparent 1.2px)',
          ].join(','),
          opacity: 0.7,
          filter: 'drop-shadow(0 0 6px rgba(236, 223, 192, 0.35))',
        }}
      />
    </>
  );
}
