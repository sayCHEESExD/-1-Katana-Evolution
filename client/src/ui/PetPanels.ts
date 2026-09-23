import {
  EGGS,
  HATCH_MULTI,
  PET_EQUIP_MAX,
  PET_INVENTORY_MAX,
  PET_RARITY_COLORS,
  formatPercent,
  formatWins,
  petById,
  type PetActionKind,
} from '@katana/shared';
import type { NetPet } from '../net/netTypes.js';
import type { PetThumbnails } from '../pets/PetThumbnails.js';
import { ICONS } from './hudStyles.js';
import { injectKatanaStyles } from './katanaStyles.js';
import { Panel } from './Panel.js';

const rarityLabel = (rarity: string): string => rarity.charAt(0).toUpperCase() + rarity.slice(1);

const orb = (thumbs: PetThumbnails, petId: number): string => {
  const pet = petById(petId);
  const color = pet ? PET_RARITY_COLORS[pet.rarity] : '#888';
  return `<div class="ke-orb" style="--rarity:${color}"><img src="${thumbs.get(petId)}" alt=""></div>`;
};

/**
 * HATCH EGG: the egg's four Yokai, their rarities and chances, and Hatch /
 * Hatch 3. Opened by standing on the egg's pad; the server checks the pad,
 * the Wins and the inventory space, and rolls.
 */
export class HatchPanel extends Panel {
  private readonly cost: HTMLDivElement;
  private readonly pets: HTMLDivElement;
  private readonly one: HTMLButtonElement;
  private readonly three: HTMLButtonElement;
  private egg = 1;
  private wins = 0;
  private owned = 0;

  constructor(parent: HTMLElement, private readonly thumbs: PetThumbnails, hatch: (egg: number, count: number) => void) {
    super(parent, 'hatch', 'Hatch Egg');
    injectKatanaStyles();
    this.cost = document.createElement('div');
    this.cost.className = 'ke-hatch__cost';
    this.pets = document.createElement('div');
    this.pets.className = 'ke-hatch__pets';
    const actions = document.createElement('div');
    actions.className = 'ke-hatch__actions';
    this.three = document.createElement('button');
    this.three.type = 'button';
    this.three.className = 'ke-buy ke-buy--blue';
    this.three.addEventListener('click', () => hatch(this.egg, HATCH_MULTI));
    this.one = document.createElement('button');
    this.one.type = 'button';
    this.one.className = 'ke-buy ke-buy--green';
    this.one.addEventListener('click', () => hatch(this.egg, 1));
    actions.append(this.three, this.one);
    this.body.append(this.cost, this.pets, actions);
  }

  show(egg: number): void {
    this.egg = egg;
    this.render();
    this.setOpen(true);
  }

  get eggShown(): number {
    return this.egg;
  }

  setInventory(wins: number, owned: number): void {
    if (wins === this.wins && owned === this.owned) return;
    this.wins = wins;
    this.owned = owned;
    if (this.isOpen) this.render();
  }

  private render(): void {
    const egg = EGGS.find((entry) => entry.id === this.egg);
    if (!egg) return;
    this.cost.innerHTML = `<b>${egg.name}</b> - ${ICONS.trophy.replace('class="aoe-icon"', 'class="aoe-icon" style="height:1.1em;width:auto;vertical-align:-3px"')} ${formatWins(egg.cost)} each · Pets ${this.owned}/${PET_INVENTORY_MAX}`;
    this.pets.innerHTML = egg.pool
      .map(([petId, chance]) => {
        const pet = petById(petId)!;
        return (
          `<div class="ke-hatch__pet">` +
          `<div class="ke-hatch__rarity ke-outline" style="color:${PET_RARITY_COLORS[pet.rarity]}">${rarityLabel(pet.rarity)}</div>` +
          orb(this.thumbs, petId) +
          `<div class="ke-hatch__chance">${chance.toFixed(1)}%</div>` +
          `<div><b>${pet.name}</b></div>` +
          `<div class="ke-hatch__bonus">${formatPercent(pet.bonus)} damage</div>` +
          `</div>`
        );
      })
      .join('');
    const room = PET_INVENTORY_MAX - this.owned;
    this.one.textContent = `Hatch (${formatWins(egg.cost)})`;
    this.three.textContent = `Hatch 3 (${formatWins(egg.cost * HATCH_MULTI)})`;
    this.one.disabled = this.wins < egg.cost || room < 1;
    this.three.disabled = this.wins < egg.cost * HATCH_MULTI || room < HATCH_MULTI;
  }
}

/** What just hatched, big, for a moment. */
export class HatchReveal {
  private readonly root: HTMLDivElement;
  private readonly row: HTMLDivElement;
  private timer = 0;

  constructor(parent: HTMLElement, private readonly thumbs: PetThumbnails) {
    injectKatanaStyles();
    this.root = document.createElement('div');
    this.root.className = 'ke-reveal';
    this.root.hidden = true;
    this.row = document.createElement('div');
    this.row.className = 'ke-reveal__row';
    this.root.appendChild(this.row);
    this.root.addEventListener('click', () => this.hide());
    parent.appendChild(this.root);
  }

  show(petIds: readonly number[]): void {
    this.row.innerHTML = petIds
      .map((petId, index) => {
        const pet = petById(petId)!;
        return (
          `<div class="ke-reveal__pet" style="animation-delay:${index * 120}ms">` +
          orb(this.thumbs, petId) +
          `<div class="ke-reveal__name ke-outline">${pet.name}</div>` +
          `<div class="ke-reveal__rarity ke-outline" style="color:${PET_RARITY_COLORS[pet.rarity]}">${rarityLabel(pet.rarity)} · ${formatPercent(pet.bonus)} damage</div>` +
          `</div>`
        );
      })
      .join('');
    this.root.hidden = false;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), 2600);
  }

  private hide(): void {
    this.root.hidden = true;
  }

  dispose(): void {
    window.clearTimeout(this.timer);
    this.root.remove();
  }
}

/**
 * THE PET INVENTORY: every Yokai owned, equipped ones marked, with Equip
 * Best, Unequip All, and per-pet Equip / Unequip / Delete. Every action is a
 * request naming a uid; the server owns the inventory.
 */
export class PetsPanel extends Panel {
  private readonly summary: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  private pets: NetPet[] = [];
  private selected = -1;
  private signature = '';
  private confirmDelete = -1;

  constructor(parent: HTMLElement, private readonly thumbs: PetThumbnails, private readonly act: (action: PetActionKind, uid?: number) => void) {
    super(parent, 'pets', 'Pets', ICONS.pets);
    injectKatanaStyles();
    const bar = document.createElement('div');
    bar.className = 'ke-pets__bar';
    this.summary = document.createElement('div');
    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.gap = '8px';
    const best = document.createElement('button');
    best.type = 'button';
    best.className = 'ke-buy ke-buy--green';
    best.textContent = 'Equip Best';
    best.addEventListener('click', () => this.act('equipBest'));
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'ke-buy ke-buy--blue';
    none.textContent = 'Unequip All';
    none.addEventListener('click', () => this.act('unequipAll'));
    buttons.append(best, none);
    bar.append(this.summary, buttons);
    this.grid = document.createElement('div');
    this.grid.className = 'ke-pets__grid';
    this.detail = document.createElement('div');
    this.detail.className = 'ke-pets__detail';
    this.body.append(bar, this.grid, this.detail);
  }

  setPets(pets: ArrayLike<NetPet>): void {
    const list: NetPet[] = [];
    for (let i = 0; i < pets.length; i += 1) {
      const pet = pets[i];
      if (pet) list.push({ uid: pet.uid, petId: pet.petId, equipped: pet.equipped });
    }
    this.pets = list;
    if (!list.some((pet) => pet.uid === this.selected)) this.selected = -1;
    if (this.isOpen) this.render();
  }

  protected override onOpened(): void {
    this.signature = '';
    this.confirmDelete = -1;
    this.render();
  }

  private render(): void {
    const signature = `${this.selected}:${this.confirmDelete}:` + this.pets.map((p) => `${p.uid}.${p.petId}.${p.equipped ? 1 : 0}`).join(',');
    if (signature === this.signature) return;
    this.signature = signature;
    const equipped = this.pets.filter((pet) => pet.equipped).length;
    let bonus = 0;
    for (const pet of this.pets) if (pet.equipped) bonus += petById(pet.petId)?.bonus ?? 0;
    this.summary.innerHTML = `Equipped <b>${equipped}/${PET_EQUIP_MAX}</b> · Owned <b>${this.pets.length}/${PET_INVENTORY_MAX}</b> · Pet bonus <b>${formatPercent(bonus)}</b>`;
    if (this.pets.length === 0) {
      this.grid.innerHTML = '<div class="ke-empty">No pets yet. Hatch an egg at the Pets Shop behind the spawn!</div>';
      this.detail.replaceChildren();
      return;
    }
    const sorted = [...this.pets].sort((a, b) => Number(b.equipped) - Number(a.equipped) || (petById(b.petId)?.bonus ?? 0) - (petById(a.petId)?.bonus ?? 0));
    this.grid.replaceChildren(
      ...sorted.map((pet) => {
        const kind = petById(pet.petId);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `ke-pet${pet.equipped ? ' ke-pet--equipped' : ''}${pet.uid === this.selected ? ' ke-pet--selected' : ''}`;
        cell.innerHTML =
          orb(this.thumbs, pet.petId) +
          `<div class="ke-pet__name">${kind?.name ?? '?'}</div>` +
          `<div class="ke-pet__bonus">${formatPercent(kind?.bonus ?? 0)}</div>` +
          (pet.equipped ? '<span class="ke-pet__tag">E</span>' : '');
        cell.addEventListener('click', () => {
          this.selected = pet.uid;
          this.confirmDelete = -1;
          this.render();
        });
        return cell;
      }),
    );
    const pet = this.pets.find((entry) => entry.uid === this.selected);
    if (!pet) {
      this.detail.innerHTML = '<div class="ke-empty" style="padding:6px">Select a pet to equip or delete it.</div>';
      return;
    }
    const kind = petById(pet.petId);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `ke-buy ${pet.equipped ? 'ke-buy--blue' : 'ke-buy--green'}`;
    toggle.textContent = pet.equipped ? 'Unequip' : 'Equip';
    toggle.disabled = !pet.equipped && equipped >= PET_EQUIP_MAX;
    toggle.addEventListener('click', () => this.act(pet.equipped ? 'unequip' : 'equip', pet.uid));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ke-buy ke-buy--red';
    remove.textContent = this.confirmDelete === pet.uid ? `Really delete ${kind?.name ?? 'pet'}?` : 'Delete';
    remove.addEventListener('click', () => {
      if (this.confirmDelete === pet.uid) {
        this.act('delete', pet.uid);
        this.confirmDelete = -1;
        this.selected = -1;
      } else {
        this.confirmDelete = pet.uid;
      }
      this.render();
    });
    this.detail.replaceChildren(toggle, remove);
  }
}
