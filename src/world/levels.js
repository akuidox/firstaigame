// Ordered list of levels in the episode. The exit of one leads to the next;
// clearing the last one completes the episode. Add a level by importing it and
// appending it here.

import { level1 } from './level1.js';
import { level2 } from './level2.js';

export const LEVELS = [level1, level2];
