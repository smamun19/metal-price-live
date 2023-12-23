import { useState, useEffect, useRef } from 'react';

const minReconnectDelay = 1000;
const maxReconnectDelay = 300000;
const authRetry = 5;
const errorReason = 'Unauthorized';

interface ApiData {
  timestamp: number;
  previousClosePrice: number;
  openingPrice: number;
  lowPrice: number;
  highPrice: number;
  openTime: number;
  currentPrice: number;
  priceChange: number;
  priceChangePercentage: number;
  askPrice: number;
  bidPrice: number;
  priceGram24k: number;
  priceGram22k: number;
  priceGram21k: number;
  key: string;
}

interface Connected {
  status: 'connected';
  data: ApiData;
  error?: undefined;
}

interface Connecting {
  status: 'connecting';
  data?: ApiData;
  error?: string;
}
interface Error {
  status: 'error';
  data?: ApiData;
  error: string;
}

type ConnectionState = Connected | Error | Connecting;
const useMetalPriceLive = (socketUrl: string, apiKey: string) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'connecting',
  });
  const [retry, setRetry] = useState(0);
  const maxAuthRetryRef = useRef(0);
  const currentReconnectDelayRef = useRef(minReconnectDelay);

  const ws = useRef<WebSocket | null>(null);

  const handleWsOpen = () => {
    setConnectionState({
      status: 'connecting',
    });
    currentReconnectDelayRef.current = minReconnectDelay;
  };

  const handleWsMessage = (e: WebSocketMessageEvent) => {
    setConnectionState({ status: 'connected', data: JSON.parse(e.data) });
  };
  const handleWsError = (e: WebSocketErrorEvent) => {
    setConnectionState({
      status: 'error',
      error: e.message || `WebSocket closed unexpectedly`,
    });
  };

  const handleWsClose = (e: WebSocketCloseEvent) => {
    setConnectionState({
      status: 'error',
      error: e?.reason || `WebSocket closed unexpectedly`,
    });

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

  return connectionState;
};

export default useMetalPriceLive;
