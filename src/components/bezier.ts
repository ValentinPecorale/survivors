/** CSS-style cubic-bezier(x1, y1, x2, y2) easing solver. x is time (0..1), the result is progress. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const x = (s: number) => ((ax * s + bx) * s + cx) * s
  const y = (s: number) => ((ay * s + by) * s + cy) * s
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx
  return (t: number) => {
    if (t <= 0 || t >= 1) return t
    let s = t
    for (let i = 0; i < 8; i++) {
      const err = x(s) - t
      if (Math.abs(err) < 1e-5) return y(s)
      const slope = dx(s)
      if (Math.abs(slope) < 1e-6) break
      s -= err / slope
    }
    let lo = 0, hi = 1
    s = t
    while (lo < hi) {
      const err = x(s)
      if (Math.abs(err - t) < 1e-5) break
      if (t > err) lo = s; else hi = s
      s = (hi - lo) / 2 + lo
      if (hi - lo < 1e-6) break
    }
    return y(s)
  }
}
