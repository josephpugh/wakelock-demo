import React, { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Path = { color: string; size: number; points: Point[] };

export default function SignaturePadFixed({
  initialColor = "#ffffff",
  initialSize = 3,
  onSave,
}: {
  initialColor?: string;
  initialSize?: number;
  onSave?: (blob: Blob) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // drawing state in refs (avoids React batching issues)
  const pathsRef = useRef<Path[]>([]);
  const currentRef = useRef<Path | null>(null);
  const drawingRef = useRef(false);

  const [color, setColor] = useState(initialColor);
  const [size, setSize] = useState(initialSize);
  const [portrait, setPortrait] = useState(
    typeof window !== "undefined" ? window.matchMedia("(orientation: portrait)").matches : false
  );

  // resize canvas to CSS size with DPR
  const resizeCanvas = () => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Make sure intrinsic bitmap matches visible size
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  };

  const redraw = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawPath = (p: Path) => {
      if (!p.points.length) return;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) {
        const prev = p.points[i - 1];
        const curr = p.points[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      ctx.stroke();
    };

    for (const p of pathsRef.current) drawPath(p);
    if (currentRef.current) drawPath(currentRef.current);
  };

  // pointer handlers (no React state updates per move)
  useEffect(() => {
    const canvas = canvasRef.current!;
    const getPt = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const down = (e: PointerEvent) => {
      // If an overlay (portrait) is up, do nothing
      if (portrait) return;
      drawingRef.current = true;
      canvas.setPointerCapture(e.pointerId);
      currentRef.current = { color, size, points: [getPt(e)] };
      // prevent page gestures
      e.preventDefault();
      redraw();
    };

    const move = (e: PointerEvent) => {
      if (!drawingRef.current || !currentRef.current) return;
      currentRef.current.points.push(getPt(e));
      // prevent scroll/zoom
      e.preventDefault();
      redraw();
    };

    const up = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      canvas.releasePointerCapture(e.pointerId);
      if (currentRef.current && currentRef.current.points.length) {
        pathsRef.current.push(currentRef.current);
      }
      currentRef.current = null;
      e.preventDefault();
      redraw();
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    // block touchmove scroll when finger is on the canvas
    const blockScroll = (ev: TouchEvent) => {
      if (ev.target === canvas) ev.preventDefault();
    };
    document.addEventListener("touchmove", blockScroll, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.removeEventListener("touchmove", blockScroll);
    };
  }, [color, size, portrait]);

  // watch size/orientation
  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    if (wrapRef.current) ro.observe(wrapRef.current);
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);

    const mq = window.matchMedia("(orientation: portrait)");
    const onChange = () => setPortrait(mq.matches);
    mq.addEventListener?.("change", onChange);
    window.addEventListener("orientationchange", onChange);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      mq.removeEventListener?.("change", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  const clear = () => {
    pathsRef.current = [];
    currentRef.current = null;
    redraw();
  };
  const undo = () => {
    pathsRef.current.pop();
    redraw();
  };
  const savePng = () => {
    const canvas = canvasRef.current!;
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (onSave) return onSave(blob);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `signature-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const tryLock = async () => {
    if ("orientation" in screen && "lock" in (screen.orientation as any)) {
      try { await (screen.orientation as any).lock("landscape"); }
      catch { /* ignore; some browsers require PWA/fullscreen */ }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        gridTemplateRows: "1fr auto",
        padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
        background: "#181818",
        color: "#fff",
      }}
    >
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          margin: 12,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #2a2a2a",
          boxShadow: "inset 0 6px 20px rgba(0,0,0,.4)",
          background: "#0f0f0f",
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Signature pad"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            // critical: stops scrolling/zoom stealing the gesture
            touchAction: "none",
            background:
              "linear-gradient(transparent 95%, rgba(255,255,255,.07) 95%) top/100% 56px, #111",
          }}
        />
        {portrait && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,.8)",
              display: "grid",
              placeItems: "center",
              zIndex: 10,
              // make sure it actually blocks touches when up
              pointerEvents: "auto",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>Please rotate your device</div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>This screen works best in landscape.</div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          padding: 12,
          borderTop: "1px solid #2a2a2a",
          background: "#121212",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={undo}>Undo</button>
          <button onClick={clear}>Clear</button>
          <button onClick={savePng}>Save PNG</button>
        </div>
      </div>
    </div>
  );
}
