// Äter minne tills bara `mål` GB är kvar, och håller det.
//
// Det enda sättet att veta att MAXIMUS går på en 16 GB-maskin är att ge den en
// 16 GB-maskin. En M1 Max med 64 GB bevisar ingenting om en MacBook Air.
const malGB = Number(process.argv[2] || 8);
const BIT = 1 << 30; // 1 GB i taget — Buffer tar inte mer än fyra.


const { execSync } = await import('node:child_process');
function ledigt() {
  const ut = execSync('/usr/bin/vm_stat').toString();
  const sid = Number(/page size of (\d+)/.exec(ut)[1]);
  const t = n => Number(new RegExp(`${n}:\\s+(\\d+)`).exec(ut)?.[1] || 0);
  return (t('Pages free') + t('Pages inactive') + t('Pages speculative')) * sid / 1073741824;
}

const ballonger = [];
process.stderr.write(`ledigt före: ${ledigt().toFixed(1)} GB · mål: ${malGB} GB\n`);
while (ledigt() > malGB && ballonger.length < 54) {
  const b = Buffer.allocUnsafe(BIT);
  // Slumpdata, inte en konstant. macOS komprimerar minne, och en ballong
  // fylld med samma byte packas tusen till ett — första försöket bokade
  // 56 GB och frigjorde 28. Slump går inte att packa.
  for (let o = 0; o < BIT; o += 65536) crypto.getRandomValues(new Uint8Array(b.buffer, o, 65536));
  ballonger.push(b);
}
process.stderr.write(`ballong: ${ballonger.length} GB · ledigt nu: ${ledigt().toFixed(1)} GB\n`);
console.log('KLAR');
setInterval(() => { for (const b of ballonger) b[0] = b[0] ^ 1; }, 5000); // håll dem varma
process.on('SIGTERM', () => process.exit(0));
