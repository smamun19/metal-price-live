# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Starting with
1.0.0, the public API is considered stable and incompatible changes will bump
the major version.

## [1.0.0]

This release promotes the current Socket.IO-based hook API to the stable 1.x
baseline for the package.

### Breaking

- **Transport changed from raw `WebSocket` to Socket.IO.** `socket.io-client`
  (`^4.7.5`) is now bundled as a package dependency.
- **Hook signature changed** from `useMetalPriceLive(socketUrl, apiKey)` to
  `useMetalPriceLive(apiKey, url, options)`. The first two arguments are
  reordered (`apiKey` is now first) and a third `options` argument with a
  required `path` and `event` is now mandatory. See the "Migrating" note in the
  README.
- **`ApiData` payload shape changed** to a Socket.IO tick snapshot
  (`{ timestamp, stale, XAUUSD, XAGUSD }` with `MetalQuote` values). The previous
  flat gold/silver fields (`currentPrice`, `priceGram24k`, `silver: {...}`, etc.)
  are gone.

### Added

- Configurable reconnection knobs forwarded to Socket.IO: `reconnectionAttempts`,
  `reconnectionDelay`, `reconnectionDelayMax`, `timeout`.
- Configurable `headerName` (default `x-api-key`) and `transports` override.
- `reconnect()` method on the returned value to force a fresh connection and
  recover from terminal errors (`io server disconnect` / `reconnect_failed`),
  which Socket.IO does not retry on its own. Stable across renders.
- Last-known `data` snapshot is preserved across `connecting` / `error`
  transitions so the UI doesn't blank during reconnects.
- Full Jest test suite covering connect / tick / error / disconnect / reconnect /
  validation / cleanup paths.

### Changed

- Tick payloads are now validated against the full `MetalQuote` shape before the
  hook reports `connected`; malformed payloads are silently ignored. Numeric
  fields must be finite — `NaN` / `Infinity` are rejected (previously a bare
  `typeof === 'number'` check let them through).
- A successful (re)connect with no cached snapshot now clears any prior `error`
  back to `connecting`, instead of leaving a stale error reported until the next
  tick arrives.
- Generic server-emitted `error` event payloads are normalized to a string
  message (no longer assumes an `Error` with a `.message` field).
- An `'io server disconnect'` (which Socket.IO does not auto-reconnect from) now
  surfaces a terminal `error` state instead of parking in `connecting`.
- Removed stray `console.log` debugging from the connection lifecycle.

[1.0.0]: https://github.com/smamun19/metal-price-live/releases/tag/v1.0.0
