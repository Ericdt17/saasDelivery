import { useCallback, useEffect, useRef, useState } from "react";
import { BrandHeader } from "./BrandHeader";
import {
  detectFaceDescriptor,
  ensureFaceLandmarker,
  fakeDescriptor128,
  isE2EMode,
} from "../lib/face";
import { cameraErrorMessage, MSG } from "../lib/messages";

type Props = {
  employeeName: string;
  loading: boolean;
  /** Shown while check-in pipeline is running (enroll / GPS / API). */
  busyLabel?: string | null;
  /** First connection: capture & save face. Later: match & check in. */
  mode?: "enroll" | "verify";
  onValidated: (descriptor: number[]) => void;
};

/** ms of stable face detection before auto-submitting */
const HOLD_MS = 2500;

/** consecutive missed frames before declaring face lost (~333 ms at 60 fps) */
const MISS_THRESHOLD = 20;

const ARC_R = 46;
const ARC_C = 2 * Math.PI * ARC_R;

/** Ease-in-out cubic — slow start, fast middle, slow end */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/** Polar → SVG cartesian, starting at 12 o'clock */
function arcTip(progress: number): { x: number; y: number } {
  const angle = progress * 2 * Math.PI - Math.PI / 2;
  return { x: 50 + ARC_R * Math.cos(angle), y: 50 + ARC_R * Math.sin(angle) };
}

export function FaceStep({
  employeeName,
  loading,
  busyLabel = null,
  mode = "verify",
  onValidated,
}: Props) {
  const isEnroll = mode === "enroll";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);

  // descriptor is kept in a ref so changing it every frame doesn't re-trigger
  // the auto-validate effect. State is only needed for the E2E manual button.
  const descriptorRef = useRef<number[] | null>(null);
  const [descriptorForE2e, setDescriptorForE2e] = useState<number[] | null>(null);
  // Tolerate up to MISS_THRESHOLD consecutive missed frames before declaring face lost
  const missedFramesRef = useRef(0);

  const e2e = isE2EMode();

  // Auto-validate
  const holdStartRef = useRef<number | null>(null);
  const rafHoldRef = useRef<number | null>(null);
  const calledRef = useRef(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const onValidatedRef = useRef(onValidated);
  useEffect(() => { onValidatedRef.current = onValidated; }, [onValidated]);

  // Only depends on faceDetected + loading — descriptor is read via ref so this
  // effect never re-runs on a new frame descriptor (which would reset the countdown).
  useEffect(() => {
    if (e2e) return;

    if (faceDetected && !loading && !calledRef.current) {
      holdStartRef.current = performance.now();

      const tick = () => {
        const elapsed = performance.now() - (holdStartRef.current ?? 0);
        const progress = Math.min(elapsed / HOLD_MS, 1);
        setHoldProgress(progress);

        if (progress < 1) {
          rafHoldRef.current = requestAnimationFrame(tick);
        } else {
          const desc = descriptorRef.current;
          if (!calledRef.current && desc) {
            calledRef.current = true;
            onValidatedRef.current(desc);
          }
        }
      };
      rafHoldRef.current = requestAnimationFrame(tick);
    } else {
      if (rafHoldRef.current) {
        cancelAnimationFrame(rafHoldRef.current);
        rafHoldRef.current = null;
      }
      if (!loading) {
        calledRef.current = false;
        setHoldProgress(0);
        holdStartRef.current = null;
      }
    }

    return () => {
      if (rafHoldRef.current) {
        cancelAnimationFrame(rafHoldRef.current);
        rafHoldRef.current = null;
      }
    };
  }, [e2e, faceDetected, loading]);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (e2e) {
      window.__HR_E2E__ = {
        ...(window.__HR_E2E__ || {}),
        injectFace: (desc) => {
          const next = desc && desc.length === 128 ? desc : fakeDescriptor128();
          descriptorRef.current = next;
          setDescriptorForE2e(next);
          setFaceDetected(true);
        },
      };
      return () => {
        if (window.__HR_E2E__) delete window.__HR_E2E__.injectFace;
      };
    }

    let cancelled = false;

    async function start() {
      try {
        setError(null);
        const landmarker = await ensureFaceLandmarker();
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const tick = () => {
          if (cancelled || !videoRef.current) return;
          try {
            const next = detectFaceDescriptor(landmarker, videoRef.current, performance.now());
            if (next) {
              if (missedFramesRef.current > 0) {
                console.debug(`[FaceStep] face recovered after ${missedFramesRef.current} missed frame(s)`);
              }
              missedFramesRef.current = 0;
              descriptorRef.current = next;
              setFaceDetected(true);
            } else {
              missedFramesRef.current += 1;
              if (missedFramesRef.current === MISS_THRESHOLD) {
                console.debug(`[FaceStep] face lost after ${MISS_THRESHOLD} consecutive misses`);
                descriptorRef.current = null;
                setFaceDetected(false);
              }
            }
          } catch {
            missedFramesRef.current += 1;
            if (missedFramesRef.current >= MISS_THRESHOLD) {
              descriptorRef.current = null;
              setFaceDetected(false);
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (!cancelled) {
          const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
          if (name === "NotAllowedError" || name === "NotFoundError" || name === "NotReadableError") {
            setError(cameraErrorMessage(e));
          } else {
            setError(MSG.FACE_LOAD);
          }
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [e2e, stopCamera]);

  const statusText = (() => {
    if (e2e) return faceDetected ? "Visage simulé prêt" : "Utilisez le bouton de simulation";
    if (loading && busyLabel) return busyLabel;
    if (!ready) return "Chargement caméra…";
    if (loading) return isEnroll ? MSG.BUSY_ENROLL : MSG.BUSY_CHECKIN;
    if (faceDetected) return "Restez immobile…";
    return "Placez votre visage dans le cercle";
  })();

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-5">
      <BrandHeader
        subtitle={isEnroll ? "Enregistrez votre visage" : "Présentez votre visage"}
        compact
      />
      <p className="-mt-2 text-center text-sm text-ink-muted">Bonjour {employeeName}</p>
      <p className="text-center text-sm leading-relaxed text-ink-muted">
        {isEnroll
          ? "C'est votre première connexion : placez votre visage dans le cercle pour l'enregistrer."
          : "Placez votre visage dans le cercle, face à la caméra, avec un bon éclairage."}
      </p>

      {!ready && !error && !e2e ? (
        <p
          className="w-full rounded-md bg-primary/10 px-3 py-2 text-center text-sm text-ink"
          data-testid="permission-camera-tip"
        >
          {MSG.PERMISSION_CAMERA}
        </p>
      ) : null}

      {loading && busyLabel === MSG.BUSY_GEO ? (
        <p
          className="w-full rounded-md bg-primary/10 px-3 py-2 text-center text-sm text-ink"
          data-testid="permission-geo-tip"
        >
          {MSG.PERMISSION_GEO}
        </p>
      ) : null}

      {!e2e ? (
        <div className="relative w-full max-w-xs">
          {/* Outer pulse ring — appears when face is locked */}
          <div
            className={`pointer-events-none absolute -inset-2 rounded-full border-2 border-primary transition-opacity duration-500 ${
              faceDetected && !loading ? "opacity-40 animate-pulse" : "opacity-0"
            }`}
          />

          <div className="relative aspect-square overflow-hidden rounded-full bg-muted">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full scale-x-[-1] object-cover"
              data-testid="face-video"
            />

            {/* Inner ring: dashed guide → solid primary when face detected */}
            <div
              className={`pointer-events-none absolute inset-2 rounded-full transition-all duration-300 ${
                faceDetected
                  ? "border-[3px] border-primary face-ring-glow"
                  : "border-2 border-dashed border-white/50"
              }`}
              data-testid="face-ring"
            />

            {/* SVG progress arc — fills up over HOLD_MS with easing */}
            {faceDetected && !loading && (() => {
              const eased = easeInOut(holdProgress);
              const tip = arcTip(eased);
              return (
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  aria-hidden
                  style={{ transform: "rotate(-90deg)" }}
                >
                  {/* Background track */}
                  <circle
                    cx="50" cy="50" r={ARC_R}
                    fill="none"
                    stroke="hsl(var(--primary) / 0.15)"
                    strokeWidth="4"
                  />
                  {/* Filled arc */}
                  <circle
                    cx="50" cy="50" r={ARC_R}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={ARC_C}
                    strokeDashoffset={ARC_C * (1 - eased)}
                  />
                  {/* Glow dot at the arc tip */}
                  {eased > 0.01 && eased < 0.99 && (
                    <circle
                      cx={tip.x} cy={tip.y} r="4"
                      fill="hsl(var(--primary))"
                      style={{ filter: "drop-shadow(0 0 4px hsl(var(--primary) / 0.8))" }}
                    />
                  )}
                </svg>
              );
            })()}

            {/* Loading overlay while API call is in flight */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="h-10 w-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="flex aspect-square w-full max-w-xs items-center justify-center rounded-full bg-muted text-center text-sm text-ink-muted"
          data-testid="face-e2e-placeholder"
        >
          Mode E2E — simulez le visage
        </div>
      )}

      {error ? (
        <p className="text-center text-sm leading-relaxed text-red-600" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-center text-sm text-ink-muted">{statusText}</p>
      )}

      {/* E2E-only controls — keep testids intact for Playwright */}
      {e2e && (
        <>
          <button
            type="button"
            data-testid="face-e2e-simulate"
            className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-muted px-4 text-sm font-medium text-ink transition-colors hover:bg-muted/80"
            onClick={() => {
              const next = fakeDescriptor128();
              descriptorRef.current = next;
              setDescriptorForE2e(next);
              setFaceDetected(true);
            }}
          >
            Simuler le visage (E2E)
          </button>

          <button
            type="button"
            data-testid="face-validate"
            disabled={!faceDetected || !descriptorForE2e || loading}
            onClick={() => {
              if (descriptorForE2e) onValidated(descriptorForE2e);
            }}
            className="btn-primary"
          >
            {loading
              ? busyLabel || (isEnroll ? MSG.BUSY_ENROLL : MSG.BUSY_CHECKIN)
              : isEnroll
                ? "Enregistrer mon visage"
                : "Valider ma présence"}
          </button>
        </>
      )}
    </div>
  );
}
