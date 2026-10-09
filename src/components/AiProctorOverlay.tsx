import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';
import { useExam } from '../stores/exam';

export interface ProctorStatus {
  hasCam: boolean;
  active: boolean;
  facesCount: number;
  lookingAway: boolean;
  audioLoud: boolean;
  violationsCount: number;
  lastViolation: string | null;
}

interface AiProctorProps {
  onViolation?: (type: string, message: string) => void;
  autoLockdown?: boolean; // tab, fullscreen, keys
  checkAudio?: boolean;
}

export function AiProctorOverlay({
  onViolation,
  autoLockdown = true,
  checkAudio = true,
}: AiProctorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const isRunningRef = useRef(true);

  const [modelLoading, setModelLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facesDetected, setFacesDetected] = useState(1);
  const [lookingAway, setLookingAway] = useState(false);
  const [noiseAlert, setNoiseAlert] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [activeViolations, setActiveViolations] = useState<{ id: string; msg: string; time: number }[]>([]);

  const logViolation = useExam((s) => s.logViolation);

  // Helper to record a proctor violation with throttling & UI feedback
  const triggerViolation = useCallback(
    (type: string, msg: string) => {
      const now = Date.now();
      logViolation({ type, at: now });
      onViolation?.(type, msg);

      setActiveViolations((prev) => [
        { id: `${now}-${Math.random()}`, msg, time: now },
        ...prev.slice(0, 4),
      ]);
    },
    [logViolation, onViolation]
  );

  // 1. Initialize MediaPipe FaceDetector
  useEffect(() => {
    let unmounted = false;

    async function initDetector() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        if (unmounted) return;

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });

        if (!unmounted) {
          detectorRef.current = detector;
          setModelLoading(false);
        }
      } catch (err) {
        console.warn('FaceDetector initialization fallback or CDN offline:', err);
        if (!unmounted) {
          // Graceful fallback: basic webcam without AI landmarks if CDN fails
          setModelLoading(false);
        }
      }
    }

    initDetector();

    return () => {
      unmounted = true;
      if (detectorRef.current) {
        try {
          detectorRef.current.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  // 2. Start Camera & Audio stream
  useEffect(() => {
    let videoStream: MediaStream | null = null;
    isRunningRef.current = true;

    async function startMedia() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Camera API not supported in this browser');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
          audio: checkAudio,
        });

        videoStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
          };
        }

        // Setup ambient audio noise monitor
        if (checkAudio) {
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;
            audioStreamRef.current = stream;
          } catch (audioErr) {
            console.warn('Web Audio proctoring not initialized:', audioErr);
          }
        }
      } catch (err: any) {
        setCameraError(err?.message || 'Camera permission denied');
        triggerViolation('no-cam-perm', 'Camera permission required for AMCAT proctored exam');
      }
    }

    startMedia();

    return () => {
      isRunningRef.current = false;
      if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [checkAudio, triggerViolation]);

  // 3. Continuous Video AI Detection Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastCheckTime = 0;
    let noFaceCounter = 0;
    let multiFaceCounter = 0;
    let lookingAwayCounter = 0;

    function detectFrame(now: number) {
      if (!isRunningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = detectorRef.current;

      // Run inference every 600ms to save CPU & maintain responsive 60fps UI
      if (video && video.readyState >= 2 && now - lastCheckTime > 600) {
        lastCheckTime = now;

        if (detector && canvas) {
          try {
            const detections = detector.detectForVideo(video, now).detections;
            const count = detections.length;
            setFacesDetected(count);

            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = video.videoWidth || 320;
              canvas.height = video.videoHeight || 240;
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              if (count === 1) {
                const det = detections[0];
                const box = det.boundingBox;
                if (box) {
                  // Draw proctor bounding box
                  ctx.strokeStyle = '#1e9e62';
                  ctx.lineWidth = 2.5;
                  ctx.strokeRect(box.originX, box.originY, box.width, box.height);

                  // Estimate head pose from keypoints (nose tip vs ear landmarks)
                  // Keypoints order in MediaPipe BlazeFace:
                  // 0: right eye, 1: left eye, 2: nose tip, 3: mouth center, 4: right ear tragion, 5: left ear tragion
                  if (det.keypoints && det.keypoints.length >= 6) {
                    const nose = det.keypoints[2];
                    const rightEye = det.keypoints[0];
                    const leftEye = det.keypoints[1];

                    // Check horizontal yaw
                    const eyeMidX = (rightEye.x + leftEye.x) / 2;
                    const diffX = Math.abs(nose.x - eyeMidX);

                    // If nose deviates significantly from eye center, candidate is looking away
                    const isAway = diffX > 0.085;
                    setLookingAway(isAway);

                    if (isAway) {
                      lookingAwayCounter++;
                      if (lookingAwayCounter >= 3) {
                        triggerViolation('looking-away', 'Candidate looking away from screen');
                        lookingAwayCounter = 0;
                      }
                    } else {
                      lookingAwayCounter = 0;
                    }
                  }
                }
              }
            }

            // Flag zero face after 2 consecutive cycles (~1.2s)
            if (count === 0) {
              noFaceCounter++;
              if (noFaceCounter >= 2) {
                triggerViolation('no-face', 'No face detected in webcam view');
                noFaceCounter = 0;
              }
            } else {
              noFaceCounter = 0;
            }

            // Flag multiple faces immediately
            if (count > 1) {
              multiFaceCounter++;
              if (multiFaceCounter >= 2) {
                triggerViolation('multiple-faces', `Multiple faces (${count}) detected in frame!`);
                multiFaceCounter = 0;
              }
            } else {
              multiFaceCounter = 0;
            }
          } catch {
            /* ignore individual inference frame drop */
          }
        }

        // Ambient Noise Audio Level check
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const averageVolume = sum / dataArray.length;

          // If volume spikes consistently (> 65), flag as background noise / speaking
          if (averageVolume > 65) {
            setNoiseAlert(true);
            triggerViolation('ambient-speech', 'Unusual background noise or voice detected');
          } else {
            setNoiseAlert(false);
          }
        }
      }

      animationFrameId = requestAnimationFrame(detectFrame);
    }

    animationFrameId = requestAnimationFrame(detectFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [triggerViolation]);

  // 4. Browser Environment Lockdown (Fullscreen, Visibility, Key restrictions, Clipboard)
  useEffect(() => {
    if (!autoLockdown) return;

    // Visibility change / tab switch
    const onVisibility = () => {
      if (document.hidden) {
        triggerViolation('tab-switch', 'Switched browser tab or minimized window');
      }
    };

    // Window blur
    const onBlur = () => {
      triggerViolation('window-blur', 'Window lost focus (Alt+Tab or external click)');
    };

    // Fullscreen exit
    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        setFullscreenWarning(true);
        triggerViolation('fullscreen-exit', 'Exited exam fullscreen mode');
      } else {
        setFullscreenWarning(false);
      }
    };

    // Prevent context menu (right click)
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerViolation('clipboard', 'Right click is disabled during AMCAT proctoring');
    };

    // Prevent Copy, Cut, Paste
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation('clipboard', 'Copying content is strictly forbidden');
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation('clipboard', 'Pasting content is disabled');
    };

    // Prevent developer shortcuts: F12, Ctrl+Shift+I, Ctrl+U, Alt+Tab
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        triggerViolation('dev-tools', 'Inspect / DevTools shortcut blocked');
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [autoLockdown, triggerViolation]);

  const reEnterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenWarning(false);
    } catch {
      /* ignore */
    }
  };

  const getStatusColor = () => {
    if (cameraError) return '#d64545';
    if (facesDetected === 0 || facesDetected > 1 || lookingAway) return '#eab308';
    return '#1e9e62';
  };

  const getStatusText = () => {
    if (cameraError) return 'Camera Error';
    if (modelLoading) return 'AI Loading…';
    if (facesDetected === 0) return '⚠ No Face Detected';
    if (facesDetected > 1) return `⚠ ${facesDetected} Faces in View!`;
    if (lookingAway) return '⚠ Looking Away';
    if (noiseAlert) return '🔊 Noise Spike';
    return '● Proctor Verified';
  };

  return (
    <>
      {/* Floating Picture-In-Picture Proctor Camera Box */}
      <div
        className="amcat-proctor-pip"
        style={{
          position: 'fixed',
          top: 14,
          right: 14,
          width: 175,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#090f1d',
          border: `2.5px solid ${getStatusColor()}`,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 9999,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: 125, background: '#000' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirrored view like real webcam
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              transform: 'scaleX(-1)',
            }}
          />
          {cameraError && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                textAlign: 'center',
                background: 'rgba(214,69,69,0.85)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {cameraError}
            </div>
          )}
        </div>

        {/* Status Indicator Bar */}
        <div
          style={{
            padding: '5px 8px',
            fontSize: 10.5,
            fontWeight: 700,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(9, 15, 29, 0.95)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span style={{ color: getStatusColor(), display: 'flex', alignItems: 'center', gap: 4 }}>
            {getStatusText()}
          </span>
          <span
            style={{
              fontSize: 9,
              opacity: 0.75,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            AMCAT AI
          </span>
        </div>
      </div>

      {/* Floating Toast Violations Alert */}
      {activeViolations.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 150,
            right: 14,
            width: 260,
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          {activeViolations.slice(0, 2).map((v) => (
            <div
              key={v.id}
              style={{
                background: 'rgba(220, 38, 38, 0.92)',
                color: '#fff',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 600,
                boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                animation: 'slideInRight 0.2s ease-out',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⚠</span>
              <span>{v.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Recovery Modal */}
      {fullscreenWarning && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 15, 30, 0.88)',
            backdropFilter: 'blur(6px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: 28,
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 12 }}>🚨</div>
            <h3 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 20 }}>
              Fullscreen Exited
            </h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
              The AMCAT proctoring engine requires this exam to run in fullscreen. Exiting fullscreen
              has been recorded on your integrity ledger.
            </p>
            <button
              onClick={reEnterFullscreen}
              style={{
                background: '#1b4fa0',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 24px',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
                boxShadow: '0 6px 20px rgba(27,79,160,0.35)',
              }}
            >
              Resume Fullscreen Exam →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
