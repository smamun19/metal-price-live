import * as React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import useMetalPriceLive from '../index';

type HookResult = ReturnType<typeof useMetalPriceLive>;

type Handler = (...args: any[]) => void;

interface FakeManager {
  on: jest.Mock<FakeManager, [string, Handler]>;
  off: jest.Mock<FakeManager, [string, Handler?]>;
  __emit: (event: string, ...args: unknown[]) => void;
  __handlers: Record<string, Handler[]>;
}

interface FakeSocket {
  on: jest.Mock<FakeSocket, [string, Handler]>;
  off: jest.Mock<FakeSocket, [string, Handler?]>;
  disconnect: jest.Mock<FakeSocket, []>;
  removeAllListeners: jest.Mock<FakeSocket, []>;
  io: FakeManager;
  __emit: (event: string, ...args: unknown[]) => void;
  __handlers: Record<string, Handler[]>;
  __ioArgs: { url: unknown; options: unknown };
}

const createFakeManager = (): FakeManager => {
  const handlers: Record<string, Handler[]> = {};
  const mgr: FakeManager = {
    __handlers: handlers,
    on: jest.fn((event: string, handler: Handler) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event]!.push(handler);
      return mgr;
    }),
    off: jest.fn((event: string, handler?: Handler) => {
      if (!handlers[event]) return mgr;
      if (handler) {
        handlers[event] = handlers[event]!.filter((h) => h !== handler);
      } else {
        handlers[event] = [];
      }
      return mgr;
    }),
    __emit: (event: string, ...args: unknown[]) => {
      (handlers[event] ?? []).forEach((h) => h(...args));
    },
  };
  return mgr;
};

const createFakeSocket = (url: unknown, options: unknown): FakeSocket => {
  const handlers: Record<string, Handler[]> = {};
  const socket: FakeSocket = {
    __handlers: handlers,
    __ioArgs: { url, options },
    io: createFakeManager(),
    on: jest.fn((event: string, handler: Handler) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event]!.push(handler);
      return socket;
    }),
    off: jest.fn((event: string, handler?: Handler) => {
      if (!handlers[event]) return socket;
      if (handler) {
        handlers[event] = handlers[event]!.filter((h) => h !== handler);
      } else {
        handlers[event] = [];
      }
      return socket;
    }),
    disconnect: jest.fn(() => socket),
    removeAllListeners: jest.fn(() => {
      for (const key of Object.keys(handlers)) delete handlers[key];
      return socket;
    }),
    __emit: (event: string, ...args: unknown[]) => {
      (handlers[event] ?? []).forEach((h) => h(...args));
    },
  };
  return socket;
};

const sockets: FakeSocket[] = [];

jest.mock('socket.io-client', () => ({
  io: jest.fn((url: unknown, options: unknown) => {
    const s = createFakeSocket(url, options);
    sockets.push(s);
    return s;
  }),
}));

const TEST_URL = 'https://example.test';

const REQUIRED_OPTS = {
  path: '/api/v1/your-service/socket.io',
  event: 'your:event-name',
} as const;

const samplePayload = {
  event: 'tick',
  data: {
    timestamp: '2026-05-27T07:08:11.000Z',
    stale: false,
    XAUUSD: {
      symbol: 'XAUUSD',
      name: 'Gold',
      bid: 4486.91,
      ask: 4487.05,
      high: 4528.3,
      low: 4480.19,
      tickTimestamp: '2026-05-27T07:08:11.000Z',
      timestamp: 1779865691,
    },
    XAGUSD: {
      symbol: 'XAGUSD',
      name: 'Silver',
      bid: 75.181,
      ask: 75.22,
      high: 77.563,
      low: 74.713,
      tickTimestamp: '2026-05-27T07:08:11.000Z',
      timestamp: 1779865691,
    },
  },
};

const lastSocket = (): FakeSocket => {
  const s = sockets[sockets.length - 1];
  if (!s) throw new Error('no fake socket created yet');
  return s;
};

type HookProps = {
  apiKey: string;
  url: string;
  options: Parameters<typeof useMetalPriceLive>[2];
};

const Probe = ({
  apiKey,
  url,
  options,
  onState,
}: HookProps & { onState: (s: HookResult) => void }) => {
  const state = useMetalPriceLive(apiKey, url, options);
  onState(state);
  return null;
};

const renderHook = (props: HookProps) => {
  let latest: HookResult = { status: 'connecting', reconnect: () => {} };
  const onState = (s: HookResult) => {
    latest = s;
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Probe {...props} onState={onState} />);
  });
  return {
    getState: () => latest,
    update: (next: HookProps) => {
      act(() => {
        renderer.update(<Probe {...next} onState={onState} />);
      });
    },
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
  };
};

beforeEach(() => {
  sockets.length = 0;
  jest.clearAllMocks();
});

describe('useMetalPriceLive', () => {
  it('returns an error when apiKey is missing and does not create a socket', () => {
    const { getState } = renderHook({
      apiKey: '',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });

    const s = getState();
    expect(s.status).toBe('error');
    if (s.status !== 'error') throw new Error('not error');
    expect(s.error).toBe('apiKey is required');

    const { io } = require('socket.io-client');
    expect(io).not.toHaveBeenCalled();
  });

  it('returns an error when options are missing and does not create a socket', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: undefined as unknown as HookProps['options'],
    });

    const s = getState();
    expect(s.status).toBe('error');
    if (s.status !== 'error') throw new Error('not error');
    expect(s.error).toBe('options.path is required');

    const { io } = require('socket.io-client');
    expect(io).not.toHaveBeenCalled();
  });

  it('returns an error when path is blank and does not create a socket', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS, path: '   ' },
    });

    const s = getState();
    expect(s.status).toBe('error');
    if (s.status !== 'error') throw new Error('not error');
    expect(s.error).toBe('options.path is required');

    const { io } = require('socket.io-client');
    expect(io).not.toHaveBeenCalled();
  });

  it('returns an error when event is blank and does not create a socket', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS, event: '   ' },
    });

    const s = getState();
    expect(s.status).toBe('error');
    if (s.status !== 'error') throw new Error('not error');
    expect(s.error).toBe('options.event is required');

    const { io } = require('socket.io-client');
    expect(io).not.toHaveBeenCalled();
  });

  it('returns an error when url is missing and does not create a socket', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: '   ',
      options: { ...REQUIRED_OPTS },
    });

    const s = getState();
    expect(s.status).toBe('error');
    if (s.status !== 'error') throw new Error('not error');
    expect(s.error).toBe('url is required');

    const { io } = require('socket.io-client');
    expect(io).not.toHaveBeenCalled();
  });

  it('starts in connecting state and passes header + path to socket.io', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    expect(getState().status).toBe('connecting');
    expect(typeof getState().reconnect).toBe('function');

    const { io } = require('socket.io-client');
    expect(io).toHaveBeenCalledTimes(1);
    const [url, options] = (io as jest.Mock).mock.calls[0];
    expect(url).toBe(TEST_URL);
    expect(options).toMatchObject({
      path: '/api/v1/your-service/socket.io',
      reconnection: true,
      extraHeaders: { 'x-api-key': 'KEY' },
    });
  });

  it('flips to connected with unwrapped data on the configured tick event', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit(REQUIRED_OPTS.event, samplePayload);
    });
    const s = getState();
    expect(s.status).toBe('connected');
    if (s.status !== 'connected') throw new Error('not connected');
    expect(s.data.XAUUSD.bid).toBe(4486.91);
    expect(s.data.XAGUSD.bid).toBe(75.181);
    expect(s.data.stale).toBe(false);
  });

  it('accepts a raw ApiData payload (no event/data wrapper)', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit(REQUIRED_OPTS.event, samplePayload.data);
    });
    const s = getState();
    expect(s.status).toBe('connected');
    if (s.status !== 'connected') throw new Error('not connected');
    expect(s.data.XAUUSD.bid).toBe(4486.91);
  });

  it('reports error status on connect_error', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit('connect_error', new Error('boom'));
    });
    const s = getState();
    expect(s.status).toBe('error');
    if (s.status !== 'error') throw new Error('not error');
    expect(s.error).toBe('boom');
  });

  it('reports error status on the generic `error` event too', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit('error', new Error('socket-error'));
    });
    const s = getState();
    expect(s.status).toBe('error');
    if (s.status !== 'error') throw new Error('not error');
    expect(s.error).toBe('socket-error');
  });

  it('flips back to connecting on disconnect and keeps last data', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit(REQUIRED_OPTS.event, samplePayload);
    });
    act(() => {
      lastSocket().__emit('disconnect', 'transport close');
    });
    const s = getState();
    expect(s.status).toBe('connecting');
    expect(s.data?.XAUUSD.bid).toBe(4486.91);
  });

  it('reports a terminal error on `io server disconnect` (no auto-reconnect)', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit(REQUIRED_OPTS.event, samplePayload);
    });
    act(() => {
      lastSocket().__emit('disconnect', 'io server disconnect');
    });
    const s = getState();
    expect(s.status).toBe('error');
    if (s.status !== 'error') throw new Error('not error');
    expect(s.error).toBe('io server disconnect');
    expect(s.data?.XAUUSD.bid).toBe(4486.91);
  });

  it('restores connected on reconnect using cached data', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit(REQUIRED_OPTS.event, samplePayload);
    });
    act(() => {
      lastSocket().__emit('disconnect', 'transport close');
    });
    act(() => {
      lastSocket().__emit('connect');
    });
    const s = getState();
    expect(s.status).toBe('connected');
    if (s.status !== 'connected') throw new Error('not connected');
    expect(s.data.XAUUSD.bid).toBe(4486.91);
  });

  it('stays connecting on initial `connect` when no data has arrived yet', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit('connect');
    });
    expect(getState().status).toBe('connecting');
  });

  it('emits terminal error on reconnect_failed from the manager', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS, reconnectionAttempts: 3 },
    });
    act(() => {
      lastSocket().io.__emit('reconnect_failed');
    });
    const s = getState();
    expect(s.status).toBe('error');
    if (s.status !== 'error') throw new Error('not error');
    expect(s.error).toBe('reconnect_failed');
  });

  it('ignores tick payloads that fail validation', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit(REQUIRED_OPTS.event, { foo: 'bar' });
    });
    expect(getState().status).toBe('connecting');

    act(() => {
      lastSocket().__emit(REQUIRED_OPTS.event, null);
    });
    expect(getState().status).toBe('connecting');
  });

  it('forwards reconnection knobs to socket.io', () => {
    renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: {
        ...REQUIRED_OPTS,
        reconnectionAttempts: 5,
        reconnectionDelay: 250,
        reconnectionDelayMax: 4000,
        timeout: 8000,
      },
    });
    const { io } = require('socket.io-client');
    const [, options] = (io as jest.Mock).mock.calls[0];
    expect(options).toMatchObject({
      reconnectionAttempts: 5,
      reconnectionDelay: 250,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    });
  });

  it('disconnects the socket and removes listeners on unmount', () => {
    const { unmount } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    const socket = lastSocket();
    unmount();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.__handlers[REQUIRED_OPTS.event] ?? []).toHaveLength(0);
    expect(socket.__handlers.connect ?? []).toHaveLength(0);
    expect(socket.__handlers.connect_error ?? []).toHaveLength(0);
    expect(socket.__handlers.error ?? []).toHaveLength(0);
    expect(socket.__handlers.disconnect ?? []).toHaveLength(0);
    expect(socket.io.__handlers.reconnect_failed ?? []).toHaveLength(0);
  });

  it('listens to a custom event name when provided', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS, event: 'custom:tick' },
    });
    act(() => {
      lastSocket().__emit('custom:tick', samplePayload);
    });
    const s = getState();
    expect(s.status).toBe('connected');
    if (s.status !== 'connected') throw new Error('not connected');
    expect(s.data.XAUUSD.name).toBe('Gold');
  });

  it('does not recreate the socket when an inline transports array is passed across renders', () => {
    const { update } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS, transports: ['polling', 'websocket'] },
    });
    const { io } = require('socket.io-client');
    expect(io).toHaveBeenCalledTimes(1);

    update({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS, transports: ['polling', 'websocket'] },
    });
    expect(io).toHaveBeenCalledTimes(1);
  });

  it('clears a stale error once the transport (re)connects with no cached data', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit('connect_error', new Error('offline'));
    });
    expect(getState().status).toBe('error');

    // Transport (re)connects but no tick has arrived yet: we must drop back to
    // 'connecting' rather than stay stuck reporting the now-stale error.
    act(() => {
      lastSocket().__emit('connect');
    });
    expect(getState().status).toBe('connecting');
  });

  it('rejects a tick whose quote is missing a field or has a non-finite number', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });

    // XAUUSD missing `ask`
    const goldNoAsk = {
      ...samplePayload.data.XAUUSD,
    } as Partial<typeof samplePayload.data.XAUUSD>;
    delete goldNoAsk.ask;
    act(() => {
      lastSocket().__emit(REQUIRED_OPTS.event, {
        ...samplePayload.data,
        XAUUSD: goldNoAsk,
      });
    });
    expect(getState().status).toBe('connecting');

    // XAGUSD bid is NaN (typeof NaN === 'number', so the old guard let it through)
    act(() => {
      lastSocket().__emit(REQUIRED_OPTS.event, {
        ...samplePayload.data,
        XAGUSD: { ...samplePayload.data.XAGUSD, bid: NaN },
      });
    });
    expect(getState().status).toBe('connecting');
  });

  it('normalizes a non-Error payload from the generic `error` event', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit('error', 'plain string error');
    });
    const s = getState();
    expect(s.status).toBe('error');
    if (s.status !== 'error') throw new Error('not error');
    expect(s.error).toBe('plain string error');
  });

  it('reconnect() tears down the old socket and starts a fresh connection', () => {
    const { getState } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    act(() => {
      lastSocket().__emit(REQUIRED_OPTS.event, samplePayload);
    });
    act(() => {
      lastSocket().__emit('disconnect', 'io server disconnect');
    });
    expect(getState().status).toBe('error');

    const oldSocket = lastSocket();
    const { io } = require('socket.io-client');
    expect(io).toHaveBeenCalledTimes(1);

    act(() => {
      getState().reconnect();
    });

    expect(oldSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledTimes(2);
    expect(sockets.length).toBe(2);
    expect(getState().status).toBe('connecting');
  });

  it('keeps a stable reconnect reference across renders', () => {
    const { getState, update } = renderHook({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    const first = getState().reconnect;
    update({
      apiKey: 'KEY',
      url: TEST_URL,
      options: { ...REQUIRED_OPTS },
    });
    expect(getState().reconnect).toBe(first);
  });
});
