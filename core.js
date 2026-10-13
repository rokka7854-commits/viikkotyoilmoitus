export const TASKS = ['Keräily','Pakkaaminen','Vastaanotto','Hyllytys','Lähettäminen','Siivous','Perehdytettävänä','Terminaalityöt','Trukkityöskentely','Järjestely','Muu mikä'];
export const ABSENCES = ['Poissa','Vapaa','Sairas'];
const LEGACY_TASKS=['Trukin käyttö','Sisäiset siirrot','Inventointi','Varaston järjestely','Muu työtehtävä','Muu poissaolo'];
// Sisälogistiikan osaamisala; sama valikoima kuin LogPT-sovelluksessa.
export const UNITS = [
  ['Logistiikka-alan työympäristössä toimiminen',15,'Pakolliset'],
  ['Tavaran vastaanotto ja säilyttäminen',30,'Pakolliset'],
  ['Tavaran keräily ja pakkaaminen',30,'Pakolliset'],
  ['Tavarankäsittelylaitteiden käyttö ja trukinkuljettajana työskentely',25,'Pakolliset'],
  ['Dronen ohjaaminen',5,'Valinnaiset'],['Inventointi',10,'Valinnaiset'],
  ['Kuormalavahyllyn tarkistaminen',10,'Valinnaiset'],['Tavaran lähettäminen',20,'Valinnaiset'],
  ['Luvanvaraisten tavaroiden varastoiminen',10,'Valinnaiset'],['Terminaalissa toimiminen',25,'Valinnaiset'],
  ['Vaarallisten aineiden käsitteleminen',15,'Valinnaiset'],['Tavaran kuljettaminen',15,'Valinnaiset']
];
export const DAY_NAMES = ['Maanantai','Tiistai','Keskiviikko','Torstai','Perjantai','Lauantai','Sunnuntai'];
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  const y=d.getUTCFullYear();
  return {year:y,week:Math.ceil((((d-new Date(Date.UTC(y,0,1)))/86400000)+1)/7)};
}
export function weekDays(year,week) {
  if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(week)||week<1||week>53) throw Error('Valitse kelvollinen vuosi ja viikko.');
  const d = new Date(Date.UTC(year,0,4)); d.setUTCDate(d.getUTCDate()-(d.getUTCDay()||7)+1+(week-1)*7);
  if(isoWeek(new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())).year!==year) throw Error('Tässä vuodessa ei ole viikkoa 53.');
  return Array.from({length:7},(_,i)=>{const n=new Date(d);n.setUTCDate(d.getUTCDate()+i);return n.toISOString().slice(0,10);});
}
export function emptyWeek(year,week) { return {year,week,days:weekDays(year,week).slice(0,5).map(date=>({date,tasks:[],hours:'',absenceHours:'',note:''})),reflection:''}; }
export function validatePeriod(profile) {
  const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  if(!valid(profile.periodStart)||!valid(profile.periodEnd)||profile.periodStart>profile.periodEnd)throw Error('Valitse jakson alku- ja loppupäivä oikeassa järjestyksessä.');
}
export function requiredDates(w,profile) {
  validatePeriod(profile);
  return weekDays(w.year,w.week).slice(0,5).filter(d=>d>=profile.periodStart&&d<=profile.periodEnd);
}
// Reminders follow Finnish local time, regardless of the device's time zone.
// This only calculates what to show when the app is visible; it schedules no push.
export function pendingApprovalReminders(state, instant = new Date()) {
  const profile=state.profile;
  try { validatePeriod(profile); } catch { return []; }
  if(profile.periodStart<'2000-01-01'||profile.periodEnd>'2100-12-31')return [];
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Helsinki',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(p=>[p.type,p.value]));
  const today=`${parts.year}-${parts.month}-${parts.day}`,clock=Number(parts.hour)*60+Number(parts.minute);
  const monday=new Date(profile.periodStart+'T12:00:00Z');
  monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()||7)+1);
  if(monday.getUTCFullYear()<2000)monday.setUTCDate(monday.getUTCDate()+7);
  const reminders=[];
  while(monday.toISOString().slice(0,10)<=profile.periodEnd&&monday.toISOString().slice(0,10)<=today){
    const w=isoWeek(new Date(monday.getUTCFullYear(),monday.getUTCMonth(),monday.getUTCDate()));
    const days=weekDays(w.year,w.week).slice(0,5),key=`${w.year}-W${w.week}`;
    const friday=days[4],nextMonday=new Date(monday);nextMonday.setUTCDate(nextMonday.getUTCDate()+7);
    const followupDate=nextMonday.toISOString().slice(0,10);
    const due=today>friday||(today===friday&&clock>=600);
    if(due&&!state.approved?.[key]&&days.some(d=>d>=profile.periodStart&&d<=profile.periodEnd)){
      reminders.push({key,year:w.year,week:w.week,followup:today>followupDate||(today===followupDate&&clock>=600)});
    }
    monday.setUTCDate(monday.getUTCDate()+7);
  }
  return reminders;
}
export function validateDay(d) {
  if(!d||!Array.isArray(d.tasks)||!d.tasks.length)throw Error('Valitse vähintään yksi tehtävä tai poissaolo.');
  if(d.tasks.some(t=>![...TASKS,...ABSENCES,...LEGACY_TASKS].includes(t)))throw Error('Tuntematon työtehtävä.');
  const abs=d.tasks.filter(t=>ABSENCES.includes(t));
  if(abs.length&&(d.tasks.length!==1||Number(d.hours)!==0))throw Error('Poissa, vapaa ja sairas valitaan yksin, ja tunnit ovat 0.');
  const h=Number(d.hours);
  if(d.hours===''||!Number.isFinite(h)||h<0||h>24)throw Error('Anna päivän tunnit väliltä 0–24.');
  if(d.tasks.includes('Muu mikä')&&!String(d.note||'').trim())throw Error('Kerro, mikä muu työtehtävä oli.');
}
export function validateComplete(w,profile) {
  const dates=requiredDates(w,profile);
  if(!dates.length)throw Error('Tämä viikko ei kuulu työssäoppimisjaksoon.');
  for(const date of dates){const d=w.days.find(d=>d.date===date);if(!d?.tasks.length)throw Error('Kirjaa kaikki jaksoon kuuluvat arkipäivät ennen hyväksyntää.');validateDay(d);}
  return dates;
}
export function totals(w) { return w.days.reduce((a,d)=>({work:a.work+Number(d.hours||0),absence:a.absence+Number(d.absenceHours||0),days:a.days+(d.tasks.length?1:0)}),{work:0,absence:0,days:0}); }
export function validateWeek(w) { weekDays(w.year,w.week); for(const d of w.days){const h=Number(d.hours||0),a=Number(d.absenceHours||0);if(!Number.isFinite(h)||!Number.isFinite(a)||h<0||a<0||h+a>24)throw Error('Päivän työtuntien ja poissaolotuntien tulee olla yhteensä 0–24 tuntia.');if((h>0||a>0||d.note.trim())&&!d.tasks.length)throw Error('Valitse tehtävä tai poissaolo jokaiselle päivälle, jolla on kirjauksia.');}if(!w.days.some(d=>d.tasks.length))throw Error('Kirjaa vähintään yhden päivän tehtävät tai poissaolo.'); }
export function validateBundle(raw) {
  if(!raw||raw.format!=='viikkotyokirja'||![1,2,3].includes(raw.version)||!['pending','approved'].includes(raw.status))throw Error('Tiedosto ei ole tämän sovelluksen viikkoilmoitus.');
  const profile={};for(const k of ['student','studentEmail','education','group','workplace','supervisor','supervisorEmail','teacher','teacherEmail','periodStart','periodEnd']){if(raw.profile?.[k]!=null&&typeof raw.profile[k]!=='string')throw Error('Perustiedoissa on virhe.');profile[k]=(raw.profile?.[k]||'').slice(0,300);}
  profile.units=Array.isArray(raw.profile?.units)?raw.profile.units.filter(t=>UNITS.some(u=>u[0]===t)):[];
  const dates=weekDays(raw.week?.year,raw.week?.week);
  if(!Array.isArray(raw.week.days)||!(raw.version===3?raw.week.days.length>=1&&raw.week.days.length<=5:[5,7].includes(raw.week.days.length))||(raw.version===2&&raw.week.days.length!==5))throw Error('Viikosta puuttuu päiviä.');
  const week={year:raw.week.year,week:raw.week.week,reflection:String(raw.week.reflection||'').slice(0,2000),days:raw.week.days.map((d,i)=>{
    if(!(raw.version===3?dates.slice(0,5).includes(d.date):d.date===dates[i])||!Array.isArray(d.tasks)||d.tasks.some(t=>![...TASKS,...ABSENCES,...LEGACY_TASKS].includes(t)))throw Error('Päivän tiedot eivät ole kelvollisia.');
    return {date:d.date,tasks:[...new Set(d.tasks)],hours:d.hours??'',absenceHours:d.absenceHours??'',note:String(d.note||'').slice(0,2000)};
  })}; validateWeek(week);
  if(new Set(week.days.map(d=>d.date)).size!==week.days.length)throw Error('Viikossa on sama päivä kahdesti.');
  week.days.sort((a,b)=>a.date.localeCompare(b.date));
  if(raw.version===3){const required=validateComplete(week,profile);if(week.days.length!==required.length)throw Error('Viikon päivät eivät vastaa jakson päivämääriä.');}
  const result={format:'viikkotyokirja',version:raw.version,id:String(raw.id||'').slice(0,100),status:raw.status,profile,week,createdAt:String(raw.createdAt||'')};
  if(raw.status==='approved') {
    const a=raw.approval;
    if(!a||typeof a.name!=='string'||!a.name.trim()||!Array.isArray(a.signature)||a.signature.length===0||a.signature.length>100||!Number.isFinite(Date.parse(a.at)))throw Error('Hyväksynnän tiedot puuttuvat.');
    let count=0;const sig=a.signature.map(s=>{if(!Array.isArray(s)||s.length<2)throw Error('Allekirjoitus on virheellinen.');return s.map(p=>{if(!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1)||++count>10000)throw Error('Allekirjoitus on virheellinen.');return p;});});
    if(raw.version===3&&(!Number.isInteger(a.rating)||a.rating<1||a.rating>5))throw Error('Valitse viikkoarvio 1–5.');
    result.approval={name:a.name.slice(0,300),rating:a.rating??null,feedback:String(a.feedback||'').slice(0,3000),next:String(a.next||'').slice(0,2000),at:a.at,signature:sig};
  } return result;
}
export function validateTransfer(raw){
  if(raw?.format!=='viikkotyokirja-book')return validateBundle(raw);
  if(raw.version!==1||typeof raw.bookId!=='string'||!raw.bookId||!['review','student','school'].includes(raw.target)||!Array.isArray(raw.weeks)||!raw.weeks.length||raw.weeks.length>100)throw Error('Työkirjan tiedot ovat virheellisiä.');
  const weeks=raw.weeks.map(validateBundle),keys=weeks.map(w=>`${w.week.year}-W${w.week.week}`);
  if(raw.target==='school'&&weeks.some(w=>w.status!=='approved'))throw Error('Raporttiin saa sisällyttää vain hyväksytyt viikot.');
  if(new Set(keys).size!==keys.length||weeks.some(w=>w.profile.student!==weeks[0].profile.student))throw Error('Työkirjan viikot eivät vastaa toisiaan.');
  return {format:'viikkotyokirja-book',version:1,bookId:raw.bookId.slice(0,100),target:raw.target,selectedKey:String(raw.selectedKey||keys[0]).slice(0,40),weeks};
}
function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=4096)s+=String.fromCharCode(...bytes.slice(i,i+4096));return btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export async function encodeBundle(bundle) {const bytes=new TextEncoder().encode(JSON.stringify(bundle));if(typeof CompressionStream!=='undefined'){const z=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());return 'z.'+base64(z);}return 'j.'+base64(bytes);}
export async function decodeBundle(token) { if(typeof token!=='string'||token.length>200000)throw Error('Jakolinkki on liian suuri. Avaa työkirjatiedosto.');const [type,data]=token.split('.');if(!['z','j'].includes(type)||!data)throw Error('Jakolinkki ei ole kelvollinen.');const bin=atob(data.replaceAll('-','+').replaceAll('_','/'));let bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));if(type==='z'){if(typeof DecompressionStream==='undefined')throw Error('Tämä selain ei voi avata linkkiä. Avaa työkirjatiedosto tai kokeile uudempaa selainta.');bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());}if(bytes.length>2000000)throw Error('Työkirjatiedosto on liian suuri.');return validateTransfer(JSON.parse(new TextDecoder().decode(bytes))); }
export function reportPdf(bundle) {
  const records=(bundle.format==='viikkotyokirja-book'?bundle.weeks:[bundle]).filter(b=>b.status==='approved').map(validateBundle).sort((a,b)=>a.week.year-b.week.year||a.week.week-b.week.week);
  if(!records.length)throw Error('Hyväksyttyjä viikkoja ei vielä ole.');
  const pages=[];let cmds='',y=796;
  const ascii=s=>String(s).replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7E\xA0-\xFF]/g,'?').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const page=()=>{if(cmds)pages.push(cmds);cmds='';y=796;};
  const line=(s,size=11)=>{if(y<65)page();cmds+=`BT /F1 ${size} Tf 44 ${y} Td (${ascii(s)}) Tj ET\n`;y-=size+6;};
  const text=(s,size=11)=>{const width=size>12?54:83;for(const para of String(s||'').split('\n')){let out='';for(const word of para.split(/\s+/)){if(out.length+word.length+1>width&&out){line(out,size);out='';}if(word.length>width){if(out){line(out,size);out='';}for(let i=0;i<word.length;i+=width)line(word.slice(i,i+width),size);}else out+=(out?' ':'')+word;}if(out)line(out,size);} };
  const date=d=>d.split('-').reverse().join('.');
  for(const bundle of records){
  const p=bundle.profile,w=bundle.week;
  text('TYÖSSÄOPPIMISEN VIIKKORAPORTTI',18);text(`Viikko ${w.week}/${w.year} | ${date(w.days[0].date)} - ${date(w.days.at(-1).date)}`,12);y-=7;
  for(const [label,k]of [['Opiskelija','student'],['Ryhmä','group'],['Työssäoppimispaikka','workplace'],['Työpaikkaohjaaja','supervisor'],['Kouluttaja','teacher']])if(p[k])text(`${label}: ${p[k]}`);
  if(p.units?.length)text('Tutkinnon osat: '+p.units.join(', '));
  else if(p.education)text('Koulutus: '+p.education);
  if(p.periodStart&&p.periodEnd)text(`Jakso: ${date(p.periodStart)} - ${date(p.periodEnd)}`);
  y-=12;
  w.days.forEach(d=>{if(y<170)page();text(`${DAY_NAMES[(new Date(d.date+'T12:00:00Z').getUTCDay()+6)%7]} ${date(d.date)}`,12);text(d.tasks.length?d.tasks.join(', '):'Ei kirjauksia');if(d.tasks.length||Number(d.hours))text(`Tunnit: ${String(d.hours||0).replace('.',',')} h`);if(Number(d.absenceHours))text(`Poissaolotunnit (aiempi kirjaus): ${d.absenceHours} h`);if(d.note)text(d.note);y-=10;});
  const sum=totals(w);text(`Yhteensä: ${String(sum.work).replace('.',',')} työtuntia`,12);
  if(w.reflection){y-=8;text('Opiskelijan viikon yhteenveto',12);text(w.reflection);}
  if(bundle.status==='approved'){const a=bundle.approval;if(y<260)page();y-=10;text('TYÖPAIKKAOHJAAJAN HYVÄKSYNTÄ',14);text(`Hyväksyjä: ${a.name}`);text(`Viikkoarvio: ${a.rating?`${a.rating} / 5`:'Ei kirjattu aiemmassa versiossa'}`);text(`Hyväksytty: ${new Date(a.at).toLocaleString('fi-FI',{timeZone:'Europe/Helsinki'})}`);if(a.feedback){text('Palaute',12);text(a.feedback);}if(a.next){text('Seuraavan viikon harjoittelutavoite (aiempi kirjaus)',12);text(a.next);}if(y<150)page();text('Allekirjoitus',11);const base=y-80;cmds+='q 0.08 0.16 0.25 RG 1.4 w 1 J 1 j\n';for(const stroke of a.signature){stroke.forEach(([x,py],i)=>{cmds+=`${(44+x*300).toFixed(2)} ${(base+(1-py)*80).toFixed(2)} ${i?'l':'m'}\n`;});cmds+='S\n';}cmds+='Q\n';y=base-15;text('Hyväksyjä on tarkistanut viikon tehtävät ja tunnit.');}
  else {y-=8;text('Odottaa työpaikkaohjaajan hyväksyntää.');}
  text(`Ilmoituksen tunnus: ${bundle.id}`,9);page();
  }
  const objects=['','<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];const ids=[];
  for(const content of pages){const id=objects.length;ids.push(id);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id+1} 0 R >>`);objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);}
  objects[2]=`<< /Type /Pages /Count ${ids.length} /Kids [${ids.map(i=>i+' 0 R').join(' ')}] >>`;
  let output='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=output.length;output+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}const start=output.length;output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(const n of offsets.slice(1))output+=String(n).padStart(10,'0')+' 00000 n \n';output+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new Blob([Uint8Array.from(output,c=>c.charCodeAt(0)&255)],{type:'application/pdf'});
}
