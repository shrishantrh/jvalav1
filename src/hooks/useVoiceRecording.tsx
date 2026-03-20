import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * Voice recording hook that uses MediaRecorder for actual audio capture.
 * Falls back to Web Speech API for live transcription where available,
 * otherwise records audio blob for server-side transcription.
 * 
 * Works in: browsers, Capacitor WKWebView (audio recording only, 
 * transcription done server-side via edge function).
 */
export const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const monitorAudioLevel = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(avg / 128, 1)); // normalize 0-1
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.log('[Voice] AudioContext not available for levels:', e);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Start MediaRecorder for actual audio capture
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';
      
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
      };
      recorder.start(250); // collect in 250ms chunks
      mediaRecorderRef.current = recorder;

      // Start audio level monitoring for waveform
      monitorAudioLevel(stream);

      // Start duration timer
      setDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      // Try Web Speech API for live transcript (won't work in WKWebView)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';
          
          let finalText = '';
          recognition.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const t = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalText += t + ' ';
              } else {
                interim = t;
              }
            }
            setTranscript(finalText + interim);
          };
          recognition.onerror = (e: any) => {
            console.log('[Voice] Speech recognition error (non-fatal):', e.error);
            // Don't show error - recording continues via MediaRecorder
          };
          recognition.onend = () => {
            // Speech recognition ended but recording may continue
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.log('[Voice] Speech recognition not available, recording audio only');
        }
      }

      setIsRecording(true);
      setTranscript('');
      setAudioBlob(null);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        toast({
          title: 'Microphone access denied',
          description: 'Please allow microphone access in your device settings',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Microphone not available',
          description: 'Could not access microphone. Please check your device settings.',
          variant: 'destructive',
        });
      }
    }
  }, [toast, monitorAudioLevel]);

  const stopRecording = useCallback(() => {
    // Stop speech recognition
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;

    // Stop MediaRecorder
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Stop audio level monitoring
    cancelAnimationFrame(animFrameRef.current);
    analyserRef.current = null;
    setAudioLevel(0);

    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop mic stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    setIsRecording(false);
  }, []);

  const clearRecording = useCallback(() => {
    setTranscript('');
    setAudioBlob(null);
    setDuration(0);
    setAudioLevel(0);
  }, []);

  return {
    isRecording,
    transcript,
    audioLevel,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    clearRecording,
  };
};
