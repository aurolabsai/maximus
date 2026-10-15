
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const VAG = new URL('../data/fornamn.txt', import.meta.url);

export const FORNAMN = new Set(readFileSync(VAG, 'utf8').split('\n').filter(Boolean));
