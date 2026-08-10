import { Point } from '../types/animation';

/**
 * Applies low-latency stabilizer smoothing to incoming points
 */
export function stabilizePoint(
  rawPoint: Point,
  previousPoints: Point[],
  stabilizerLevel: number // 0 to 10
): Point {
  if (stabilizerLevel <= 0 || previousPoints.length === 0) {
    return rawPoint;
  }

  // Weight factor based on stabilizer level (0..10 -> 0.05..0.8 factor)
  const factor = 0.1 + (stabilizerLevel / 10) * 0.75;
  const last = previousPoints[previousPoints.length - 1];

  const smoothedX = last.x + (rawPoint.x - last.x) * (1 - factor);
  const smoothedY = last.y + (rawPoint.y - last.y) * (1 - factor);
  const pressure = rawPoint.pressure !== undefined
    ? (last.pressure !== undefined ? last.pressure + (rawPoint.pressure - last.pressure) * (1 - factor) : rawPoint.pressure)
    : undefined;

  return {
    x: smoothedX,
    y: smoothedY,
    pressure,
  };
}

/**
 * Smooths an entire set of points using quadratic Bézier interpolation
 */
export function generateSmoothedCurve(points: Point[]): Point[] {
  if (points.length < 3) return points;

  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];

    // Midpoints
    const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

    // Interpolate 3 segments per point
    for (let t = 0; t <= 1; t += 0.33) {
      const x = (1 - t) * (1 - t) * mid1.x + 2 * (1 - t) * t * p1.x + t * t * mid2.x;
      const y = (1 - t) * (1 - t) * mid1.y + 2 * (1 - t) * t * p1.y + t * t * mid2.y;
      const pressure = p1.pressure !== undefined ? p1.pressure : 0.5;
      result.push({ x, y, pressure });
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

/**
 * Simplifies points using Ramer-Douglas-Peucker algorithm
 */
export function simplifyPoints(points: Point[], tolerance = 0.0005): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointToLineDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const recursiveResult1 = simplifyPoints(points.slice(0, index + 1), tolerance);
    const recursiveResult2 = simplifyPoints(points.slice(index), tolerance);
    return recursiveResult1.slice(0, recursiveResult1.length - 1).concat(recursiveResult2);
  } else {
    return [first, last];
  }
}

function pointToLineDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const u = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const clampedU = Math.max(0, Math.min(1, u));
  const projX = a.x + clampedU * dx;
  const projY = a.y + clampedU * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}
