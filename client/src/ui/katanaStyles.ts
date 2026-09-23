import { injectHudStyles } from './hudStyles.js';

/**
 * The katana game's own HUD pieces, on top of the shared HUD base.
 *
 * EVERY size and offset is a multiple of `--u` (one pixel of a 1920x1080
 * design, fitted to the viewport and clamped, defined in `hudStyles.ts`), with
 * a px floor via `max()` only where text must stay readable. There are no
 * per-device sizes: a phone and a monitor run the same layout at their own
 * scale, and the touch-mode rules only move things clear of the thumbs.
 *
 * NO BACKTICKS ANYWHERE IN THIS FILE: the stylesheet is a template literal.
 */
let injected = false;

export const injectKatanaStyles = (): void => {
  if (injected) return;
  injected = true;
  injectHudStyles();
  const style = document.createElement('style');
  style.textContent = `
:root {
  --ke-bar-w: min(80vw, calc(760 * var(--u)));
  --ke-bottom: max(8px, calc(18 * var(--u)), env(safe-area-inset-bottom, 0px));
}
.ke-outline {
  color: #fff;
  text-shadow:
    2px 0 0 #1c2233, -2px 0 0 #1c2233, 0 2px 0 #1c2233, 0 -2px 0 #1c2233,
    2px 2px 0 #1c2233, -2px 2px 0 #1c2233, 2px -2px 0 #1c2233, -2px -2px 0 #1c2233,
    0 4px 6px rgba(0, 0, 0, 0.35);
}

/* ---- Bottom centre: damage, speed, the level bar, auto click ---------- */
.ke-stats {
  position: fixed;
  left: 50%;
  bottom: var(--ke-bottom);
  transform: translateX(-50%);
  width: var(--ke-bar-w);
  z-index: 20;
  pointer-events: none;
  font-family: var(--gs-font);
  font-weight: 700;
  user-select: none;
}
.ke-stats__row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 calc(10 * var(--u));
  margin-bottom: calc(4 * var(--u));
}
.ke-stat { font-size: max(15px, calc(34 * var(--u))); line-height: 1; letter-spacing: 0.02em; }
.ke-stat--damage { color: #ff4d4d; }
.ke-stat--speed { color: #6dff7a; }
.ke-hp {
  position: relative;
  flex: 0 1 calc(300 * var(--u));
  min-width: 0;
  height: max(18px, calc(34 * var(--u)));
  margin: 0 calc(12 * var(--u));
  border: max(2px, calc(3 * var(--u))) solid #1c2233;
  border-radius: calc(8 * var(--u));
  background: #3a1016;
  overflow: hidden;
}
.ke-hp__fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 100%;
  background: linear-gradient(180deg, #ff6b6b, #d8232f);
  transition: width 140ms ease-out;
}
.ke-hp--low .ke-hp__fill { animation: ke-hp-low 0.7s ease-in-out infinite alternate; }
@keyframes ke-hp-low { from { filter: brightness(1); } to { filter: brightness(1.45); } }
.ke-hp__text {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: max(11px, calc(22 * var(--u)));
  white-space: nowrap;
}
.ke-hurt {
  position: fixed;
  inset: 0;
  z-index: 16;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(220, 20, 30, 0.55) 100%);
}
.ke-hurt--on { animation: ke-hurt 0.45s ease-out; }
@keyframes ke-hurt { from { opacity: 1; } to { opacity: 0; } }
.ke-stat--wins { color: #ffd93d; font-size: max(13px, calc(28 * var(--u))); }
.ke-bar {
  position: relative;
  height: max(26px, calc(58 * var(--u)));
  display: flex;
  border: max(2px, calc(4 * var(--u))) solid #1c2233;
  border-radius: calc(10 * var(--u));
  overflow: hidden;
  background: #1c2233;
  box-shadow: 0 calc(5 * var(--u)) 0 rgba(0, 0, 0, 0.3);
}
.ke-bar__track { position: relative; flex: 1; background: rgba(255, 255, 255, 0.92); overflow: hidden; }
.ke-bar__fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0;
  background: repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 calc(12 * var(--u)), transparent calc(12 * var(--u)) calc(24 * var(--u))),
    linear-gradient(180deg, #ffb13d, #ff7a1c);
  transition: width 160ms ease-out;
}
.ke-bar__level {
  position: absolute;
  left: calc(14 * var(--u));
  top: 50%;
  transform: translateY(-50%);
  font-size: max(14px, calc(32 * var(--u)));
  display: flex;
  align-items: center;
  gap: calc(10 * var(--u));
}
.ke-bar__xp {
  flex: none;
  min-width: calc(190 * var(--u));
  display: grid;
  place-items: center;
  padding: 0 calc(12 * var(--u));
  background: #141822;
  font-size: max(13px, calc(30 * var(--u)));
}
.ke-bar--max .ke-bar__fill { background: linear-gradient(180deg, #ff6ad5, #b13dff); }
.ke-auto {
  position: absolute;
  right: calc(-150 * var(--u));
  bottom: 0;
  width: calc(128 * var(--u));
  height: max(34px, calc(64 * var(--u)));
  pointer-events: auto;
  cursor: pointer;
  border: max(2px, calc(4 * var(--u))) solid #1c2233;
  border-radius: calc(10 * var(--u));
  background: linear-gradient(180deg, #ffe066, #f2b21c);
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(15px, calc(30 * var(--u)));
  color: #e0342b;
  box-shadow: 0 calc(5 * var(--u)) 0 rgba(0, 0, 0, 0.3);
  padding: 0;
}
.ke-auto::before {
  content: 'AUTO CLICK';
  position: absolute;
  left: 50%;
  top: calc(-24 * var(--u));
  transform: translateX(-50%);
  font-size: max(9px, calc(16 * var(--u)));
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 0 3px #1c2233, 0 0 3px #1c2233;
}
.ke-auto--on { background: linear-gradient(180deg, #7dff6a, #2f9e2b); color: #fff; }

/* ---- Top centre: what you are fighting ---------------------------------- */
.ke-target {
  position: fixed;
  left: 50%;
  top: calc(max(8px, calc(14 * var(--u))) + var(--aoe-portal-top, 0px));
  transform: translateX(-50%);
  width: min(70vw, calc(620 * var(--u)));
  z-index: 21;
  pointer-events: none;
  font-family: var(--gs-font);
  font-weight: 700;
  text-align: center;
  transition: opacity 160ms ease;
}
.ke-target[hidden] { display: none; }
.ke-target__name { font-size: max(15px, calc(34 * var(--u))); line-height: 1.1; margin-bottom: calc(6 * var(--u)); }
.ke-target--boss .ke-target__name { color: #ff5a4a; font-size: max(17px, calc(40 * var(--u))); }
.ke-target__bar {
  position: relative;
  height: max(18px, calc(36 * var(--u)));
  border: max(2px, calc(4 * var(--u))) solid #1c2233;
  border-radius: 999px;
  background: #3a1216;
  overflow: hidden;
  box-shadow: 0 calc(4 * var(--u)) 0 rgba(0, 0, 0, 0.3);
}
.ke-target__fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(180deg, #ff6a5a, #d8342b); transition: width 120ms linear; }
.ke-target--dummy .ke-target__fill { background: linear-gradient(180deg, #ffd93d, #f2a21c); }
.ke-target__hp { position: absolute; inset: 0; display: grid; place-items: center; font-size: max(12px, calc(22 * var(--u))); }
.ke-target__lock { margin-top: calc(6 * var(--u)); font-size: max(12px, calc(22 * var(--u))); color: #d9a6ff; }

/* ---- Top left: Wins and rebirths ---------------------------------------- */
.ke-counters {
  position: fixed;
  left: max(10px, calc(16 * var(--u)), env(safe-area-inset-left, 0px));
  top: calc(max(10px, calc(20 * var(--u))) + var(--aoe-portal-top, 0px));
  z-index: 21;
  display: flex;
  /* In a row, not a stack: the rail is centred on the left edge and a short screen leaves little room above it. */
  flex-direction: row;
  gap: calc(14 * var(--u));
  pointer-events: none;
  font-family: var(--gs-font);
  font-weight: 700;
}
.ke-counter {
  display: flex;
  align-items: center;
  gap: calc(10 * var(--u));
  padding: calc(4 * var(--u)) calc(16 * var(--u)) calc(4 * var(--u)) calc(6 * var(--u));
  border-radius: calc(12 * var(--u));
  background: linear-gradient(90deg, rgba(20, 24, 40, 0.55), rgba(20, 24, 40, 0));
}
.ke-counter .aoe-icon { width: max(26px, calc(52 * var(--u))); height: max(26px, calc(52 * var(--u))); object-fit: contain; filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.35)); }
.ke-counter__value { font-size: max(18px, calc(44 * var(--u))); line-height: 1; }
.ke-counter--wins .ke-counter__value { color: #ffe066; }
.ke-counter--pop .ke-counter__value { animation: ke-pop 520ms ease-out; }
@keyframes ke-pop { 0% { transform: scale(1); } 35% { transform: scale(1.25); } 100% { transform: scale(1); } }

/* ---- Hint and toasts ---------------------------------------------------- */
.ke-hint {
  position: fixed;
  left: 50%;
  top: calc(max(70px, calc(120 * var(--u))) + var(--aoe-portal-top, 0px));
  transform: translateX(-50%);
  max-width: 80vw;
  z-index: 19;
  pointer-events: none;
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(13px, calc(26 * var(--u)));
  color: #7dff6a;
  text-align: center;
}
.ke-hint[hidden] { display: none; }
.ke-toasts {
  position: fixed;
  left: 50%;
  top: 30%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(8 * var(--u));
  pointer-events: none;
}
.ke-toast {
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(15px, calc(34 * var(--u)));
  white-space: nowrap;
  animation: ke-toast 2500ms ease-out forwards;
}
.ke-toast--good { color: #7dff6a; }
.ke-toast--bad { color: #ff6a5a; }
.ke-toast--gold { color: #ffe066; }
.ke-toast--pink { color: #ff9ecb; }
@keyframes ke-toast {
  0% { opacity: 0; transform: translateY(12px) scale(0.9); }
  10% { opacity: 1; transform: translateY(0) scale(1.05); }
  20% { transform: scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-16px); }
}

/* ---- Damage numbers ------------------------------------------------------ */
.ke-dmg-layer { position: fixed; inset: 0; pointer-events: none; z-index: 18; overflow: hidden; }
.ke-dmg {
  position: absolute;
  left: 0;
  top: 0;
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(16px, calc(36 * var(--u)));
  color: #fff;
  will-change: transform, opacity;
}
.ke-dmg--kill { color: #ffe066; font-size: max(18px, calc(44 * var(--u))); }

/* ---- Win claim: trophies fly into the player -------------------------- */
.ke-trophy-layer { position: fixed; inset: 0; pointer-events: none; z-index: 19; overflow: hidden; }
.ke-trophy {
  position: absolute;
  left: 0;
  top: 0;
  width: max(30px, calc(78 * var(--u)));
  height: max(30px, calc(78 * var(--u)));
  object-fit: contain;
  filter: drop-shadow(0 0 calc(10 * var(--u)) rgba(255, 210, 70, 0.9)) drop-shadow(0 calc(3 * var(--u)) 0 rgba(0, 0, 0, 0.35));
  will-change: transform, opacity;
}
.ke-trophy-flash {
  position: absolute;
  left: 0;
  top: 0;
  width: max(80px, calc(200 * var(--u)));
  height: max(80px, calc(200 * var(--u)));
  border-radius: 50%;
  opacity: 0;
  background: radial-gradient(circle, rgba(255, 244, 190, 0.95) 0%, rgba(255, 205, 60, 0.6) 35%, rgba(255, 180, 30, 0) 70%);
  will-change: transform, opacity;
}

/* ---- XP gain: katana + "+1!" beside the player ------------------------- */
.ke-xp-layer { position: fixed; inset: 0; pointer-events: none; z-index: 17; overflow: hidden; }
.ke-xp {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  gap: calc(4 * var(--u));
  transform-origin: 0 50%;
  will-change: transform, opacity;
}
.ke-xp__icon {
  width: max(28px, calc(76 * var(--u)));
  height: max(28px, calc(76 * var(--u)));
  transform: rotate(8deg);
  filter: drop-shadow(0 2px 0 #1c2233);
}
.ke-xp__amount {
  font-family: var(--gs-font);
  font-weight: 700;
  font-style: italic;
  font-size: max(22px, calc(62 * var(--u)));
  line-height: 1;
  color: #ff2b2b;
  -webkit-text-stroke: max(2px, calc(5 * var(--u))) #1a0d0d;
  paint-order: stroke fill;
  text-shadow: 0 calc(3 * var(--u)) 0 #1a0d0d;
  white-space: nowrap;
}

/* ---- Level up / stage clear popup --------------------------------------- */
.ke-pop {
  position: fixed;
  left: 50%;
  top: 36%;
  transform: translate(-50%, -50%);
  z-index: 31;
  pointer-events: none;
  text-align: center;
  font-family: var(--gs-font);
  font-weight: 700;
}
.ke-pop[hidden] { display: none; }
.ke-pop__title { font-size: max(26px, calc(72 * var(--u))); color: #ffe066; line-height: 1; }
.ke-pop__line { font-size: max(15px, calc(34 * var(--u))); margin-top: calc(8 * var(--u)); }
.ke-pop__line--damage { color: #ff6a5a; }
.ke-pop__line--speed { color: #7dff6a; }
.ke-pop--in { animation: ke-pop-in 420ms cubic-bezier(.2, 1.4, .4, 1) both; }
.ke-pop--out { animation: ke-pop-out 380ms ease-in forwards; }
@keyframes ke-pop-in { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes ke-pop-out { to { opacity: 0; transform: translate(-50%, -70%) scale(0.95); } }

/* ---- Panel bodies ------------------------------------------------------- */
.aoe-panel--forge .aoe-panel__head { background: linear-gradient(180deg, #ff4d3d, #b3201c); }
.aoe-panel--forge .aoe-panel__box { width: min(900px, 96vw); background: #2a0f12; }
.aoe-panel--forge .aoe-panel__body { background: #3a1216; color: #fff; }
.aoe-panel--pets .aoe-panel__head, .aoe-panel--hatch .aoe-panel__head { background: linear-gradient(180deg, #5ee8c8, #1f9ad6); }
.aoe-panel--teleport .aoe-panel__head { background: linear-gradient(180deg, #b98cff, #6d3fd6); }
.aoe-panel--bag .aoe-panel__head { background: linear-gradient(180deg, #ffb347, #d9741a); }
.aoe-panel--rebirth .aoe-panel__head { background: linear-gradient(180deg, #62d6ff, #2f8fe0); }

.ke-forge__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.ke-forge__timer { font-size: clamp(18px, 2.6vw, 30px); }
.ke-forge__total { font-size: clamp(14px, 1.6vw, 18px); color: #ffd93d; }
.ke-forge__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 700px) { .ke-forge__grid { grid-template-columns: repeat(2, 1fr); } }
.ke-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 4px solid var(--rarity, #c9a86a);
  border-radius: 14px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--rarity) 55%, #fff), color-mix(in srgb, var(--rarity) 85%, #000));
  padding: 0 8px 10px;
  overflow: hidden;
  color: #fff;
}
.ke-card__rarity { margin: 0 -8px 6px; align-self: stretch; text-align: center; padding: 4px; font-size: clamp(14px, 1.6vw, 20px); background: rgba(0,0,0,0.35); }
.ke-card__name { font-size: clamp(13px, 1.4vw, 17px); text-align: center; min-height: 2.4em; display: grid; place-items: center; }
.ke-card__stock { font-size: 12px; padding: 2px 8px; border-radius: 6px; background: rgba(0,0,0,0.45); margin: 4px 0; }
.ke-card__icon { width: 72px; height: 72px; margin: 4px 0; }
.ke-card__perfect { color: #7dff6a; font-size: 13px; min-height: 1.2em; }
.ke-card__bonus { font-size: clamp(16px, 1.8vw, 22px); margin: 4px 0 8px; }
.ke-buy {
  width: 100%;
  border: 3px solid #1c2233;
  border-radius: 10px;
  padding: 7px 4px;
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: clamp(14px, 1.6vw, 18px);
  color: #fff;
  cursor: pointer;
  background: linear-gradient(180deg, #ffd93d, #f29a1c);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
}
.ke-buy .aoe-icon { height: 1.1em; width: auto; }
.ke-buy:disabled { background: linear-gradient(180deg, #9a9a9a, #6e6e6e); cursor: not-allowed; }
.ke-buy--green { background: linear-gradient(180deg, #7dff6a, #2f9e2b); }
.ke-buy--red { background: linear-gradient(180deg, #ff6a5a, #c92a2a); }
.ke-buy--blue { background: linear-gradient(180deg, #62d6ff, #2f8fe0); }

.ke-hatch__pets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
@media (max-width: 560px) { .ke-hatch__pets { grid-template-columns: repeat(2, 1fr); } }
.ke-hatch__pet { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ke-hatch__rarity { font-size: clamp(13px, 1.5vw, 18px); }
.ke-orb {
  width: clamp(70px, 10vw, 110px);
  height: clamp(70px, 10vw, 110px);
  border-radius: 50%;
  border: 4px solid #1c2233;
  background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--rarity) 40%, #fff), var(--rarity));
  display: grid;
  place-items: center;
  overflow: hidden;
}
.ke-orb img { width: 92%; height: 92%; object-fit: contain; }
.ke-hatch__chance { font-size: clamp(14px, 1.6vw, 18px); }
.ke-hatch__bonus { font-size: 12px; color: #1f8f2b; }
.ke-hatch__actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.ke-hatch__actions .ke-buy { width: auto; min-width: 150px; padding: 10px 16px; }
.ke-hatch__cost { text-align: center; margin-bottom: 10px; font-size: 16px; }

.ke-pets__bar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.ke-pets__bar .ke-buy { width: auto; padding: 7px 14px; }
.ke-pets__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
.ke-pet {
  position: relative;
  border: 3px solid #1c2233;
  border-radius: 12px;
  background: #fff;
  padding: 6px 4px;
  text-align: center;
  cursor: pointer;
  font-size: 12px;
}
.ke-pet--equipped { box-shadow: 0 0 0 3px #7dff6a inset; background: #eaffea; }
.ke-pet--selected { outline: 3px solid #3fa9ff; outline-offset: 1px; }
.ke-pet .ke-orb { width: 64px; height: 64px; margin: 0 auto 4px; }
.ke-pet__name { font-weight: 700; line-height: 1.1; }
.ke-pet__bonus { color: #1f8f2b; }
.ke-pet__tag { position: absolute; right: 4px; top: 4px; font-size: 10px; background: #2f9e2b; color: #fff; border-radius: 6px; padding: 1px 5px; }
.ke-pets__detail { display: flex; gap: 8px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
.ke-pets__detail .ke-buy { width: auto; padding: 8px 16px; }
.ke-empty { text-align: center; padding: 24px 8px; opacity: 0.7; }

.ke-teleport { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.ke-teleport .ke-buy { padding: 10px 6px; display: flex; flex-direction: column; align-items: center; gap: 5px; }
.ke-teleport__cost {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px 2px 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.32);
  color: #ffe08a;
  font-size: 14px;
}
.ke-teleport__cost .aoe-icon { width: 18px; height: 18px; }
.ke-teleport__cost--short { color: #ff8a80; }

.ke-bag__row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 4px; border-bottom: 2px solid rgba(0,0,0,0.08); font-size: 15px; }
.ke-bag__row b { color: #d9341c; }
.ke-bag__total { font-size: 20px; }
.ke-bag__total b { color: #c92a2a; }
.ke-bag__h { margin: 14px 0 4px; font-size: 16px; color: #6d3fd6; }

.ke-rb { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin-bottom: 12px; }
.ke-rb__card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 8px;
  border: 4px solid #1c2233;
  border-radius: 14px;
  color: #fff;
  font-size: clamp(15px, 2vw, 24px);
  text-align: center;
  box-shadow: 0 4px 0 rgba(0,0,0,0.25);
}
.ke-rb__card--speed { background: linear-gradient(180deg, #ff5a5a, #c92a2a); }
.ke-rb__card--level { background: linear-gradient(180deg, #ffd93d, #f29a1c); }
.ke-rb__card--damage { background: linear-gradient(180deg, #b98cff, #6d3fd6); }
.ke-rb__arrow { font-size: 28px; color: #ff5fb3; }
.ke-rb__now { text-align: center; font-size: 16px; margin-bottom: 10px; }
.ke-rb__warn { text-align: center; color: #c92a2a; margin: 4px 0 10px; }
.ke-rb__bar { position: relative; height: 40px; border: 4px solid #1c2233; border-radius: 12px; overflow: hidden; background: #cfd3de; margin-bottom: 14px; }
.ke-rb__fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(180deg, #ffd93d, #f29a1c); }
.ke-rb__label { position: absolute; inset: 0; display: grid; place-items: center; font-size: 18px; color: #fff; text-shadow: 0 0 3px #1c2233, 0 0 3px #1c2233; }

.ke-reveal { position: fixed; inset: 0; display: grid; place-items: center; z-index: 45; background: rgba(10, 20, 40, 0.45); }
.ke-reveal[hidden] { display: none; }
.ke-reveal__row { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; }
.ke-reveal__pet { display: flex; flex-direction: column; align-items: center; gap: 6px; font-family: var(--gs-font); font-weight: 700; animation: ke-pop-in 500ms cubic-bezier(.2,1.4,.4,1) both; }
.ke-reveal__pet .ke-orb { width: clamp(110px, 16vw, 180px); height: clamp(110px, 16vw, 180px); }
.ke-reveal__name { font-size: clamp(18px, 2.4vw, 30px); }
.ke-reveal__rarity { font-size: clamp(14px, 1.8vw, 22px); }

/* Touch mode: lift the stat bar clear of the stick and the buttons on an upright screen. */
body.aoe-touch-mode .ke-auto { right: auto; left: 50%; transform: translateX(-50%); bottom: calc(100% + calc(56 * var(--u))); width: calc(150 * var(--u)); }
/* Upright: the stick and the buttons rise ABOVE the stat bar, which stays on the bottom edge. */
@media (orientation: portrait) {
  body.aoe-touch-mode { --aoe-controls-lift: max(66px, calc(150 * var(--u))); }
}
@media (orientation: landscape) {
  body.aoe-touch-mode { --ke-bar-w: min(50vw, calc(640 * var(--u))); }
}
`;
  document.head.appendChild(style);
};
