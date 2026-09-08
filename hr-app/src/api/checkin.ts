const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function url(path: string): string {
  return `${API_BASE}${path}`;
}

export type VerifyEmailResult = {
  full_name: string;
  email: string;
  is_enrolled: boolean;
};

export type CheckinResult = {
  success: true;
  employee_name: string;
  check_in_time: string;
  status: "present" | "late";
};

export class CheckinApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CheckinApiError";
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    if (import.meta.env.DEV) {
      console.warn("[checkin] API error", res.status, data);
    }
    if (data.message && data.message.trim()) return data.message;
    if (data.error === "Too many requests") {
      return "Trop d'essais en peu de temps. Attendez quelques minutes, puis réessayez.";
    }
    return "Le pointage n'a pas abouti. Réessayez. Si le problème continue, contactez les ressources humaines.";
  } catch {
    return "Le pointage n'a pas abouti. Réessayez. Si le problème continue, contactez les ressources humaines.";
  }
}

export async function verifyEmail(email: string): Promise<VerifyEmailResult> {
  const qs = new URLSearchParams({ email });
  const res = await fetch(url(`/api/v1/hr/checkin/verify-email?${qs}`), {
    credentials: "include",
  });
  if (!res.ok) {
    throw new CheckinApiError(await parseError(res), res.status);
  }
  const body = (await res.json()) as {
    success: boolean;
    data?: VerifyEmailResult;
    message?: string;
  };
  if (!body.success || !body.data) {
    throw new CheckinApiError(
      body.message ||
        "Cet e-mail n'est pas reconnu. Vérifiez votre saisie ou demandez de l'aide aux ressources humaines.",
      res.status
    );
  }
  return body.data;
}

export async function selfEnrollFace(payload: {
  email: string;
  face_descriptor: number[];
}): Promise<VerifyEmailResult> {
  const res = await fetch(url("/api/v1/hr/checkin/enroll"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new CheckinApiError(await parseError(res), res.status);
  }
  const body = (await res.json()) as {
    success: boolean;
    data?: VerifyEmailResult;
    message?: string;
  };
  if (!body.success || !body.data) {
    throw new CheckinApiError(
      body.message ||
        "Impossible d'enregistrer votre visage. Réessayez ou contactez les ressources humaines.",
      res.status
    );
  }
  return body.data;
}

export async function submitCheckin(payload: {
  email: string;
  face_descriptor: number[];
  latitude: number;
  longitude: number;
}): Promise<CheckinResult> {
  const res = await fetch(url("/api/v1/hr/checkin"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new CheckinApiError(await parseError(res), res.status);
  }
  const body = (await res.json()) as CheckinResult & { success?: boolean };
  if (!body.success) {
    throw new CheckinApiError(
      "Le pointage n'a pas abouti. Réessayez. Si le problème continue, contactez les ressources humaines.",
      res.status
    );
  }
  return body;
}
