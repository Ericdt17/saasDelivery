import { MSG, geoErrorMessage } from "./messages";

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(MSG.GEO_UNSUPPORTED));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => reject(new Error(geoErrorMessage(err))),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/** @deprecated kept for e2e / callers that match bureau copy */
export const OFFICE_MESSAGE = MSG.OUT_OF_RANGE;
