
const ur = (namn, forval) => (process.env[namn] || forval).replace(/\/+$/, '');

export const HEM = ur('MAXIMUS_HEM', 'https://aurolabs.ai/maximus');

export const UPPDATERING = ur('MAXIMUS_UPPDATERINGAR', 'https://github.com/aurolabsai/maximus/releases/latest/download/latest.json');

export const SLAPP = ur('MAXIMUS_SLAPP_BAS', `${HEM}/slapp`);

export const RAPPORTER = ur('MAXIMUS_RAPPORTER', '');

export const RAPPORTMEJL = (process.env.MAXIMUS_RAPPORTMEJL || 'maximus@aurolabs.ai').trim();

export const besokare = version => `MAXIMUS/${version} (+${HEM})`;

export const adresser = () => ({ hem: HEM, uppdatering: UPPDATERING, slapp: SLAPP, rapporter: RAPPORTER || null, rapportmejl: RAPPORTMEJL });
