import type { ForgeItem } from '@katana/shared';

const cache = new Map<string, string>();

/**
 * The forge items' pictures, drawn on a canvas once each: an iron bar, a
 * glowing orb, a blue flame, a carved rune stone and the rest. Data URLs, so
 * the shop cards need no image files.
 */
export const forgeIcon = (icon: ForgeItem['icon']): string => {
  const cached = cache.get(icon);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1c2233';
  const poly = (points: readonly (readonly [number, number])[], fill: string | CanvasGradient): void => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  };
  const orb = (color: string, glow: string): void => {
    const g = ctx.createRadialGradient(40, 38, 4, 48, 48, 34);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, glow);
    g.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(48, 50, 30, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
  };
  const flame = (outer: string, inner: string): void => {
    poly([[48, 8], [70, 40], [72, 64], [60, 86], [36, 86], [24, 64], [28, 42], [40, 50]], outer);
    poly([[48, 40], [60, 60], [56, 80], [40, 80], [36, 62]], inner);
  };
  switch (icon) {
    case 'bar': {
      const g = ctx.createLinearGradient(0, 30, 0, 70);
      g.addColorStop(0, '#f4f6fa');
      g.addColorStop(1, '#8e96a6');
      poly([[14, 58], [30, 32], [82, 32], [82, 48], [66, 72], [14, 72]], g);
      poly([[14, 58], [66, 58], [82, 32]], 'rgba(255,255,255,0.35)');
      break;
    }
    case 'ingot':
      poly([[12, 62], [28, 36], [84, 36], [84, 50], [68, 74], [12, 74]], '#d98a4a');
      poly([[12, 62], [68, 62], [84, 36]], 'rgba(255,230,180,0.45)');
      break;
    case 'stone':
      poly([[20, 70], [16, 44], [36, 22], [66, 20], [82, 42], [76, 72], [46, 82]], '#a7aebc');
      poly([[36, 40], [58, 34], [64, 52], [44, 60]], '#dfe6ee');
      break;
    case 'orb':
      orb('#b3001e', '#ff4d4d');
      break;
    case 'oil':
      poly([[38, 14], [58, 14], [58, 30], [74, 48], [70, 84], [26, 84], [22, 48], [38, 30]], '#3fae3f');
      poly([[30, 56], [66, 56], [64, 78], [32, 78]], '#8dff6a');
      break;
    case 'silk':
      poly([[14, 30], [82, 20], [74, 44], [84, 70], [18, 78], [26, 52]], '#e0342b');
      ctx.strokeStyle = '#ffd6d6';
      ctx.beginPath();
      ctx.moveTo(22, 40);
      ctx.lineTo(74, 32);
      ctx.moveTo(26, 64);
      ctx.lineTo(76, 58);
      ctx.stroke();
      break;
    case 'flame':
      flame('#2f8fe0', '#bff4ff');
      break;
    case 'ember':
      flame('#ff4d1c', '#ffe066');
      break;
    case 'scale':
      for (let i = 0; i < 3; i += 1) poly([[24 + i * 16, 70 - i * 12], [40 + i * 16, 40 - i * 12], [56 + i * 16, 70 - i * 12]], i % 2 ? '#2fae5a' : '#5fe08a');
      break;
    case 'moon':
      ctx.beginPath();
      ctx.arc(48, 48, 32, 0, Math.PI * 2);
      ctx.fillStyle = '#e8e2ff';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(62, 40, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#3a2a66';
      ctx.fill();
      break;
    case 'rune':
      poly([[26, 84], [18, 50], [30, 14], [70, 12], [80, 46], [70, 84]], '#6b4a3a');
      ctx.strokeStyle = '#ffb02e';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(56, 22);
      ctx.lineTo(38, 48);
      ctx.lineTo(56, 48);
      ctx.lineTo(40, 76);
      ctx.stroke();
      break;
    case 'seal':
      poly([[20, 20], [76, 20], [76, 76], [20, 76]], '#c0392b');
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 5;
      ctx.strokeRect(30, 30, 36, 36);
      ctx.beginPath();
      ctx.moveTo(48, 30);
      ctx.lineTo(48, 66);
      ctx.moveTo(30, 48);
      ctx.lineTo(66, 48);
      ctx.stroke();
      break;
  }
  const url = canvas.toDataURL('image/png');
  cache.set(icon, url);
  return url;
};
