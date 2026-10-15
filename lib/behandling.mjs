
import { tx } from './sprakstod.mjs';
export const BEHANDLINGAR = {
  original: {
    get namn() { return tx('behandling.original.namn'); },
    get om() { return tx('behandling.original.om'); },
  },
  maskerad: {
    get namn() { return tx('behandling.maskerad.namn'); },
    get om() { return tx('behandling.maskerad.om'); },
  },
  anonym: {
    get namn() { return tx('behandling.anonym.namn'); },
    get om() { return tx('behandling.anonym.om'); },
  },
};

export const BEH_FORVAL = 'maskerad';

export const arBehandling = b => Object.hasOwn(BEHANDLINGAR, String(b));

export const stall = behandling => (arBehandling(behandling) ? String(behandling) : BEH_FORVAL);

export function vad(behandling) {
  const b = stall(behandling);
  return {
    behandling: b,
    lokalt: true,
    maskera: b !== 'original',
    anonymisera: b === 'anonym',
    tolka: b !== 'original',
  };
}

export const gallande = (behandling, { moln = false } = {}) => (moln ? stall(behandling) : null);

export function franGammalt({ lage, destination, behandling, utanMask = false } = {}) {
  if (arBehandling(behandling)) return behandling;
  if (destination === 'chatgpt') return 'maskerad';
  if (destination === 'har') return utanMask ? 'original' : 'maskerad';
  if (lage === 'lokalt') return utanMask ? 'original' : 'maskerad';
  if (lage === 'snabb' || lage === 'noggrann') return 'maskerad';
  return BEH_FORVAL;
}

export const listor = () => ({
  behandlingar: Object.entries(BEHANDLINGAR).map(([id, b]) => ({ id, namn: b.namn, om: b.om })),
});
