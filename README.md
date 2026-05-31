# metal-price-live

Live metal prices for React and React Native via Socket.IO.

## Installation

Using npm:

```
npm install metal-price-live
```

Using yarn:

```
yarn add metal-price-live
```

> `socket.io-client` is bundled as a package dependency, so you do not need to
> install it separately.

> `1.0.0` marks the Socket.IO-based hook contract shown below as the stable
> public API for the package.

## Usage

```tsx
import useMetalPriceLive from 'metal-price-live';

// apiKey, url, and options (with path + event) are required.
const { status, data, error } = useMetalPriceLive(
  'your-api-key',
  'https://your-pricefeed.example.com',
  {
    path: '/api/v1/your-service/socket.io',
    event: 'your:event-name',
  }
);

if (status === 'connected') {
  const gold = data.XAUUSD; // { bid, ask, high, low, ... }
  const silver = data.XAGUSD;
}
```

If any required input (`apiKey`, `url`, `options.path`, or `options.event`) is
missing or blank, the hook returns `{ status: 'error', error: '<field> is
required' }` and does not open a socket.

> **Migrating from 0.3.x / 0.4.x?** The stable **1.0.0** API uses a new hook
> signature. The old hook took `useMetalPriceLive(socketUrl, apiKey)` (raw
> WebSocket). It now takes `useMetalPriceLive(apiKey, url, options)` over
> Socket.IO — note the **first two arguments are reordered** (`apiKey` is now
> first) and the `options` object with a required `path` and `event` is new. A
> straight upgrade without changing your call site no longer crashes during
> render, but it will settle into `status: 'error'` until you swap the argument
> order and provide the required `options` object.

### Optional knobs

```tsx
const state = useMetalPriceLive(
  'your-api-key',
  'https://your-pricefeed.example.com',
  {
    path: '/api/v1/your-service/socket.io', // required
    event: 'your:event-name', // required
    headerName: 'x-api-key', // default: 'x-api-key'
    // transports: ['polling', 'websocket'], // optional override

    // Reconnection knobs (forwarded to socket.io-client). All optional.
    reconnectionAttempts: 10, // default: Infinity
    reconnectionDelay: 1000, // ms, default: 1000
    reconnectionDelayMax: 5000, // ms, default: 5000
    timeout: 20000, // ms, per-attempt handshake timeout
  }
);
```

### Options

| Option                 | Type                                             | Default                                                         | Purpose                                                                                 |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `path`                 | `string`                                         | — (required)                                                    | Socket.IO mount path on the server.                                                     |
| `event`                | `string`                                         | — (required)                                                    | Event name carrying price snapshots.                                                    |
| `headerName`           | `string`                                         | `x-api-key`                                                     | HTTP header name the API key is sent under (polling handshake only — see browser note). |
| `transports`           | `('websocket' \| 'polling' \| 'webtransport')[]` | `undefined` (Socket.IO default: polling → upgrade to websocket) | Transport order.                                                                        |
| `reconnectionAttempts` | `number`                                         | `Infinity`                                                      | Max reconnect attempts before emitting `reconnect_failed`.                              |
| `reconnectionDelay`    | `number` (ms)                                    | `1000`                                                          | Initial backoff.                                                                        |
| `reconnectionDelayMax` | `number` (ms)                                    | `5000`                                                          | Backoff cap.                                                                            |
| `timeout`              | `number` (ms)                                    | `20000`                                                         | Per-attempt handshake timeout.                                                          |

### Connection state

The hook returns the current connection state (a discriminated union) plus a
stable `reconnect()` method:

```ts
type ConnectionState =
  | { status: 'connecting'; data?: ApiData }
  | { status: 'connected'; data: ApiData }
  | { status: 'error'; data?: ApiData; error: string };

// Returned value: ConnectionState & { reconnect: () => void }
```

State transitions:

- **`'connecting'`** — initial state, and the state during a network drop while
  Socket.IO retries in the background. The last `data` snapshot stays available.
- **`'connected'`** — set when the first valid tick event arrives, and re-set
  on `'connect'` if a cached snapshot is available (so reconnects don't blank
  the UI while waiting for the next tick).
- **`'error'`** — set on `connect_error` with the underlying message; on
  `reconnect_failed` (terminal — only fires if you set a finite
  `reconnectionAttempts`) with `error: 'reconnect_failed'`; and on an
  `'io server disconnect'` (the server forcibly closed the socket, which
  Socket.IO does **not** auto-reconnect from) with `error: 'io server
disconnect'`. A server-emitted application `error` event surfaces the same
  way — its payload is normalized to a string (Socket.IO sends an `Error` here,
  but a custom server may send anything), falling back to
  `'Socket connection error'`; a subsequent valid tick clears it back to
  `'connected'`. The last `data` snapshot is preserved in all cases.

> The two terminal errors — `'io server disconnect'` and `'reconnect_failed'` —
> are not retried by Socket.IO. Call `reconnect()` (below) to recover.

### Manual reconnect

The returned `reconnect()` tears down the current socket and starts a fresh
connection from `'connecting'`. It's the way to recover from the terminal
`error` states (`'io server disconnect'` / `'reconnect_failed'`), which
Socket.IO does not retry on its own:

```tsx
const { status, error, reconnect } = useMetalPriceLive(apiKey, url, options);

if (status === 'error') {
  return <Button title={`Retry (${error})`} onPress={reconnect} />;
}
```

`reconnect()` is stable across renders (safe to pass as a prop or use in a
dependency array) and also works mid-connection if you ever need to force a
clean reconnect.

### Payload shape

```ts
interface MetalQuote {
  symbol: string;
  name: string;
  bid: number;
  ask: number;
  high: number;
  low: number;
  tickTimestamp: string;
  timestamp: number;
}

interface ApiData {
  timestamp: string;
  stale: boolean;
  XAUUSD: MetalQuote;
  XAGUSD: MetalQuote;
  [symbol: string]: MetalQuote | string | boolean;
}
```

The hook accepts both wrapped (`{ event, data: ApiData }`) and unwrapped
(`ApiData`) tick payloads, and silently ignores anything that fails validation.
A payload is accepted only when `timestamp` is a string, `stale` is a boolean,
and both `XAUUSD` and `XAGUSD` are full quote objects (every `MetalQuote` field
present and correctly typed). This guarantees `data.XAUUSD.bid` etc. are real
numbers once `status === 'connected'`.

## Browser compatibility note

The API key is sent in the `x-api-key` HTTP header via Socket.IO's
`extraHeaders` option. This works as expected in:

- Node.js
- React Native (RN's WebSocket / XHR honor custom headers)
- Browsers — but only on the **polling** transport during the Socket.IO
  handshake (which is the default — Socket.IO starts with polling and then
  upgrades to WebSocket)

The browser's native WebSocket API does **not** allow custom headers. If you
force a WebSocket-only transport in a browser (`transports: ['websocket']`),
the `x-api-key` header will not be transmitted and the connection will fail
authentication. Either leave `transports` unset (recommended) or have the
server also accept the API key via `auth` / query string for browser-only
WebSocket usage.

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
