import type { Decor } from '@katana/shared';
import type { PartBuilder } from '../render/PartBuilder.js';
import {
  bambooClump,
  barrel,
  bench,
  crate,
  house,
  jizo,
  lampPost,
  nobori,
  pineTree,
  rock,
  sakuraTree,
  stoneLantern,
  sunFlag,
} from './JapaneseProps.js';

const NOBORI_COLORS = [0xe0342b, 0x2f5a9a, 0xf2c14e, 0x3fae3f] as const;

/**
 * Draw shared decor data. The positions come from `@katana/shared`, the same
 * list collision stands solids up from, so what is drawn is what blocks.
 */
export const drawDecor = (b: PartBuilder, items: readonly Decor[], y = 0): void => {
  items.forEach((item, index) => {
    switch (item.kind) {
      case 'pine':
        pineTree(b, item.x, y, item.z, item.s);
        break;
      case 'sakura':
        sakuraTree(b, item.x, y, item.z, item.s, index);
        break;
      case 'bamboo':
        bambooClump(b, item.x, y, item.z, 6, 10 * item.s, index + 3);
        break;
      case 'stoneLantern':
        stoneLantern(b, item.x, y, item.z, Math.min(item.s, 1.2));
        break;
      case 'lamp':
        lampPost(b, item.x, y, item.z, item.s);
        break;
      case 'rock':
        rock(b, item.x, y, item.z, item.s, item.yaw);
        break;
      case 'house':
        house(b, item.x, y, item.z, item.s, item.d ?? 8, 5.5, item.yaw);
        break;
      case 'barrel':
        barrel(b, item.x, y, item.z, item.s);
        break;
      case 'crate':
        crate(b, item.x, y, item.z, item.s, item.yaw);
        break;
      case 'flag':
        sunFlag(b, item.x, y, item.z, item.yaw);
        break;
      case 'nobori':
        nobori(b, item.x, y, item.z, NOBORI_COLORS[index % NOBORI_COLORS.length]!, item.yaw);
        break;
      case 'bench':
        bench(b, item.x, y, item.z, item.yaw);
        break;
      case 'jizo':
        jizo(b, item.x, y, item.z);
        break;
    }
  });
};
