/** Messages employés — français simple, action concrète (Android + iOS). */

export const MSG = {
  NETWORK:
    "Connexion impossible pour le moment. Vérifiez votre réseau internet, puis réessayez.",
  GENERIC:
    "Le pointage n'a pas abouti. Réessayez. Si le problème continue, contactez les ressources humaines.",
  EMAIL_FALLBACK:
    "Cet e-mail n'est pas reconnu. Vérifiez votre saisie ou demandez de l'aide aux ressources humaines.",
  GEO_UNSUPPORTED:
    "Votre appareil ne peut pas indiquer votre position. Utilisez un téléphone avec le GPS activé.",
  GEO_DENIED:
    "Nous n'avons pas pu lire votre position. Activez le GPS / la localisation sur votre téléphone, autorisez-la si une fenêtre apparaît, puis appuyez sur Réessayer. Si ça continue, demandez aux RH de noter votre présence.",
  GEO_DENIED_AFTER_ENROLL:
    "Votre visage est bien enregistré, mais pas encore votre présence (position introuvable). Activez le GPS, autorisez la localisation, puis réessayez. Sinon demandez aux RH de vous marquer présent.",
  GEO_TIMEOUT:
    "La position met trop de temps à arriver. Sortez à l'air libre ou près d'une fenêtre, vérifiez que le GPS est activé, puis réessayez.",
  GEO_UNAVAILABLE:
    "Position indisponible pour le moment. Activez le GPS, restez près d'une fenêtre, puis réessayez. Si ça continue, demandez aux RH de noter votre présence.",
  CAMERA_DENIED:
    "La caméra est nécessaire pour le pointage. Autorisez l'accès à la caméra dans le navigateur, puis réessayez.",
  CAMERA_UNAVAILABLE:
    "La caméra est indisponible. Fermez les autres applications qui l'utilisent, puis réessayez.",
  FACE_LOAD:
    "Impossible de préparer la reconnaissance faciale. Vérifiez votre connexion internet, puis réessayez.",
  OUT_OF_RANGE:
    "Vous n'êtes pas au bureau. Rapprochez-vous du site pour pouvoir pointer.",
  PERMISSION_CAMERA:
    "Nous allons demander l'accès à la caméra pour reconnaître votre visage.",
  PERMISSION_GEO:
    "Nous allons vérifier que vous êtes au bureau. Si une demande de localisation apparaît, choisissez Autoriser.",
  BUSY_ENROLL: "Enregistrement de votre visage…",
  BUSY_GEO: "Vérification de votre position…",
  BUSY_CHECKIN: "Enregistrement de votre présence…",
} as const;

/** Map browser GeolocationPositionError → message clair. */
export function geoErrorMessage(err: GeolocationPositionError | null | undefined): string {
  if (!err || typeof err.code !== "number") return MSG.GEO_UNAVAILABLE;
  // 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
  if (err.code === 1) return MSG.GEO_DENIED;
  if (err.code === 3) return MSG.GEO_TIMEOUT;
  return MSG.GEO_UNAVAILABLE;
}

/**
 * After first-time face enroll, GPS can still fail — tell the employee
 * their face was saved but check-in is incomplete.
 */
export function checkinPipelineErrorMessage(
  baseMessage: string,
  opts: { faceJustEnrolled: boolean }
): string {
  if (!opts.faceJustEnrolled) return baseMessage;
  if (
    baseMessage === MSG.GEO_DENIED ||
    baseMessage === MSG.GEO_TIMEOUT ||
    baseMessage === MSG.GEO_UNAVAILABLE ||
    baseMessage === MSG.GEO_UNSUPPORTED
  ) {
    return MSG.GEO_DENIED_AFTER_ENROLL;
  }
  return baseMessage;
}

/** True when the user can usefully tap Réessayer (geo or network). */
export function isRetryableCheckinMessage(message: string): boolean {
  return (
    message === MSG.NETWORK ||
    message === MSG.GEO_DENIED ||
    message === MSG.GEO_DENIED_AFTER_ENROLL ||
    message === MSG.GEO_TIMEOUT ||
    message === MSG.GEO_UNAVAILABLE
  );
}

export type ClientErrorKind =
  | "geo_denied"
  | "geo_timeout"
  | "geo_unavailable"
  | "camera_denied"
  | "camera_unavailable"
  | "network"
  | "other";

/** Map employee-facing message → Discord client-error kind. */
export function clientErrorKindFromMessage(message: string): ClientErrorKind {
  if (
    message === MSG.GEO_DENIED ||
    message === MSG.GEO_DENIED_AFTER_ENROLL
  ) {
    return "geo_denied";
  }
  if (message === MSG.GEO_TIMEOUT) return "geo_timeout";
  if (message === MSG.GEO_UNAVAILABLE || message === MSG.GEO_UNSUPPORTED) {
    return "geo_unavailable";
  }
  if (message === MSG.CAMERA_DENIED) return "camera_denied";
  if (message === MSG.CAMERA_UNAVAILABLE) return "camera_unavailable";
  if (message === MSG.NETWORK) return "network";
  return "other";
}

/** Map getUserMedia / camera failures → message clair. */
export function cameraErrorMessage(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return MSG.CAMERA_DENIED;
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return MSG.CAMERA_UNAVAILABLE;
  if (name === "NotReadableError" || name === "TrackStartError") return MSG.CAMERA_UNAVAILABLE;
  return MSG.CAMERA_UNAVAILABLE;
}
