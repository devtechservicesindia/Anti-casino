// games/index.js – PixiJS 8 game canvas wrappers
// This directory holds React wrappers around PixiJS Application instances.
//
// Planned modules:
//   SlotsGame.jsx   – Slots machine rendered via PixiJS 8
//   RouletteGame.jsx – Roulette wheel rendered via PixiJS 8
//
// Each game module should:
//   1. Create a PIXI.Application and mount it to a canvas ref
//   2. Expose start / stop / spin methods via useImperativeHandle
//   3. Emit game events to the store (zustand) for bet resolution
//
// export { default as SlotsGame }    from './SlotsGame/SlotsGame';
// export { default as RouletteGame } from './RouletteGame/RouletteGame';
