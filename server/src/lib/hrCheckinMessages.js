/**
 * Messages employés (français simple) pour le pointage public.
 * Pas de jargon technique — expliquer quoi faire ensuite.
 */

const CHECKIN_MESSAGES = {
  EMAIL_INVALID:
    "Saisissez une adresse e-mail valide (exemple : prenom.nom@entreprise.com).",
  EMPLOYEE_NOT_FOUND:
    "Cet e-mail n'est pas enregistré. Vérifiez l'orthographe ou demandez de l'aide aux ressources humaines.",
  EMPLOYEE_INACTIVE:
    "Votre compte est désactivé. Contactez les ressources humaines pour reprendre le pointage.",
  FACE_NOT_ENROLLED:
    "Votre visage n'est pas encore enregistré. Sur cet écran, capturez votre visage pour l'enregistrer, puis pointez.",
  FACE_ALREADY_ENROLLED:
    "Votre visage est déjà enregistré. Continuez directement le pointage. Pour le modifier, contactez les ressources humaines.",
  FACE_ENROLLED_OK:
    "Votre visage a bien été enregistré. Vous pouvez maintenant pointer.",
  FACE_MISMATCH:
    "Votre visage n'a pas été reconnu. Placez-vous face à la caméra, avec un bon éclairage, puis réessayez.",
  OUT_OF_RANGE:
    "Vous n'êtes pas au bureau. Rapprochez-vous du site pour pouvoir pointer.",
  CLOSED:
    "Le pointage est terminé pour aujourd'hui. Il est ouvert chaque jour jusqu'à midi (heure du Cameroun).",
  ALREADY_CHECKED_IN:
    "Vous avez déjà pointé aujourd'hui. Aucune autre action n'est nécessaire.",
  RATE_LIMITED:
    "Trop d'essais en peu de temps. Attendez quelques minutes, puis réessayez.",
  VALIDATION_FAILED:
    "Les informations envoyées sont incomplètes. Recommencez le pointage depuis le début.",
};

module.exports = { CHECKIN_MESSAGES };
