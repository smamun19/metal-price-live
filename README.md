# metal-price-live

Live metal prices for react and react native using websocket

## Installation

Using npm:

```
npm install metal-price-live
```

Using yarn:

```
yarn add metal-price-live
```

## Usage

```tsx
import useMetalPriceLive from 'metal-price-live';

// ...

const { status, data, error } = useMetalPriceLive(
  'wss://your-websocket-endpoint',
  'your-api-key'
);
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
