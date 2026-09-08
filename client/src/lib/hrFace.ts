/**
 * MediaPipe Face Landmarker for admin face enrollment.
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
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
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

export function detectFaceDescriptor(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number
): number[] | null {
  if (video.readyState < 2 || video.videoWidth < 1) return null;
  const result = landmarker.detectForVideo(video, timestampMs);
  const face = result.faceLandmarks?.[0];
  if (!face || face.length < 400) return null;
  return buildLandmarkDescriptor(face) as number[] | null;
}
