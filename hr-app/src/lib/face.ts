/**
 * MediaPipe Face Landmarker → 128-d landmark descriptor (shared math).
 */
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { buildLandmarkDescriptor } from "@shared/hrLandmarkDescriptor.mjs";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export async function ensureFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      const base = {
        runningMode: "VIDEO" as const,
        numFaces: 1,
        minFaceDetectionConfidence: 0.3,
        minFacePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      };
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          ...base,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        });
      } catch {
        return FaceLandmarker.createFromOptions(vision, {
          ...base,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        });
      }
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

const DEV = import.meta.env.DEV;
let _logFrame = 0;

/**
 * Detect the largest face in a video frame and return a 128-d descriptor.
 */
export function detectFaceDescriptor(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number
): number[] | null {
  if (video.readyState < 2 || video.videoWidth < 1) {
    if (DEV) console.debug("[face] video not ready", { readyState: video.readyState, width: video.videoWidth });
    return null;
  }
  const result = landmarker.detectForVideo(video, timestampMs);
  const face = result.faceLandmarks?.[0];

  // Log every 30 frames (~0.5 s) to avoid flooding the console
  if (DEV && _logFrame++ % 30 === 0) {
    if (!face) {
      console.debug("[face] no face detected");
    } else if (face.length < 400) {
      console.debug("[face] face found but too few landmarks:", face.length, "(need ≥ 400)");
    } else {
      console.debug("[face] ✓ face OK —", face.length, "landmarks");
    }
  }

  if (!face || face.length < 400) return null;
  return buildLandmarkDescriptor(face);
}

export function fakeDescriptor128(seed = 0.1): number[] {
  const base = Array.from({ length: 128 }, (_, i) => Math.sin(i * 12.9898 + seed) * 0.5);
  let sumSq = 0;
  for (const v of base) sumSq += v * v;
  const norm = Math.sqrt(sumSq) || 1;
  return base.map((v) => v / norm);
}

export function isE2EMode(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return import.meta.env.VITE_E2E === "true" || params.get("e2e") === "1";
}

export { buildLandmarkDescriptor };
