import React from 'react';

// The table is laid out at a logical size of at least MIN_W x MIN_H (enough for full late-game
// rivers and four melds) and scaled to fill the space it is given. Nothing is clipped at any
// window size, and large screens get proportionally larger tiles instead of empty margins.
const MIN_W = 940;
const MIN_H = 680;
const MAX_SCALE = 1.35;
// Keep the table from stretching into a very wide or very tall shape
const MAX_ASPECT = 1.75;
const MIN_ASPECT = 1.1;

export const TableFit: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{ w: number; h: number } | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let inner: React.ReactNode = null;
  if (box && box.w > 0 && box.h > 0) {
    const scale = Math.min(box.w / MIN_W, box.h / MIN_H, MAX_SCALE);
    let w = box.w / scale;
    let h = box.h / scale;
    w = Math.min(w, h * MAX_ASPECT);
    h = Math.min(h, w / MIN_ASPECT);
    inner = (
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: w, height: h, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative w-full h-full min-w-0 min-h-0">
      {inner}
    </div>
  );
};
