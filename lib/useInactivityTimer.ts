import { useState, useEffect, useCallback, useRef } from 'react';

const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];

export const useInactivityTimer = (
  onTimeout: () => void,
  timeoutInMs = 120000, // 2 minutes
  promptInMs = 10000 // 10 seconds before timeout
) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [countdown, setCountdown] = useState(promptInMs / 1000);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimers = useCallback(() => {
    promptTimeoutRef.current = setTimeout(() => {
      setShowPrompt(true);
      startCountdown();
    }, timeoutInMs - promptInMs);

    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, timeoutInMs);
  }, [timeoutInMs, promptInMs, onTimeout]);

  const cleanup = useCallback(() => {
    if (promptTimeoutRef.current) clearTimeout(promptTimeoutRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);
  
  const resetTimer = useCallback(() => {
    cleanup();
    setShowPrompt(false);
    setCountdown(promptInMs / 1000);
    startTimers();
  }, [cleanup, startTimers, promptInMs]);

  const startCountdown = () => {
    setCountdown(promptInMs / 1000);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Event listener effect
  useEffect(() => {
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [resetTimer]);
  
  // Initial timer start
  useEffect(() => {
    resetTimer();
    return cleanup;
  }, [resetTimer, cleanup]);


  return { showPrompt, countdown, resetTimer };
};
