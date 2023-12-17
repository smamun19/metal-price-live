import { useState, useEffect, useRef } from 'react';

const minReconnectDelay = 1000;
const maxReconnectDelay = 300000;
const authRetry = 5;
const errorReason = 'Unauthorized';
const useMetalPriceLive = (socketUrl: string, apiKey: string) => {
  const [data, setData] = useState();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const maxAuthRetryRef = useRef(0);
  const currentReconnectDelayRef = useRef(minReconnectDelay);

  const ws = useRef<WebSocket | null>(null);

  const handleWsOpen = () => {
    setError(undefined);
    currentReconnectDelayRef.current = minReconnectDelay;
  };

  const handleWsMessage = (e: WebSocketMessageEvent) => {
    setData(e.data);
  };
  const handleWsError = (e: WebSocketErrorEvent) => {
    setError(e.message);
    console.log('error logic', e);
  };

  const handleWsClose = (e: WebSocketCloseEvent) => {
    setError(e?.reason ?? `WebSocket closed unexpectedly`);

    //retry logic on auth fail
    if (e?.reason === errorReason) {
      maxAuthRetryRef.current++;
    }
    if (authRetry < maxAuthRetryRef.current) {
      return;
    }

    // Retry logic
    if (ws.current && ws.current.readyState !== WebSocket.OPEN) {
      setTimeout(() => {
        //This state is triggering the useEffect for retry logic
        setRetry((prev) => prev + 1);

        currentReconnectDelayRef.current = Math.min(
          currentReconnectDelayRef.current * 2,
          maxReconnectDelay
        );
      }, currentReconnectDelayRef.current);
    }
  };

  useEffect(() => {
    ws.current = new WebSocket(`${socketUrl}/${apiKey}`);
    ws.current.addEventListener('open', handleWsOpen);
    ws.current.addEventListener('message', handleWsMessage);
    ws.current.addEventListener('error', handleWsError);
    ws.current.addEventListener('close', handleWsClose);

    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current.removeEventListener('open', handleWsOpen);
        ws.current.removeEventListener('message', handleWsMessage);
        ws.current.removeEventListener('error', handleWsError);
        ws.current.removeEventListener('close', handleWsClose);
      }
    };
  }, [socketUrl, retry, apiKey]);

  return { data, error };
};

export default useMetalPriceLive;
