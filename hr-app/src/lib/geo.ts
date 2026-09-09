import { MSG, geoErrorMessage } from "./messages";

type GeoOptions = PositionOptions;

function readPositionOnce(options: GeoOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => reject(Object.assign(new Error(geoErrorMessage(err)), { geoCode: err?.code })),
      options
    );
  });
}

/**
 * Read GPS with a mobile-friendly strategy:
 * 1) fast / low-power fix (works better on many Android + iOS browsers)
 * 2) if that times out or is unavailable, retry with high accuracy
 * Permission denials are not retried (user must change settings / allow prompt).
 */
export async function getCurrentPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    throw new Error(MSG.GEO_UNSUPPORTED);
  }

  try {
    return await readPositionOnce({
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60_000,
    });
  } catch (first) {
    const geoCode =
      first && typeof first === "object" && "geoCode" in first
        ? Number((first as { geoCode: number }).geoCode)
        : NaN;
    // 1 = PERMISSION_DENIED — second attempt won't help
    if (geoCode === 1) throw first;

    try {
      return await readPositionOnce({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    } catch (second) {
      throw second;
    }
  }
}

/** @deprecated kept for e2e / callers that match bureau copy */
export const OFFICE_MESSAGE = MSG.OUT_OF_RANGE;
