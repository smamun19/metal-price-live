import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

const DEFAULT_HEADER_NAME = 'x-api-key';

export interface MetalQuote {
  symbol: string;
  name: string;
  bid: number;
  ask: number;
  high: number;
  low: number;
  tickTimestamp: string;
  timestamp: number;
}

export type ApiData = {
  timestamp: string;
  stale: boolean;
  XAUUSD: MetalQuote;
  XAGUSD: MetalQuote;
} & Record<string, MetalQuote | string | boolean>;

interface TickPayload {
  event: string;
  data: ApiData;
}

export interface UseMetalPriceLiveOptions {
  path: string;
  event: string;
  headerName?: string;
  transports?: ('websocket' | 'polling' | 'webtransport')[];
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  timeout?: number;
}

export type ConnectionState =
  | { status: 'connecting'; data?: ApiData; error?: undefined }
  | { status: 'connected'; data: ApiData; error?: undefined }
  | { status: 'error'; data?: ApiData; error: string };

export type UseMetalPriceLiveResult = ConnectionState & {
  /**
   * Force a fresh connection: tears down the current socket and reconnects
   * from a clean `connecting` state. Use this to recover from a terminal
   * `error` (`io server disconnect` / `reconnect_failed`), which Socket.IO
   * does not auto-recover from. Stable across renders.
   */
  reconnect: () => void;
};

// Socket.IO's `connect_error` always hands us an `Error`, but a server can
// emit a generic `error` event carrying anything (string, plain object, …),
// so normalize defensively rather than assuming `.message` exists.
const toErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message || 'Socket connection error';
  if (typeof err === 'string') return err || 'Socket connection error';
  if (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message || 'Socket connection error';
  }
  return 'Socket connection error';
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const isTransportList = (
  value: unknown
): value is UseMetalPriceLiveOptions['transports'] => {
  return (
    Array.isArray(value) &&
    value.every(
      (transport) =>
        transport === 'websocket' ||
        transport === 'polling' ||
        transport === 'webtransport'
    )
  );
};

const getFiniteNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

const isMetalQuote = (value: unknown): value is MetalQuote => {
  if (!value || typeof value !== 'object') return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q.symbol === 'string' &&
    typeof q.name === 'string' &&
    Number.isFinite(q.bid) &&
    Number.isFinite(q.ask) &&
    Number.isFinite(q.high) &&
    Number.isFinite(q.low) &&
    typeof q.tickTimestamp === 'string' &&
    Number.isFinite(q.timestamp)
  );
};

const isApiData = (value: unknown): value is ApiData => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.timestamp === 'string' &&
    typeof v.stale === 'boolean' &&
    isMetalQuote(v.XAUUSD) &&
    isMetalQuote(v.XAGUSD)
  );
};

const useMetalPriceLive = (
  apiKey: string,
  url: string,
  options: UseMetalPriceLiveOptions
): UseMetalPriceLiveResult => {
  const runtimeOptions =
    options && typeof options === 'object'
      ? (options as Partial<UseMetalPriceLiveOptions>)
      : undefined;
  const path = runtimeOptions?.path;
  const event = runtimeOptions?.event;
  const rawTransports = runtimeOptions?.transports;
  const headerName = isNonEmptyString(runtimeOptions?.headerName)
    ? runtimeOptions.headerName
    : DEFAULT_HEADER_NAME;
  const transports = isTransportList(rawTransports) ? rawTransports : undefined;
  const transportsKey = transports ? transports.join(',') : '';
  const reconnectionAttempts = getFiniteNumber(
    runtimeOptions?.reconnectionAttempts
  );
  const reconnectionDelay = getFiniteNumber(runtimeOptions?.reconnectionDelay);
  const reconnectionDelayMax = getFiniteNumber(
    runtimeOptions?.reconnectionDelayMax
  );
  const timeout = getFiniteNumber(runtimeOptions?.timeout);

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'connecting',
  });
  const lastDataRef = useRef<ApiData | undefined>(undefined);

  // Bumping this re-runs the effect, tearing down and recreating the socket.
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const reconnect = useCallback(() => {
    setReconnectNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!isNonEmptyString(apiKey)) {
      lastDataRef.current = undefined;
      setConnectionState({ status: 'error', error: 'apiKey is required' });
      return;
    }
    if (!isNonEmptyString(url)) {
      lastDataRef.current = undefined;
      setConnectionState({ status: 'error', error: 'url is required' });
      return;
    }
    if (!isNonEmptyString(path)) {
      lastDataRef.current = undefined;
      setConnectionState({
        status: 'error',
        error: 'options.path is required',
      });
      return;
    }
    if (!isNonEmptyString(event)) {
      lastDataRef.current = undefined;
      setConnectionState({
        status: 'error',
        error: 'options.event is required',
      });
      return;
    }
    if (
      transports !== undefined &&
      transports.length === 1 &&
      transports[0] === 'websocket' &&
      'document' in globalThis
    ) {
      console.warn(
        '[metal-price-live] transports: ["websocket"] in a browser will ' +
          'silently drop the API key header — the connection will fail ' +
          'authentication. Remove the transports override or add "polling" ' +
          'as the first transport.'
      );
    }
    lastDataRef.current = undefined;
    setConnectionState({ status: 'connecting' });

    const socket: Socket = io(url, {
      path,
      reconnection: true,
      extraHeaders: { [headerName]: apiKey },
      ...(transports ? { transports } : {}),
      ...(reconnectionAttempts !== undefined ? { reconnectionAttempts } : {}),
      ...(reconnectionDelay !== undefined ? { reconnectionDelay } : {}),
      ...(reconnectionDelayMax !== undefined ? { reconnectionDelayMax } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
    });

    const handleConnect = () => {
      const cached = lastDataRef.current;
      // Clear any stale `error` from a failed attempt: once the transport
      // (re)connects we're `connected` if we have a cached snapshot to show,
      // otherwise back to `connecting` while we await the first tick.
      setConnectionState(
        cached
          ? { status: 'connected', data: cached }
          : { status: 'connecting' }
      );
    };

    const handleError = (err: unknown) => {
      setConnectionState({
        status: 'error',
        error: toErrorMessage(err),
        data: lastDataRef.current,
      });
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      // 'io server disconnect' means the server forcibly closed the socket;
      // Socket.IO will NOT auto-reconnect in that case, so surface a terminal
      // error instead of parking in 'connecting' forever.
      if (reason === 'io server disconnect') {
        setConnectionState({
          status: 'error',
          error: reason,
          data: lastDataRef.current,
        });
        return;
      }
      setConnectionState({
        status: 'connecting',
        data: lastDataRef.current,
      });
    };

    const handleReconnectFailed = () => {
      setConnectionState({
        status: 'error',
        error: 'reconnect_failed',
        data: lastDataRef.current,
      });
    };

    const handleTick = (payload: TickPayload | ApiData | undefined) => {
      const candidate: unknown =
        payload && typeof payload === 'object' && 'data' in payload
          ? (payload as TickPayload).data
          : payload;
      if (!isApiData(candidate)) return;
      lastDataRef.current = candidate;
      setConnectionState({ status: 'connected', data: candidate });
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleError);
    socket.on('error', handleError);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_failed', handleReconnectFailed);
    socket.on(event, handleTick);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleError);
      socket.off('error', handleError);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_failed', handleReconnectFailed);
      socket.off(event, handleTick);
      socket.disconnect();
    };
    // `transports` is intentionally excluded; `transportsKey` is the
    // value-derived key, so callers passing an inline array don't thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiKey,
    url,
    path,
    event,
    headerName,
    transportsKey,
    reconnectionAttempts,
    reconnectionDelay,
    reconnectionDelayMax,
    timeout,
    reconnectNonce,
  ]);

  return useMemo<UseMetalPriceLiveResult>(
    () => Object.assign({ reconnect }, connectionState),
    [connectionState, reconnect]
  );
};

export default useMetalPriceLive;
