/** Messages employés — français simple, action concrète. */

export const MSG = {
  NETWORK:
    "Connexion impossible pour le moment. Vérifiez votre réseau internet, puis réessayez.",
  GENERIC:
    "Le pointage n'a pas abouti. Réessayez. Si le problème continue, contactez les ressources humaines.",
  EMAIL_FALLBACK:
    "Cet e-mail n'est pas reconnu. Vérifiez votre saisie ou demandez de l'aide aux ressources humaines.",
  GEO_UNSUPPORTED:
    "Votre appareil ne peut pas indiquer votre position. Utilisez un téléphone ou un ordinateur avec la localisation activée.",
  GEO_DENIED:
    "La localisation est nécessaire pour pointer. Autorisez l'accès à votre position dans le navigateur, puis réessayez.",
  GEO_TIMEOUT:
    "Impossible d'obtenir votre position assez vite. Activez le GPS, approchez-vous d'une fenêtre, puis réessayez.",
  GEO_UNAVAILABLE:
    "Impossible d'obtenir votre position. Activez la localisation et réessayez dans un endroit plus dégagé.",
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
    "Nous allons demander votre position pour vérifier que vous êtes au bureau.",
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

/** Map getUserMedia / camera failures → message clair. */
export function cameraErrorMessage(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return MSG.CAMERA_DENIED;
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return MSG.CAMERA_UNAVAILABLE;
  if (name === "NotReadableError" || name === "TrackStartError") return MSG.CAMERA_UNAVAILABLE;
  return MSG.CAMERA_UNAVAILABLE;
}
