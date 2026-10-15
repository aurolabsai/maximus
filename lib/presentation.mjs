
const BESTALL_EN = /(?<![\p{L}\d])(make|create|build|put\s+together|prepare|write|draft|do|generate)\b[\s\S]{0,60}?\b(presentations?|ppt|pptx|powerpoint|power\s*point|slide\s*show|slideshow|keynote|slides?|deck|slide\s+deck)(?![\p{L}\d])/iu;
const BESTALL = /(?<![\p{L}\d])(gör|göra|skapa|ta\s+fram|bygg|bygga|skriv|sätt\s+ihop|förbered)\b[\s\S]{0,60}?\b(presentation\p{L}*|ppt|pptx|powerpoint|power\s*point|bildspel|keynote|slides?|slajd\p{L}*)(?![\p{L}\d])/iu;

export const avsikt = text => {
  const t = String(text || '').replace(/^(>[^\n]*\n?)+/, '');
  return BESTALL.test(t) || BESTALL_EN.test(t);
};

import { modellprompt } from './sprakstod.mjs';

const SVENSK = `[MAXIMUS: Det här blir en presentation, och MAXIMUS gör filen av ditt svar. Skriv den som markdown och inget annat:
- Första raden: # Titel
- Sedan 6–9 bilder. Varje bild: ## Rubrik, och under den 3–5 punkter med "- ". Varje punkt högst 14 ord, konkret, inga hela stycken.
- Bygg på källorna du fått, och sätt [1], [2] efter det som kommer ur dem.
- Sista bilden: ## Källor, med en punkt per källa.
Ingen inledning före titeln och ingen kommentar efter.]`;

export const anvisning = () => modellprompt(SVENSK, { markorer: ['## Källor'] });
export const ANVISNING = { toString: anvisning, [Symbol.toPrimitive]: anvisning };
