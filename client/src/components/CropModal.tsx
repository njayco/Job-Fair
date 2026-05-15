import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Check, AlertCircle } from 'lucide-react';

interface CropModalProps {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  isUploading?: boolean;
  uploadError?: string;
}

const OUTPUT_SIZE = 400;
const MAX_SCALE = 4;

export default function CropModal({ file, onConfirm, onCancel, isUploading, uploadError }: CropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [minScale, setMinScale] = useState(0.1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    dragging: false, startX: 0, startY: 0, origX: 0, origY: 0,
  });

  const CANVAS_SIZE = 360;
  const CIRCLE_R = CANVAS_SIZE / 2 - 16;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const fitScale = Math.max(
        (CIRCLE_R * 2) / img.naturalWidth,
        (CIRCLE_R * 2) / img.naturalHeight,
      );
      setMinScale(fitScale);
      setScale(fitScale);
      setOffset({ x: 0, y: 0 });
      setImgLoaded(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, CIRCLE_R]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext('2d')!;
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = cx - dw / 2 + offset.x;
    const dy = cy - dh / 2 + offset.y;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, CIRCLE_R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    ctx.fillStyle = 'rgba(10, 15, 30, 0.72)';
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(cx, cy, CIRCLE_R, 0, Math.PI * 2, true);
    ctx.fill('evenodd');

    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, CIRCLE_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      const r = i / 3;
      ctx.beginPath();
      ctx.moveTo(cx - CIRCLE_R, cy - CIRCLE_R + CIRCLE_R * 2 * r);
      ctx.lineTo(cx + CIRCLE_R, cy - CIRCLE_R + CIRCLE_R * 2 * r);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - CIRCLE_R + CIRCLE_R * 2 * r, cy - CIRCLE_R);
      ctx.lineTo(cx - CIRCLE_R + CIRCLE_R * 2 * r, cy + CIRCLE_R);
      ctx.stroke();
    }
  }, [imgLoaded, scale, offset, CIRCLE_R]);

  useEffect(() => {
    draw();
  }, [draw]);

  const clampOffset = useCallback((ox: number, oy: number, sc: number) => {
    const img = imgRef.current;
    if (!img) return { x: ox, y: oy };
    const dw = img.naturalWidth * sc;
    const dh = img.naturalHeight * sc;
    const maxX = Math.max(0, dw / 2 - CIRCLE_R);
    const maxY = Math.max(0, dh / 2 - CIRCLE_R);
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    };
  }, [CIRCLE_R]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isUploading) return;
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset(dragRef.current.origX + dx, dragRef.current.origY + dy, scale));
  };
  const handleMouseUp = () => { dragRef.current.dragging = false; };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isUploading || e.touches.length !== 1) return;
    const t = e.touches[0];
    dragRef.current = { dragging: true, startX: t.clientX, startY: t.clientY, origX: offset.x, origY: offset.y };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current.dragging || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - dragRef.current.startX;
    const dy = t.clientY - dragRef.current.startY;
    setOffset(clampOffset(dragRef.current.origX + dx, dragRef.current.origY + dy, scale));
  };
  const handleTouchEnd = () => { dragRef.current.dragging = false; };

  const handleWheel = (e: React.WheelEvent) => {
    if (isUploading) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const newScale = Math.max(minScale, Math.min(MAX_SCALE, scale + delta * scale));
    const clamped = clampOffset(offset.x, offset.y, newScale);
    setScale(newScale);
    setOffset(clamped);
  };

  const adjustScale = (delta: number) => {
    const newScale = Math.max(minScale, Math.min(MAX_SCALE, scale + delta));
    const clamped = clampOffset(offset.x, offset.y, newScale);
    setScale(newScale);
    setOffset(clamped);
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || isUploading) return;
    const offscreen = document.createElement('canvas');
    offscreen.width = OUTPUT_SIZE;
    offscreen.height = OUTPUT_SIZE;
    const ctx = offscreen.getContext('2d')!;
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = cx - dw / 2 + offset.x;
    const dy = cy - dh / 2 + offset.y;

    const ratio = OUTPUT_SIZE / (CIRCLE_R * 2);
    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      img,
      (dx - (cx - CIRCLE_R)) * ratio,
      (dy - (cy - CIRCLE_R)) * ratio,
      dw * ratio,
      dh * ratio,
    );
    ctx.restore();

    offscreen.toBlob(blob => {
      if (blob) onConfirm(blob);
      else alert('Failed to process image. Please try a different file.');
    }, 'image/jpeg', 0.92);
  };

  const busy = !imgLoaded || !!isUploading;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget && !isUploading) onCancel(); }}
    >
      <div
        style={{
          backgroundColor: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '1rem',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
        }}
      >
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: '#F0F4FF', fontSize: '1rem' }}>
            Crop Photo
          </span>
          <button
            onClick={onCancel}
            disabled={!!isUploading}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: isUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', padding: '0.25rem', opacity: isUploading ? 0.4 : 1 }}
            onMouseEnter={e => { if (!isUploading) e.currentTarget.style.color = '#F0F4FF'; }}
            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ color: '#94A3B8', fontSize: '0.8rem', fontFamily: "'Inter', sans-serif", margin: 0, textAlign: 'center' }}>
          Drag to reposition · Scroll or use buttons to zoom
        </p>

        <div style={{ position: 'relative', borderRadius: '0.75rem', overflow: 'hidden', background: '#0A0F1E', lineHeight: 0 }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ cursor: isUploading ? 'not-allowed' : 'grab', display: 'block', maxWidth: '100%', touchAction: 'none', opacity: isUploading ? 0.6 : 1 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          />
          {!imgLoaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>Loading…</span>
            </div>
          )}
          {isUploading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,15,30,0.45)' }}>
              <span style={{ color: '#3B82F6', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>Uploading…</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
          <button
            onClick={() => adjustScale(-0.15)}
            disabled={busy}
            style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '0.5rem', color: '#94A3B8', padding: '0.45rem 0.6rem', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', opacity: busy ? 0.4 : 1 }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.color = '#F0F4FF'; }}
            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <input
            type="range"
            min={minScale}
            max={MAX_SCALE}
            step={0.01}
            value={scale}
            disabled={busy}
            onChange={e => {
              const s = parseFloat(e.target.value);
              setScale(s);
              setOffset(o => clampOffset(o.x, o.y, s));
            }}
            style={{ flex: 1, accentColor: '#3B82F6', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.4 : 1 }}
          />
          <button
            onClick={() => adjustScale(0.15)}
            disabled={busy}
            style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '0.5rem', color: '#94A3B8', padding: '0.45rem 0.6rem', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', opacity: busy ? 0.4 : 1 }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.color = '#F0F4FF'; }}
            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {uploadError && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#EF4444', fontSize: '0.8rem', fontFamily: "'Inter', sans-serif", backgroundColor: '#1E293B', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            {uploadError} — adjust your crop and try again.
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
          <button
            onClick={onCancel}
            disabled={!!isUploading}
            style={{
              flex: 1, background: '#1E293B', border: '1px solid #334155',
              borderRadius: '0.5rem', color: '#94A3B8', padding: '0.6rem 1rem',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              fontFamily: "'Inter', sans-serif", fontSize: '0.875rem',
              opacity: isUploading ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (!isUploading) e.currentTarget.style.color = '#F0F4FF'; }}
            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            style={{
              flex: 1, background: '#3B82F6', border: 'none',
              borderRadius: '0.5rem', color: '#fff', padding: '0.6rem 1rem',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: "'Inter', sans-serif", fontSize: '0.875rem', fontWeight: 600,
              opacity: busy ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.background = '#2563EB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#3B82F6'; }}
          >
            <Check size={15} />
            {isUploading ? 'Uploading…' : uploadError ? 'Try Again' : 'Crop & Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
