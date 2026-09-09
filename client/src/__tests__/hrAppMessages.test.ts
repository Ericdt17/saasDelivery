/**
 * Unit tests for hr-app check-in geo error copy (run via client Vitest).
 */

import { describe, it, expect } from "vitest";
import {
  MSG,
  geoErrorMessage,
  checkinPipelineErrorMessage,
  isRetryableCheckinMessage,
  clientErrorKindFromMessage,
} from "../../../hr-app/src/lib/messages";

describe("geoErrorMessage", () => {
  it("gives OS-neutral steps and a RH fallback (no iPhone-only path)", () => {
    const msg = geoErrorMessage({ code: 1 } as GeolocationPositionError);
    expect(msg).toBe(MSG.GEO_DENIED);
    expect(msg).toMatch(/GPS|localisation/i);
    expect(msg).toMatch(/Réessayer|réessayez/i);
    expect(msg).toMatch(/RH/i);
    expect(msg).not.toMatch(/Réglages iPhone|Confidentialité/i);
  });
});

describe("checkinPipelineErrorMessage", () => {
  it("clarifies face was saved when GPS fails right after enroll", () => {
    const msg = checkinPipelineErrorMessage(MSG.GEO_DENIED, {
      faceJustEnrolled: true,
    });
    expect(msg).toBe(MSG.GEO_DENIED_AFTER_ENROLL);
    expect(msg).toMatch(/visage.*enregistr/i);
    expect(msg).toMatch(/RH/i);
    expect(msg).not.toMatch(/Réglages iPhone/i);
  });

  it("keeps the base geo message when face was already enrolled", () => {
    expect(
      checkinPipelineErrorMessage(MSG.GEO_DENIED, { faceJustEnrolled: false })
    ).toBe(MSG.GEO_DENIED);
  });
});

describe("isRetryableCheckinMessage", () => {
  it("allows retry for geo failures", () => {
    expect(isRetryableCheckinMessage(MSG.GEO_DENIED)).toBe(true);
    expect(isRetryableCheckinMessage(MSG.GEO_DENIED_AFTER_ENROLL)).toBe(true);
    expect(isRetryableCheckinMessage(MSG.GEO_TIMEOUT)).toBe(true);
    expect(isRetryableCheckinMessage(MSG.GENERIC)).toBe(false);
  });
});

describe("clientErrorKindFromMessage", () => {
  it("maps geo and camera messages to Discord kinds", () => {
    expect(clientErrorKindFromMessage(MSG.GEO_DENIED)).toBe("geo_denied");
    expect(clientErrorKindFromMessage(MSG.GEO_DENIED_AFTER_ENROLL)).toBe(
      "geo_denied"
    );
    expect(clientErrorKindFromMessage(MSG.CAMERA_DENIED)).toBe("camera_denied");
    expect(clientErrorKindFromMessage(MSG.NETWORK)).toBe("network");
  });
});
