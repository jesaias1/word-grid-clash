<p align="center"><img src="src/assets/lettus-logo.png" alt="Lettus" width="360"></p>
<p align="center"><b>A free grid word game. Build words across, down and backwards against an AI or friends on one screen.</b></p>

<p align="center">
  <a href="https://lettus.vercel.app"><b>Play Lettus</b></a>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-20232a?style=flat-square&logo=react&logoColor=61dafb">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646cff?style=flat-square&logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind_CSS-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-installable-7ed942?style=flat-square">
</p>

![Lettus solo game: two five-by-five grids, one for you and one for the AI, with a letter keyboard below](docs/readme/game.webp)

Lettus is a strategic word-building game. You and your opponent each build on a five-by-five grid: pick a letter, then try to make the highest-scoring words across, down and backwards. Play a solo game against the AI, take on friends on the same screen, play a friend online, or try the daily challenge.

<table>
<tr>
<td width="62%"><img src="docs/readme/home.webp" alt="Lettus home screen: Daily Challenge, Solo Game, Online 1v1, Local Multiplayer, Game History, Tutorial"></td>
<td width="38%"><img src="docs/readme/game-mobile.webp" alt="Lettus on a phone"></td>
</tr>
</table>

## Modes

- **Daily Challenge:** everyone gets the same board and the same letters each day; chase Bronze, Silver, Gold and Diamond.
- **Solo Game:** play an AI on Easy, Medium or Hard.
- **Online 1v1:** play another person online.
- **Local Multiplayer:** 2 to 4 players on one screen.
- **Game History** and a seven-step **Tutorial**.

## Progression

- XP and levels for every game, with bonuses for wins, streaks and your first game of the day.
- 21 achievements, from your first word to beating the Hard AI.
- Combo popups when one letter makes several words, with sound and haptics (mute from any screen).

## Built with

Vite, React, TypeScript, shadcn/ui and Tailwind CSS, shipped as an installable PWA and deployed on Vercel.

## Run it locally

```sh
git clone https://github.com/jesaias1/word-grid-clash.git
cd word-grid-clash
npm install
npm run dev
```
