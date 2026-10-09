/// Versionen, läsbar från vilken modul som helst.
///
/// Den stod inbakad som '4.0.0' i det motsignerade intyget, som '4.0' i
/// starthälsningen och som 'MAXIMUS/4.0' i webbhämtarens User-Agent. Tre
/// siffror för samma sak, och den som ljuger står i någon annans logg.
import { readFileSync } from 'node:fs';

export const VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
