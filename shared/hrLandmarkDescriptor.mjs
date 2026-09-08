/**
 * Build a stable 128-d face descriptor from MediaPipe Face Landmarker points.
 * Pure math — no MediaPipe dependency (usable in Jest + browser).
 *
 * Uses 64 mesh indices × (x, y) relative to nose tip, L2-normalized.
 * Incompatible with legacy face-api.js FaceNet descriptors → re-enroll required.
 */

/** @type {readonly number[]} */
export const KEY_LANDMARK_INDICES = Object.freeze([
  // Contour / oval
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  // Brows / eyes
  70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 33, 133, 362, 263,
  // Nose
  1, 2, 98, 327, 168, 6, 197, 195,
  // Mouth / cheeks
  61, 291, 0, 17, 13, 14, 78, 308, 50, 280,
]);

export const NOSE_TIP_INDEX = 1;

/**
 * @param {{ x: number, y: number, z?: number }[]} landmarks
 * @returns {number[] | null} length-128 L2-normalized descriptor, or null if invalid
 */
export function buildLandmarkDescriptor(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 400) return null;
  const nose = landmarks[NOSE_TIP_INDEX];
  if (!nose || !Number.isFinite(nose.x) || !Number.isFinite(nose.y)) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const i of KEY_LANDMARK_INDICES) {
    const p = landmarks[i];
    if (!p) return null;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);

  const out = new Array(128);
  let k = 0;
  for (const i of KEY_LANDMARK_INDICES) {
    const p = landmarks[i];
    out[k++] = (p.x - nose.x) / w;
    out[k++] = (p.y - nose.y) / h;
  }

  let sumSq = 0;
  for (let i = 0; i < out.length; i++) sumSq += out[i] * out[i];
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}
