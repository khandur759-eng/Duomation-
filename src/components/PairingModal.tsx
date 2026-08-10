import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { QrCode, Camera, Keyboard, X, Copy, Check, Smartphone, Monitor, AlertTriangle } from 'lucide-react';
import { getPublicAppUrl } from '../utils/url';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  code?: string;
  role: 'draw' | 'display' | 'standalone';
  onJoinSession: (code: string) => void;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  code,
  role,
  onJoinSession,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [scanMode, setScanMode] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Reset modal state on close/open or code change
  useEffect(() => {
    if (!isOpen) {
      setQrDataUrl('');
      setScanMode(false);
      setScanError(null);
      setManualCode('');
      setCopied(false);
      return;
    }

    if (role === 'draw' && code) {
      const publicUrl = getPublicAppUrl();
      const fullUrl = `${publicUrl}?join=${code}`;
      QRCode.toDataURL(fullUrl, { width: 280, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        .then((url) => setQrDataUrl(url))
        .catch((err) => {
          console.error('[Duomation][QR] Generation error:', err);
          setQrDataUrl('');
        });
    }
  }, [code, isOpen, role]);

  // Handle Camera scanning for Device B (Display Mode only)
  useEffect(() => {
    if (!scanMode || !isOpen || role !== 'display') return;

    let stream: MediaStream | null = null;
    let timerId: any = null;
    let isStopped = false;

    async function startCamera() {
      // Bug #8: Secure context verification
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setScanError('Camera scanning requires a secure HTTPS connection. Please enter the 6-character code manually.');
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        setScanError('Camera access is not supported by your browser. Please enter the code manually.');
        return;
      }

      try {
        setScanError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (isStopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scheduleScan();
        }
      } catch (err: any) {
        console.warn('[Duomation][Camera] Error starting camera:', err);
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          setScanError('Camera permission was denied. Please allow camera access in browser settings or enter the code manually.');
        } else {
          setScanError('Unable to access camera. Please use the 6-character code instead.');
        }
      }
    }

    function scheduleScan() {
      if (isStopped) return;
      timerId = setTimeout(() => {
        scanFrame();
        if (!isStopped) scheduleScan();
      }, 100); // Throttled to ~10 FPS for mobile performance
    }

    function scanFrame() {
      if (!videoRef.current || !canvasRef.current || isStopped) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const codeFound = jsQR(imageData.data, imageData.width, imageData.height);

        if (codeFound && codeFound.data) {
          const qrText = codeFound.data.trim();
          let extractedCode: string | null = null;

          // Bug #9 & #10: Parse URL safely
          try {
            if (qrText.startsWith('http://') || qrText.startsWith('https://')) {
              const url = new URL(qrText);
              extractedCode = url.searchParams.get('join');
            }
          } catch (e) {}

          if (!extractedCode && qrText.includes('join=')) {
            const parts = qrText.split('join=');
            extractedCode = parts[1]?.split('&')[0];
          }

          if (!extractedCode && /^[A-Z2-9]{6}$/i.test(qrText)) {
            extractedCode = qrText;
          }

          if (extractedCode) {
            const cleanCode = extractedCode.trim().toUpperCase();
            if (/^[A-Z2-9]{6}$/.test(cleanCode)) {
              onJoinSession(cleanCode);
              setScanMode(false);
              isStopped = true;
              return;
            }
          }

          setScanError('This QR code is not a valid Duomation pairing code.');
        }
      }
    }

    startCamera();

    return () => {
      isStopped = true;
      if (timerId) clearTimeout(timerId);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [scanMode, isOpen, role]);

  if (!isOpen) return null;

  const publicAppUrl = getPublicAppUrl();
  const joinLink = code ? `${publicAppUrl}?join=${code}` : '';

  const handleCopyLink = () => {
    if (joinLink) {
      navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim().toUpperCase();
    if (clean.length >= 4) {
      onJoinSession(clean);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 mb-3">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-white">
            {role === 'draw' ? 'Pair Display Monitor (Device B)' : 'Connect as Display Monitor'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {role === 'draw'
              ? 'Scan with Device B or enter the pairing code to stream drawing live.'
              : 'Scan the QR code on Device A or enter its 6-character pair code.'}
          </p>
        </div>

        {role === 'draw' ? (
          /* Device A View: Authoritative for DRAW role */
          <div className="space-y-5">
            <div className="flex flex-col items-center bg-white rounded-xl p-4 shadow-inner">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Pairing QR Code" className="w-56 h-56" />
              ) : (
                <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                  <span className="text-sm font-medium text-slate-700 mb-1">Pairing Code:</span>
                  <span className="text-3xl font-mono font-bold text-indigo-600 mb-2">{code || '...'}</span>
                  <span className="text-xs text-slate-400">Generating QR code image...</span>
                </div>
              )}
            </div>

            <div className="text-center">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                Pair Code for Device B:
              </span>
              <div className="mt-1 text-3xl font-mono font-bold tracking-widest text-indigo-400 bg-slate-950/80 py-2.5 px-4 rounded-xl border border-indigo-500/20">
                {code || 'Generating...'}
              </div>
            </div>

            <button
              onClick={handleCopyLink}
              disabled={!code}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-medium transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Direct Pairing Link Copied!' : 'Copy Direct Pairing Link'}
            </button>

            <div className="text-center py-1">
              <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Waiting for Device B to connect...
              </span>
            </div>
          </div>
        ) : (
          /* Device B View: Authoritative for DISPLAY role or general join */
          <div className="space-y-5">
            {scanMode ? (
              <div className="space-y-3">
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black border border-slate-700 flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 border-2 border-indigo-500/50 rounded-xl pointer-events-none animate-pulse" />
                </div>
                {scanError && (
                  <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-rose-300 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{scanError}</span>
                  </div>
                )}
                <button
                  onClick={() => setScanMode(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
                >
                  Use Manual 6-Digit Code Instead
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setScanError(null);
                    setScanMode(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  Scan QR Code with Camera
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-800 w-full" />
                  <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                    OR
                  </span>
                </div>

                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Enter 6-Character Pair Code:
                    </label>
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      placeholder="e.g. K9X2P4"
                      maxLength={8}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-center text-xl font-mono tracking-widest text-white uppercase focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={manualCode.trim().length < 4}
                    className="w-full py-3 rounded-xl bg-slate-800 hover:bg-indigo-600 disabled:opacity-40 text-white font-medium transition-colors"
                  >
                    Connect as Display Monitor
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
