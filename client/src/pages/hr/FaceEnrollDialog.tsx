/**
 * Capture a 128-d MediaPipe landmark descriptor from webcam for HR enrollment.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { detectFaceDescriptor, ensureFaceLandmarker } from "@/lib/hrFace";

type Props = {
  open: boolean;
  employeeName: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onEnroll: (descriptor: number[]) => Promise<void>;
};

export function FaceEnrollDialog({
  open,
  employeeName,
  pending = false,
  onOpenChange,
  onEnroll,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [descriptor, setDescriptor] = useState<number[] | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setReady(false);
      setError(null);
      setFaceDetected(false);
      setDescriptor(null);
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        setError(null);
        setReady(false);
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
              setFaceDetected(true);
              setDescriptor(next);
            } else {
              setFaceDetected(false);
              setDescriptor(null);
            }
          } catch {
            setFaceDetected(false);
            setDescriptor(null);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Impossible de démarrer la reconnaissance faciale. Vérifiez la caméra et la connexion."
          );
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera]);

  async function handleConfirm() {
    if (!descriptor || descriptor.length !== 128) return;
    await onEnroll(descriptor);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enregistrer le visage</DialogTitle>
          <DialogDescription>
            Capturez le visage de {employeeName} (MediaPipe). Si un ancien enregistrement
            existait, il sera remplacé — nécessaire après le passage à MediaPipe.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-full bg-muted">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full scale-x-[-1] object-cover"
          />
          <div
            className={`pointer-events-none absolute inset-4 rounded-full border-4 ${
              faceDetected ? "border-primary" : "border-transparent"
            }`}
          />
        </div>

        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {!ready
              ? "Chargement de la caméra et de MediaPipe…"
              : faceDetected
                ? "Visage détecté — vous pouvez valider"
                : "Placez le visage dans le cercle"}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!faceDetected || !descriptor || pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? "Enregistrement…" : "Valider le visage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
