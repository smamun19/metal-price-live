import { useState, useEffect, useRef } from 'react';
const useMetalPriceLive = (socketUrl: string) => {
  const [data, setData] = useState();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);

  const minReconnectDelay = 1000;
  const maxReconnectDelay = 300000;

  let currentReconnectDelay = useRef(minReconnectDelay);

  const ws = useRef<WebSocket | null>(null);

  const handleWsOpen = () => {
    setError(undefined);
    currentReconnectDelay.current = minReconnectDelay;
  };

  const handleWsMessage = (e: WebSocketMessageEvent) => {
    setData(e.data);
  };
  const handleWsError = (e: WebSocketErrorEvent) => {
    setError(e.message);
  };

  const handleWsClose = (e: WebSocketCloseEvent) => {
    setError(
      e?.message ??
        `WebSocket closed unexpectedly ${currentReconnectDelay.current}`
    );

    // Retry logic
    if (ws.current && ws.current.readyState !== WebSocket.OPEN) {
      setTimeout(() => {
        //This state is triggering the useEffect for retry logic
        setRetry((prev) => prev + 1);

        currentReconnectDelay.current = Math.min(
          currentReconnectDelay.current * 2,
          maxReconnectDelay
        );
      }, currentReconnectDelay.current);
    }
  };

  useEffect(() => {
    ws.current = new WebSocket(socketUrl);
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
  }, [socketUrl, retry]);

  return { data, error };
};

export default useMetalPriceLive;
