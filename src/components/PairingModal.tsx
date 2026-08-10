import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { QrCode, Camera, Keyboard, X, Copy, Check, Smartphone, Monitor } from 'lucide-react';

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

  // Generate QR code for Device A
  useEffect(() => {
    if (code && isOpen) {
      const appBaseUrl = (import.meta as any).env?.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      const fullUrl = `${appBaseUrl}?join=${code}`;
      QRCode.toDataURL(fullUrl, { width: 280, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    }
  }, [code, isOpen]);

  // Handle Camera scanning for Device B
  useEffect(() => {
    if (!scanMode || !isOpen) return;

    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        setScanError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        setScanError('Unable to access camera for scanning. Please use the 6-character code instead.');
      }
    }

    function scanFrame() {
      if (!videoRef.current || !canvasRef.current || !scanMode) return;

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
          let extractedCode = codeFound.data;
          if (extractedCode.includes('join=')) {
            extractedCode = extractedCode.split('join=')[1];
          }
          if (extractedCode) {
            onJoinSession(extractedCode);
            setScanMode(false);
            return;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }

    startCamera();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [scanMode, isOpen]);

  if (!isOpen) return null;

  const appBaseUrl = (import.meta as any).env?.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const joinLink = code ? `${appBaseUrl}?join=${code}` : '';

  const handleCopyLink = () => {
    if (joinLink) {
      navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim().length >= 4) {
      onJoinSession(manualCode.trim().toUpperCase());
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
          <h2 className="text-xl font-semibold text-white">Pair Second Device</h2>
          <p className="text-xs text-slate-400 mt-1">
            Turn Device B into your dedicated live animation display monitor.
          </p>
        </div>

        {code ? (
          /* Device A view: Displays QR & Code */
          <div className="space-y-5">
            <div className="flex flex-col items-center bg-white rounded-xl p-4 shadow-inner">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Pairing QR Code" className="w-56 h-56" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-500">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="text-center">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                Or enter Pair Code on Device B:
              </span>
              <div className="mt-1 text-3xl font-mono font-bold tracking-widest text-indigo-400 bg-slate-950/80 py-2.5 px-4 rounded-xl border border-indigo-500/20">
                {code}
              </div>
            </div>

            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Link Copied to Clipboard!' : 'Copy Direct Pairing Link'}
            </button>
          </div>
        ) : (
          /* Device B view: Scan or Enter Code */
          <div className="space-y-5">
            {scanMode ? (
              <div className="space-y-3">
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black border border-slate-700 flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 border-2 border-indigo-500/50 rounded-xl pointer-events-none animate-pulse" />
                </div>
                {scanError && <p className="text-xs text-rose-400 text-center">{scanError}</p>}
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
                  onClick={() => setScanMode(true)}
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
