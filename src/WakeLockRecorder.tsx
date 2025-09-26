// src/WakeLockRecorder.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";

type WakeLockSentinel = any; // TS shim for Safari's webkit types

export default function WakeLockRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [supportsWakeLock, setSupportsWakeLock] = useState<boolean>(() => {
    return typeof navigator !== "undefined" && !!(navigator as any).wakeLock?.request;
  });
  const [status, setStatus] = useState<string>("Idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Detect wake lock support once
  useEffect(() => {
    setSupportsWakeLock(!!(navigator as any).wakeLock?.request);
  }, []);

  const acquireWakeLock = useCallback(async () => {
    if (!(navigator as any).wakeLock?.request) return;
    try {
      const sentinel = await (navigator as any).wakeLock.request("screen");
      wakeLockRef.current = sentinel;

      const handleRelease = () => {
        wakeLockRef.current = null;
        if (isRecordingRef.current) {
          acquireWakeLock().catch(() => {
            /* ignore */
          });
        }
        sentinel.removeEventListener("release", handleRelease);
      };

      sentinel.addEventListener("release", handleRelease);
    } catch (err) {
      console.warn("Wake lock request failed:", err);
    }
  }, []);

  // Re-acquire wake lock when tab becomes visible again (iPad/Android quirk)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && isRecording) {
        acquireWakeLock().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isRecording, acquireWakeLock]);

  const startRecording = useCallback(async () => {
    setStatus("Requesting microphone…");

    const wakeLockPromise = supportsWakeLock ? acquireWakeLock() : Promise.resolve();

    // Request mic (must be triggered by user gesture)
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      await wakeLockPromise.catch(() => {});
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {
          /* ignore */
        }
        wakeLockRef.current = null;
      }
      setStatus(`Mic permission failed: ${err?.message || err}`);
      return;
    }

    await wakeLockPromise.catch(() => {});

    streamRef.current = stream;
    chunksRef.current = [];
    setStatus("Starting recorder…");

    // Pick a sensible mime type that works on iPad + Android
    const preferredTypes = [
      "audio/webm;codecs=opus",
      "audio/mp4", // often works on iOS Safari 16+ (container may be 'mp4' or 'm4a')
      "audio/ogg;codecs=opus",
      "audio/webm",
    ];
    const chosen = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";
    setMimeType(chosen);

    try {
      const mr = new MediaRecorder(stream, chosen ? { mimeType: chosen } : undefined);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mr.onstart = () => setStatus("Recording…");
      mr.onpause = () => setStatus("Paused");
      mr.onresume = () => setStatus("Recording…");
      mr.onerror = (e) => setStatus(`Recorder error: ${(e as any).error?.message || e}`);

      mr.onstop = () => {
        setStatus("Finalizing file…");
        const blob = new Blob(chunksRef.current, { type: chosen || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
        setStatus("Idle");
      };

      mr.start(1000); // collect data every 1s
      setIsRecording(true);
      isRecordingRef.current = true;
    } catch (err: any) {
      setStatus(`Failed to start recorder: ${err?.message || err}`);
      // Cleanup stream if MR failed
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {
          /* ignore */
        }
        wakeLockRef.current = null;
      }
    }
  }, [acquireWakeLock, supportsWakeLock]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setStatus("Stopping…");

    try {
      mediaRecorderRef.current?.stop();
    } catch {
      /* ignore */
    }

    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {
        /* ignore */
      }
      wakeLockRef.current = null;
    }

    setStatus("Idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {}
        wakeLockRef.current = null;
      }
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: 0 }}>Wake Lock + Recorder</h2>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Status: <strong>{status}</strong>
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {!isRecording ? (
          <button onClick={startRecording} style={buttonStyle}>
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} style={{ ...buttonStyle, background: "#aa2222" }}>
            Stop Recording
          </button>
        )}
        <span style={{ fontSize: 12, opacity: 0.8 }}>
          Wake Lock: {wakeLockRef.current ? "acquired" : "inactive"}
        </span>
      </div>

      {mimeType && (
        <p style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          Using MIME type: <code>{mimeType}</code>
        </p>
      )}

      {downloadUrl && (
        <div style={{ marginTop: 16 }}>
          <audio controls src={downloadUrl} style={{ width: "100%" }} />
          <div style={{ marginTop: 8 }}>
            <a
              href={downloadUrl}
              download={`recording.${mimeType.includes("mp4") ? "m4a" : "webm"}`}
            >
              Download recording
            </a>
          </div>
        </div>
      )}

      <ul style={tipListStyle}>
        <li>
          iPad/iPhone require <strong>HTTPS</strong> and a <strong>user gesture</strong> to start
          both mic and wake lock.
        </li>
        <li>
          Keep the tab foregrounded. If you switch apps, wake lock may release; we attempt to
          re-acquire when you return.
        </li>
        <li>
          Battery tip: plug in for long sessions—screen + mic consume power quickly.
        </li>
      </ul>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 520,
  margin: "24px auto",
  padding: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const tipListStyle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 12,
  lineHeight: 1.5,
  opacity: 0.9,
};
