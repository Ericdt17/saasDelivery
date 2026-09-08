'use strict';

const {
  buildLandmarkDescriptor,
  KEY_LANDMARK_INDICES,
} = require('../../lib/hrLandmarkDescriptor');
const { isFaceMatch, euclideanDistance } = require('../../lib/hrCheckin');

function fakeLandmarks(scale = 1, shiftX = 0) {
  const pts = Array.from({ length: 478 }, (_, i) => ({
    x: 0.4 + (i % 20) * 0.01 * scale + shiftX,
    y: 0.4 + Math.floor(i / 20) * 0.01 * scale,
    z: 0,
  }));
  pts[1] = { x: 0.5 + shiftX, y: 0.5, z: 0 };
  for (const i of KEY_LANDMARK_INDICES) {
    pts[i] = {
      x: 0.3 + (i % 17) * 0.02 * scale + shiftX,
      y: 0.3 + (i % 13) * 0.02 * scale,
      z: 0,
    };
  }
  return pts;
}

describe('buildLandmarkDescriptor (MediaPipe)', () => {
  it('returns a length-128 L2-normalized vector', () => {
    const d = buildLandmarkDescriptor(fakeLandmarks());
    expect(d).toHaveLength(128);
    const norm = Math.sqrt(d.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('returns null for incomplete landmark sets', () => {
    expect(buildLandmarkDescriptor([])).toBeNull();
    expect(buildLandmarkDescriptor(Array(10).fill({ x: 0, y: 0 }))).toBeNull();
  });

  it('matches identical landmark poses under FACE_MATCH_THRESHOLD', () => {
    const a = buildLandmarkDescriptor(fakeLandmarks(1, 0));
    const b = buildLandmarkDescriptor(fakeLandmarks(1, 0));
    expect(euclideanDistance(a, b)).toBeLessThan(1e-6);
    expect(isFaceMatch(a, b)).toBe(true);
  });

  it('rejects clearly different poses', () => {
    const a = buildLandmarkDescriptor(fakeLandmarks(1, 0));
    const other = fakeLandmarks(1, 0);
    for (const i of KEY_LANDMARK_INDICES) {
      other[i] = {
        x: 1 - other[i].x,
        y: (other[i].y + 0.35) % 0.9,
        z: 0,
      };
    }
    other[1] = { x: 0.5, y: 0.5, z: 0 };
    const b = buildLandmarkDescriptor(other);
    expect(euclideanDistance(a, b)).toBeGreaterThan(0.5);
    expect(isFaceMatch(a, b)).toBe(false);
  });
});
