# World Cup Vizi

Generative art visualization from football match data.

## Stack

- Next.js (App Router)
- TypeScript
- p5.js
- Tailwind CSS

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then click **Load Match** to render the Mexico vs South Korea sketch.

## Architecture

- `src/lib/mockMatch.ts` — mock match data and TypeScript types
- `src/components/MatchVisualizer.tsx` — p5.js generative sketch
- `src/components/StatsPanel.tsx` — sidebar with raw statistics
