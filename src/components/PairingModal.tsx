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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200/90 bg-white/95 text-slate-900 backdrop-blur-2xl p-6 sm:p-7 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/80 mb-3 shadow-xs">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-950">
            {role === 'draw' ? 'Pair Display Monitor (Device B)' : 'Connect as Display Monitor'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
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
              <div className="flex flex-col items-center justify-center bg-rose-50 border border-rose-200 rounded-2xl p-5 text-center space-y-3">
                <WifiOff className="w-8 h-8 text-rose-500" />
                <div>
                  <h3 className="text-sm font-bold text-rose-900">Pairing Service Unavailable</h3>
                  <p className="text-xs text-rose-700 mt-1">{sessionError}</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  Please check your internet connection and try reconnecting.
                </p>
                {onRetryCreateSession && (
                  <button
                    onClick={onRetryCreateSession}
                    disabled={isCreatingSession}
                    className="flex items-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-semibold shadow-md shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCreatingSession ? 'animate-spin' : ''}`} />
                    {isCreatingSession ? 'Connecting...' : 'Retry Connection'}
                  </button>
                )}
              </div>
            ) : isCreatingSession || qrState === 'waiting-for-session' || (!code && !sessionError) ? (
              /* Case 2: Waiting for session creation */
              <div className="flex flex-col items-center justify-center bg-slate-50/80 rounded-2xl p-8 border border-slate-200/80 text-center space-y-3 shadow-inner">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Creating Secure Pairing Session</h3>
                  <p className="text-xs text-slate-500 mt-1">Connecting to the Duomation realtime server...</p>
                </div>
              </div>
            ) : qrState === 'error' ? (
              /* Case 3: QR generation error */
              <div className="flex flex-col items-center justify-center bg-amber-50 rounded-2xl p-6 border border-amber-200 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
                <div>
                  <h3 className="text-sm font-bold text-amber-900">QR Code Error</h3>
                  <p className="text-xs text-amber-700 mt-1">{qrError || 'Unable to generate pairing QR.'}</p>
                </div>
                <div className="w-full bg-white p-3.5 rounded-2xl border border-amber-200 shadow-sm">
                  <span className="text-xs text-slate-500 block mb-1 font-medium">Pairing Code:</span>
                  <span className="text-2xl font-mono font-bold text-indigo-600">{code}</span>
                </div>
                {code && (
                  <button
                    onClick={() => generateQR(code)}
                    className="flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition-colors shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry QR Generation
                  </button>
                )}
              </div>
            ) : (
              /* Case 4: QR Ready or Code Available */
              <>
                <div className="flex flex-col items-center bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shadow-sm">
                  {qrState === 'generating' ? (
                    <div className="w-52 h-52 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                      <span className="text-xs text-slate-500 font-medium">Generating QR code...</span>
                    </div>
                  ) : qrDataUrl ? (
                    <img src={qrDataUrl} alt="Pairing QR Code" className="w-52 h-52 rounded-xl" />
                  ) : null}
                </div>

                <div className="text-center">
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    Pair Code for Device B:
                  </span>
                  <div className="mt-1.5 text-3xl font-mono font-bold tracking-widest text-indigo-600 bg-slate-50 py-3 px-4 rounded-2xl border border-slate-200 shadow-inner">
                    {code}
                  </div>
                </div>

                <button
                  onClick={handleCopyLink}
                  disabled={!code}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200/80 disabled:opacity-50 text-slate-700 text-sm font-semibold border border-slate-200/60 shadow-sm transition-all active:scale-[0.99]"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                  {copied ? 'Direct Pairing Link Copied!' : 'Copy Direct Pairing Link'}
                </button>

                <div className="text-center py-1">
                  <span className="inline-flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        hasDisplayDevice ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500 animate-pulse'
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
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-300 flex items-center justify-center shadow-md">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 border-2 border-indigo-500/80 rounded-2xl pointer-events-none animate-pulse" />
                </div>
                {scanError && (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-3 rounded-2xl text-rose-700 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{scanError}</span>
                  </div>
                )}
                <button
                  onClick={() => setScanMode(false)}
                  className="w-full py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors border border-slate-200 shadow-xs"
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
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-md shadow-indigo-500/20 active:scale-[0.99] transition-all"
                >
                  <Camera className="w-5 h-5" />
                  Scan QR Code with Camera
                </button>

                <div className="relative flex items-center justify-center my-2">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-xs text-slate-400 uppercase tracking-wider font-bold">
                    OR
                  </span>
                </div>

                <form onSubmit={handleManualSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Enter 6-Character Pair Code:
                    </label>
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      placeholder="e.g. K9X2P4"
                      maxLength={8}
                      className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xl font-mono font-bold tracking-widest text-slate-900 uppercase focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors shadow-inner"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={manualCode.trim().length < 4}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-[0.99]"
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

