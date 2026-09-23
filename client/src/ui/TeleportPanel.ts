import { STAGES, TELEPORT_STAGE_COUNT, formatWins, stageTeleportCost } from '@katana/shared';
import { ICONS } from './hudStyles.js';
import { injectKatanaStyles } from './katanaStyles.js';
import { Panel } from './Panel.js';

const PLACES: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'spawn', label: 'Spawn' },
  { id: 'katanas', label: 'Katana Stage' },
  { id: 'training', label: 'Training' },
  { id: 'forge', label: 'Forge Shop' },
  { id: 'eggs', label: 'Pets Shop' },
];

/**
 * TELEPORT: the village's places (free), and the stages - each with its
 * price in Wins. A stage is offered once it is open (the one before it cleared
 * once) and costs `stageTeleportCost` Wins, shown on its button: gold when
 * affordable, red when not. The server re-checks both and spends the Wins; the
 * client only names a destination. Never more than Stage 20.
 */
export class TeleportPanel extends Panel {
  private readonly grid: HTMLDivElement;
  private signature = '';

  constructor(parent: HTMLElement, private readonly go: (to: string) => void) {
    super(parent, 'teleport', 'Teleport', ICONS.torii);
    injectKatanaStyles();
    this.grid = document.createElement('div');
    this.grid.className = 'ke-teleport';
    this.body.appendChild(this.grid);
  }

  /** Redraw for this player's progress and Wins. Cheap when nothing that shows has changed. */
  setState(bestStage: number, wins: number): void {
    const stages = STAGES.slice(0, TELEPORT_STAGE_COUNT);
    const affordable = stages.map((stage) => wins >= (stageTeleportCost(stage.index) ?? Infinity));
    const signature = `${bestStage}:${affordable.map((ok) => (ok ? 1 : 0)).join('')}`;
    if (signature === this.signature) return;
    this.signature = signature;

    const buttons: HTMLButtonElement[] = [];
    for (const place of PLACES) buttons.push(this.button(place.label, place.id, true, 'ke-buy--blue', null, true));
    stages.forEach((stage, i) => {
      const cost = stageTeleportCost(stage.index);
      if (cost === null) return;
      const open = stage.index <= bestStage + 1;
      const label = open ? `Stage ${stage.index}: ${stage.name}` : `Stage ${stage.index} (locked)`;
      buttons.push(this.button(label, `stage${stage.index}`, open && affordable[i]!, 'ke-buy--green', cost, affordable[i]!));
    });
    this.grid.replaceChildren(...buttons);
  }

  private button(label: string, id: string, enabled: boolean, variant: string, cost: number | null, affordable: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ke-buy ${variant}`;
    const name = document.createElement('span');
    name.className = 'ke-teleport__name';
    name.textContent = label;
    button.appendChild(name);
    if (cost !== null) {
      // The price, always shown: with the trophy, gold if it can be paid, red if not.
      const price = document.createElement('span');
      price.className = `ke-teleport__cost${affordable ? '' : ' ke-teleport__cost--short'}`;
      price.innerHTML = ICONS.trophy;
      price.append(`${formatWins(cost)} Wins`);
      button.appendChild(price);
      button.title = affordable ? `Costs ${formatWins(cost)} Wins` : `Needs ${formatWins(cost)} Wins`;
    }
    button.disabled = !enabled;
    button.addEventListener('click', () => {
      this.go(id);
      this.setOpen(false);
    });
    return button;
  }
}
