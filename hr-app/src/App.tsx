import { useCallback, useRef, useState } from "react";
import {
  CheckinApiError,
  reportClientError,
  selfEnrollFace,
  submitCheckin,
  verifyEmail,
  type RegulationStatus,
} from "./api/checkin";
import { EmailStep } from "./components/EmailStep";
import { FaceStep } from "./components/FaceStep";
import { ResultStep } from "./components/ResultStep";
import { DayCostReminder } from "./components/DayCostReminder";
import { RegulationNotice } from "./components/RegulationNotice";
import { isNetworkErrorMessage, successGreeting } from "./lib/greeting";
import { getCurrentPosition } from "./lib/geo";
import {
  MSG,
  checkinPipelineErrorMessage,
  clientErrorKindFromMessage,
  isRetryableCheckinMessage,
} from "./lib/messages";
import { getRememberedEmail, setRememberedEmail } from "./lib/rememberedEmail";

type Step = "email" | "face" | "confirm" | "error";
type BusyPhase = "enroll" | "geo" | "checkin" | null;

function friendlyError(e: unknown): string {
  if (e instanceof CheckinApiError) {
    return e.message || MSG.GENERIC;
  }
  if (e instanceof TypeError) {
    return MSG.NETWORK;
  }
  if (e instanceof Error && e.message.trim()) {
    return e.message;
  }
  return MSG.GENERIC;
}

function busyLabelFor(phase: BusyPhase): string | null {
  if (phase === "enroll") return MSG.BUSY_ENROLL;
  if (phase === "geo") return MSG.BUSY_GEO;
  if (phase === "checkin") return MSG.BUSY_CHECKIN;
  return null;
}

export default function App() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(() => getRememberedEmail());
  const [employeeName, setEmployeeName] = useState("");
  const [isEnrolled, setIsEnrolled] = useState(true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyPhase, setBusyPhase] = useState<BusyPhase>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [status, setStatus] = useState<"present" | "late" | null>(null);
  const [costLateDay, setCostLateDay] = useState<number | null>(null);
  const [costAbsentDay, setCostAbsentDay] = useState<number | null>(null);
  const [regulation, setRegulation] = useState<RegulationStatus | null>(null);
  const lastDescriptorRef = useRef<number[] | null>(null);

  const reset = useCallback(() => {
    setStep("email");
    setEmail(getRememberedEmail());
    setEmployeeName("");
    setIsEnrolled(true);
    setEmailError(null);
    setLoading(false);
    setBusyPhase(null);
    setErrorMessage(null);
    setCanRetry(false);
    setCheckInTime(null);
    setStatus(null);
    setCostLateDay(null);
    setCostAbsentDay(null);
    setRegulation(null);
    lastDescriptorRef.current = null;
  }, []);

  async function handleVerifyEmail() {
    setEmailError(null);
    setLoading(true);
    try {
      const data = await verifyEmail(email.trim());
      setEmployeeName(data.full_name);
      setEmail(data.email);
      setRememberedEmail(data.email);
      setIsEnrolled(Boolean(data.is_enrolled));
      setCostLateDay(
        typeof data.cost_late_day === "number" ? data.cost_late_day : null
      );
      setCostAbsentDay(
        typeof data.cost_absent_day === "number" ? data.cost_absent_day : null
      );
      setRegulation(data.regulation ?? null);
      setStep("face");
    } catch (e) {
      setEmailError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  async function runCheckinPipeline(face_descriptor: number[]) {
    setLoading(true);
    setErrorMessage(null);
    setCanRetry(false);
    lastDescriptorRef.current = face_descriptor;
    let faceJustEnrolled = false;
    try {
      let enrolled = isEnrolled;
      if (!enrolled) {
        setBusyPhase("enroll");
        await selfEnrollFace({ email, face_descriptor });
        setIsEnrolled(true);
        enrolled = true;
        faceJustEnrolled = true;
      }
      setBusyPhase("geo");
      const position = await getCurrentPosition();
      setBusyPhase("checkin");
      const result = await submitCheckin({
        email,
        face_descriptor,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setEmployeeName(result.employee_name);
      setCheckInTime(result.check_in_time);
      setStatus(result.status);
      setRegulation(result.regulation ?? regulation);
      setStep("confirm");
    } catch (e) {
      const message = checkinPipelineErrorMessage(friendlyError(e), {
        faceJustEnrolled,
      });
      setErrorMessage(message);
      setCanRetry(
        isNetworkErrorMessage(message) || isRetryableCheckinMessage(message)
      );
      setStep("error");
      const kind = clientErrorKindFromMessage(message);
      if (
        kind === "geo_denied" ||
        kind === "geo_timeout" ||
        kind === "geo_unavailable" ||
        kind === "camera_denied" ||
        kind === "camera_unavailable" ||
        kind === "network"
      ) {
        reportClientError({
          kind,
          email: email.trim() || undefined,
          message,
          detail: faceJustEnrolled ? "face_just_enrolled=1" : undefined,
        });
      }
    } finally {
      setBusyPhase(null);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-4 py-10">
      <div className="w-full rounded-2xl bg-white px-6 py-10 shadow-sm">
        {step === "email" ? (
          <EmailStep
            email={email}
            error={emailError}
            loading={loading}
            onEmailChange={setEmail}
            onSubmit={() => void handleVerifyEmail()}
          />
        ) : null}

        {step === "face" ? (
          <FaceStep
            employeeName={employeeName}
            email={email}
            loading={loading}
            busyLabel={busyLabelFor(busyPhase)}
            mode={isEnrolled ? "verify" : "enroll"}
            costLateDay={costLateDay}
            costAbsentDay={costAbsentDay}
            onValidated={(descriptor) => void runCheckinPipeline(descriptor)}
          />
        ) : null}

        {step === "confirm" ? (
          <div className="flex w-full flex-col items-center gap-4">
            <ResultStep
              kind="success"
              title={successGreeting(employeeName)}
              employeeName={employeeName}
              checkInTime={checkInTime}
              status={status}
            />
            <DayCostReminder
              costLateDay={costLateDay}
              costAbsentDay={costAbsentDay}
            />
            <RegulationNotice regulation={regulation} email={email} />
          </div>
        ) : null}

        {step === "error" ? (
          <ResultStep
            kind="error"
            title="Impossible d'enregistrer votre présence"
            message={errorMessage}
            canRetry={canRetry}
            retrying={loading}
            onRetry={() => {
              const desc = lastDescriptorRef.current;
              if (!desc) {
                setStep("face");
                return;
              }
              void runCheckinPipeline(desc);
            }}
            onReset={reset}
          />
        ) : null}
      </div>
    </main>
  );
}
