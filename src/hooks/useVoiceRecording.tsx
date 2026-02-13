import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    // First, explicitly request microphone permission via getUserMedia
    // This MUST be called directly from a user gesture (click handler)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      // Keep reference to stop tracks later
      streamRef.current = stream;
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        toast({
          title: 'Microphone access denied',
          description: 'Please allow microphone access in your browser/device settings',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Microphone not available',
          description: 'Could not access microphone. Please check your device settings.',
          variant: 'destructive',
        });
      }
      return;
    }

    // Now start speech recognition (mic permission already granted)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast({
        title: 'Speech recognition not supported',
        description: 'Please use a modern browser like Chrome or Safari',
        variant: 'destructive',
      });
      // Clean up the stream
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        setTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(prev => prev + finalTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        // Clean up mic stream
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        toast({
          title: 'Recording error',
          description: 'Please try again',
          variant: 'destructive',
        });
      };

      recognition.onend = () => {
        setIsRecording(false);
        // Clean up mic stream
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      toast({
        title: 'Failed to start recording',
        description: 'Please check your microphone permissions',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
    // Clean up mic stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const clearRecording = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    clearRecording,
  };
};
