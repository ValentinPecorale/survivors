# Survivors

A design studio website, with [Basement](https://basement.studio/) and [Joyco](https://joyco.studio/) as quality references.

**Current build: the hero section only** — an ASCII forest, an animated chrome tiger, cursor camera orbit and live visual controls.

Read [PROJECT.md](PROJECT.md) for the brief, current behavior, assets, saved defaults and handoff context. Read [AGENTS.md](AGENTS.md) for implementation rules.

## Development

```sh
npm install
npm run dev
```

Open http://localhost:3000.

```sh
npm run lint
npm run build
```

Built with Next.js, TypeScript, Tailwind, React Three Fiber/drei, Three.js WebGPU and Shader Lab ASCII postprocessing. Browsers without WebGPU receive a static scene preview.

**Save as default** saves settings in the current browser. Publishing those settings for all visitors requires updating the source configuration.
