import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { csv, lasExport, somText, sammandrag, profilPrompt } from '../lib/du.mjs';

test('csv med citat, kommatecken och radbrytningar inuti fält, och en anteckning före rubriken', () => {
  const r = csv('Notes:\n"This file contains..."\n\nFirst Name,Headline\nHenrik,"Partner Manager, AI Sweden\nKronoberg"\n');
  assert.deepEqual(r, [{ 'first name': 'Henrik', headline: 'Partner Manager, AI Sweden\nKronoberg' }]);
});

test('LinkedIn-exporten läses ur zipen, kolumnerna oavsett skiftläge', async () => {
  const z = new JSZip();
  z.file('Basic_LinkedInDataExport/Profile.csv', 'First Name,Last Name,Headline,Summary,Industry,Geo Location\nHenrik,R,Partner Manager AI,Bygger med AI,IT,Växjö\n');
  z.file('Basic_LinkedInDataExport/Positions.csv', 'Company Name,Title,Description,Location,Started On,Finished On\nVLSP,Affärsutvecklare,AI-noden,Växjö,Jan 2025,\n');
  z.file('Basic_LinkedInDataExport/Skills.csv', 'Name\nAI\nProduktutveckling\n');
  z.file('Basic_LinkedInDataExport/Shares.csv', 'Date,ShareLink,ShareCommentary,SharedUrl,MediaUrl,Visibility\n2026-09-01,https://l/1,"Lokal AI för SMF, på riktigt",,,PUBLIC\n');
  z.file('Basic_LinkedInDataExport/Reactions.csv', 'Date,Type,Link\n2026-09-02,LIKE,https://l/2\n');
  const du = await lasExport(await z.generateAsync({ type: 'nodebuffer' }));
  assert.equal(du.profil.namn, 'Henrik R');
  assert.equal(du.roller[0].org, 'VLSP');
  assert.deepEqual(du.kompetenser, ['AI', 'Produktutveckling']);
  assert.equal(du.inlagg[0].text, 'Lokal AI för SMF, på riktigt');
  assert.equal(du.reaktioner.length, 1);
  const t = somText(du);
  assert.match(t, /Affärsutvecklare på VLSP/);
  assert.match(t, /Egna inlägg \(1/);
  assert.match(profilPrompt(t), /Hitta inte på/);
  assert.equal(sammandrag(du).antal.reaktioner, 1);
});

test('en zip som inte är en export säger det', async () => {
  const z = new JSZip(); z.file('annat.txt', 'hej');
  await assert.rejects(lasExport(await z.generateAsync({ type: 'nodebuffer' })), /LinkedIn-export/);
});
