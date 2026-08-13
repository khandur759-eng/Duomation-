import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  QrCode,
  Camera,
  X,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Loader2,
  WifiOff,
} from 'lucide-react';
import { getPublicAppUrl } from '../utils/url';

export type QRState = 'waiting-for-session' | 'generating' | 'ready' | 'error';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  code?: string;
  role: 'draw' | 'display' | 'standalone';
  onJoinSession: (code: string) => void;
  isCreatingSession?: boolean;
  sessionError?: string | null;
  onRetryCreateSession?: () => void;
  hasDisplayDevice?: boolean;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  code,
  role,
  onJoinSession,
  isCreatingSession = false,
  sessionError = null,
  onRetryCreateSession,
  hasDisplayDevice = false,
}) => {
  const [qrState, setQrState] = useState<QRState>('waiting-for-session');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [scanMode, setScanMode] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Generate QR code for Device A
  const generateQR = async (pairingCode: string) => {
    setQrState('generating');
    setQrError(null);
    try {
      const publicUrl = getPublicAppUrl();
      const fullUrl = `${publicUrl}?join=${pairingCode}`;
      console.info('[Duomation QR] Payload URL =', fullUrl);

      const url = await QRCode.toDataURL(fullUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(url);
      setQrState('ready');
      setQrError(null);
    } catch (err: any) {
      console.error('[Duomation][QR] Failed to generate QR code:', err);
      setQrDataUrl('');
      setQrState('error');
      setQrError('Unable to generate pairing QR code.');
    }
  };

  // Reset modal state on close/open or code change
  useEffect(() => {
    if (!isOpen) {
      setQrDataUrl('');
      setQrState('waiting-for-session');
      setQrError(null);
      setScanMode(false);
      setScanError(null);
      setManualCode('');
      setCopied(false);
      return;
    }

    if (role === 'draw') {
      if (code) {
        generateQR(code);
      } else if (sessionError) {
        setQrState('error');
      } else {
        setQrState('waiting-for-session');
      }
    }
  }, [code, isOpen, role, sessionError]);

  // Handle Camera scanning for Device B (Display Mode only)
  useEffect(() => {
    if (!scanMode || !isOpen || role !== 'display') return;

    let stream: MediaStream | null = null;
    let timerId: any = null;
    let isStopped = false;

    async function startCamera() {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setScanError(
          'Camera scanning requires a secure HTTPS connection. Please enter the 6-character code manually.'
        );
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        setScanError(
          'Camera access is not supported by your browser. Please enter the code manually.'
        );
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
        if (
          err?.name === 'NotAllowedError' ||
          err?.name === 'PermissionDeniedError'
        ) {
          setScanError(
            'Camera permission was denied. Please allow camera access in browser settings or enter the code manually.'
          );
        } else {
          setScanError(
            'Unable to access camera. Please use the 6-character code instead.'
          );
        }
      }
    }

    function scheduleScan() {
      if (isStopped) return;
      timerId = setTimeout(() => {
        scanFrame();
        if (!isStopped) scheduleScan();
      }, 100);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div
        className={`relative w-full max-w-md overflow-hidden rounded-[2rem] border p-6 shadow-[0_30px_90px_rgba(15,23,42,0.30)] ${
          role === 'display'
            ? 'border-white/80 bg-white text-slate-900 shadow-indigo-950/20'
            : 'border-slate-800 bg-slate-900 text-slate-100'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
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
            {/* Case 1: Session creation error */}
            {sessionError ? (
              <div className="flex flex-col items-center justify-center bg-rose-500/10 border border-rose-500/20 rounded-xl p-5 text-center space-y-3">
                <WifiOff className="w-8 h-8 text-rose-400" />
                <div>
                  <h3 className="text-sm font-semibold text-rose-200">Pairing Service Unavailable</h3>
                  <p className="text-xs text-rose-300/80 mt-1">{sessionError}</p>
                </div>
                <p className="text-[11px] text-slate-400">
                  Please check your internet connection and try reconnecting.
                </p>
                {onRetryCreateSession && (
                  <button
                    onClick={onRetryCreateSession}
                    disabled={isCreatingSession}
                    className="flex items-center gap-2 py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCreatingSession ? 'animate-spin' : ''}`} />
                    {isCreatingSession ? 'Connecting...' : 'Retry Connection'}
                  </button>
                )}
              </div>
            ) : isCreatingSession || qrState === 'waiting-for-session' || (!code && !sessionError) ? (
              /* Case 2: Waiting for session creation */
              <div className="flex flex-col items-center justify-center bg-slate-950/80 rounded-xl p-8 border border-slate-800/80 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Creating Secure Pairing Session</h3>
                  <p className="text-xs text-slate-400 mt-1">Connecting to the Duomation realtime server...</p>
                </div>
              </div>
            ) : qrState === 'error' ? (
              /* Case 3: QR generation error */
              <div className="flex flex-col items-center justify-center bg-slate-950/80 rounded-xl p-6 border border-slate-800 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">QR Code Error</h3>
                  <p className="text-xs text-slate-400 mt-1">{qrError || 'Unable to generate pairing QR.'}</p>
                </div>
                <div className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Pairing Code:</span>
                  <span className="text-2xl font-mono font-bold text-indigo-400">{code}</span>
                </div>
                {code && (
                  <button
                    onClick={() => generateQR(code)}
                    className="flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry QR Generation
                  </button>
                )}
              </div>
            ) : (
              /* Case 4: QR Ready or Code Available */
              <>
                <div className="flex flex-col items-center bg-white rounded-xl p-4 shadow-inner">
                  {qrState === 'generating' ? (
                    <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                      <span className="text-xs text-slate-500 font-medium">Generating QR code...</span>
                    </div>
                  ) : qrDataUrl ? (
                    <img src={qrDataUrl} alt="Pairing QR Code" className="w-56 h-56" />
                  ) : null}
                </div>

                <div className="text-center">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                    Pair Code for Device B:
                  </span>
                  <div className="mt-1 text-3xl font-mono font-bold tracking-widest text-indigo-400 bg-slate-950/80 py-2.5 px-4 rounded-xl border border-indigo-500/20">
                    {code}
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
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasDisplayDevice ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    {hasDisplayDevice ? 'Device B Connected' : 'Waiting for Device B to connect...'}
                  </span>
                </div>
              </>
            )}
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

