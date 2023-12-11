import { useState, useEffect, useRef, useCallback } from 'react';
const useMetalPriceLive = (socketUrl: string) => {
  const [data, setData] = useState();
  const [error, setError] = useState<string | undefined>(undefined);

  const ws = useRef<WebSocket | null>(null);

  const handleWsOpen = () => {
    setError(undefined);
  };

  const handleWsMessage = (e: WebSocketMessageEvent) => {
    setData(e.data);
  };
  const handleWsError = (e: WebSocketErrorEvent) => {
    setError(e.message);
  };

  const handleWsClose = useCallback(
    (e: WebSocketCloseEvent) => {
      console.log('WebSocket closed unexpectedly');
      console.debug(e);
      setError(e?.message ?? 'WebSocket closed unexpectedly');

      // Retry logic
      if (ws.current && ws.current.readyState !== WebSocket.OPEN) {
        ws.current = new WebSocket(socketUrl);
      }
    },
    [socketUrl]
  );

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
  }, [handleWsClose, socketUrl]);

  return { data, error };
};

export default useMetalPriceLive;
