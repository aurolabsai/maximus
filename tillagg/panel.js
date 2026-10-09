/// Panelen: de två spakarna och ett rakt besked om läget.
const $ = s => document.querySelector(s);

const sag = i => {
  $('#maskera').checked = i.maskera;
  $('#hyresgast').checked = i.hyresgast;
  const lage = $('#lage');
  const om = $('#mask-om');

  if (!i.maskera) {
    om.textContent = 'Av. Texten går som du skrivit den.';
  } else if (!i.parad) {
    om.textContent = 'Kräver att tillägget parats ihop med MAXIMUS.';
  } else {
    om.textContent = 'Texten byts ut i rutan. Du skickar den själv.';
  }

  const brist = [];
  if (i.maskera && !i.parad) brist.push('Masken är på men tillägget är inte ihopparat — sändningar blockeras tills det är gjort.');
  if (i.hyresgast && !(i.workspace || i.orgIds || i.tenants)) brist.push('Spärren är på men inga id är ifyllda, så den gör ingenting.');
  lage.textContent = brist.join(' ')
    || 'Masken görs av MAXIMUS på den här datorn. Tillägget skickar texten dit och lägger tillbaka svaret.';
  lage.classList.toggle('varnar', brist.length > 0);
};

const spara = async varden => {
  await chrome.runtime.sendMessage({ typ: 'spara', varden });
  sag(await chrome.runtime.sendMessage({ typ: 'lage' }));
};

$('#maskera').onchange = e => spara({ maskera: e.target.checked });
$('#hyresgast').onchange = e => spara({ hyresgast: e.target.checked });
$('#oppna').onclick = () => chrome.runtime.openOptionsPage();

chrome.runtime.sendMessage({ typ: 'lage' }).then(sag);
