declare module "@shared/hrLandmarkDescriptor.mjs" {
  export const KEY_LANDMARK_INDICES: readonly number[];
  export const NOSE_TIP_INDEX: number;
  export function buildLandmarkDescriptor(
    landmarks: { x: number; y: number; z?: number }[]
  ): number[] | null;
}
