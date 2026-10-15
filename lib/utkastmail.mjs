
import { execFile } from 'node:child_process';
import { AR_MAC } from './plattform.mjs';
import { tx } from './sprakstod.mjs';

const cit = s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export async function utkast({ till = '', amne, text }) {
  if (!AR_MAC) throw new Error(tx('utkastmail.baraMac'));
  const skript = `
tell application "Mail"
	set m to make new outgoing message with properties {subject:${cit(amne)}, content:${cit(text)}, visible:false}
	${till ? `tell m to make new to recipient at end of to recipients with properties {address:${cit(till)}}` : ''}
	save m
	close m saving yes
	return "ok"
end tell`;
  await new Promise((klar, fel) => execFile('/usr/bin/osascript', ['-e', skript], { timeout: 30000 },
    (e, ut, err) => (e ? fel(new Error(String(err || e.message).trim().slice(0, 200) || tx('utkastmail.svaradeInte'))) : klar(ut))));
  return { id: null, var: tx('utkastmail.var') };
}
