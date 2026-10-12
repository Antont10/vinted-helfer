// Testet die Rechenlogik aus index.html. Start: TZ=Europe/Berlin node test.js
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const code=html.split('/* LOGIK-START')[1].split('/* LOGIK-END */')[0].replace(/^[^\n]*\n/,'');
const L=new Function(code+';return {addWerktage,werktageBis,vorschlag,angebotPreis,ageDays,parsePreise,preisCheck,buendel,titel,titelChecks,beschreibung,migrate,heute,round05,parseLink,linkAusText,zusammenfuehren,groesse};')();
let ok=0,fail=0;
const eq=(name,a,b)=>{const s=JSON.stringify(a)===JSON.stringify(b);s?ok++:fail++;if(!s)console.log('FEHLER',name,'ist',a,'soll',b)};
// Versandfrist 5 Werktage
eq('Mo+5WT',L.addWerktage('2026-10-12',5),'2026-10-19');
eq('Fr+5WT',L.addWerktage('2026-10-16',5),'2026-10-23');
eq('WT bis',L.werktageBis('2026-10-12','2026-10-19'),5);
eq('WT gleich',L.werktageBis('2026-10-19','2026-10-19'),0);
eq('WT drüber',L.werktageBis('2026-10-20','2026-10-19'),-1);
eq('WT Sa nach Fr',L.werktageBis('2026-10-17','2026-10-16'),-1);
// Zeitumstellung 28.03.2027
eq('Alter über Zeitumstellung',L.ageDays('2027-03-27','2027-03-29'),2);
// Preisvorschlag
const it={preis:20,start:20,min:15,datum:'2026-10-01'};
eq('Vorschlag 6 Tage',L.vorschlag(it,'2026-10-07'),20);
eq('Vorschlag 14 Tage',L.vorschlag(it,'2026-10-15'),18);
eq('Vorschlag 21 Tage',L.vorschlag(it,'2026-10-22'),17);
eq('Vorschlag nie unter Min',L.vorschlag(it,'2026-11-12'),15);
eq('Angebot 10 %',L.angebotPreis(it,10),18);
eq('Angebot Min greift',L.angebotPreis(it,30),15);
// Preis-Check
eq('Preise lesen',L.parsePreise('25 30 22,50; 28'),[25,30,22.5,28]);
const pc=L.preisCheck([20,25,30],25);
eq('Preis-Check',[pc.mittel,pc.median,pc.vorschlag,pc.diff],[25,25,21.5,0]);
eq('Median gerade',L.preisCheck([10,20,30,40]).median,25);
// Bündel
const b=[{preis:20,min:15},{preis:10,min:8}];
eq('Bündel 15 %',L.buendel(b,15).preis,25.5);
eq('Bündel Min greift',[L.buendel(b,30).preis,L.buendel(b,30).bodenGreift],[23,true]);
// Titel
const t={marke:'Nike',typ:'Hoodie',farbe:'grau',groesse:'M',zustand:'Neu mit Etikett'};
eq('Titel',L.titel(t),'Nike Hoodie grau Gr. M neu mit Etikett');
eq('Titel gut',L.titelChecks(t,L.titel(t)).map(c=>c[0]),['g']);
eq('wie neu ok',L.titelChecks({...t,extra:'wie neu'},'Nike Hoodie grau Gr. M wie neu').map(c=>c[0]),['g']);
eq('fremde Marke',L.titelChecks(t,'Hoodie grau wie Nike Gr. M').some(c=>c[0]==='r'),true);
// Phase-1-Daten übernehmen
const m=L.migrate([{id:1,name:'Alt',status:'aktiv',datum:'2026-10-01',preis:10,start:10,min:10},null,{name:''}]);
eq('Migration',[m.length,m[0].status,m[0].gelistet,m[1].name],[2,'eingestellt','2026-10-01','Ohne Namen']);
// Heute-Liste
const items=[
 {id:1,name:'Hoodie',status:'verkauft',verkauftAm:'2026-10-12'},
 {id:2,name:'Gi',status:'eingestellt',preis:30,start:30,min:20,datum:'2026-10-01',gelistet:'2026-10-05',interessentAm:'2026-10-13'},
 {id:3,name:'Lego',status:'idee'}
];
const H=L.heute(items,{postfach:'2026-10-16'},'2026-10-16');
eq('Heute Reihenfolge',H.map(x=>x.typ),['versand','nach','senk','relist','foto','export']);
eq('Versand knapp ist rot',H[0].rot,true);
// Vinted-Link
const pl=L.parseLink('https://www.vinted.de/items/4567890123-nike-hoodie-grau?referrer=catalog');
eq('Link gekürzt',[pl.link,pl.name],['https://www.vinted.de/items/4567890123-nike-hoodie-grau','Nike Hoodie Grau']);
eq('Link ohne www',L.parseLink('https://vinted.de/items/123').link,'https://www.vinted.de/items/123');
eq('fremder Link',L.parseLink('https://evil.com/items/123'),null);
eq('javascript-Link',L.parseLink('javascript:alert(1)'),null);
eq('Vinted-Katalog kein Artikel',L.parseLink('https://www.vinted.de/catalog?search_text=nike'),null);
eq('doppelte IDs',L.migrate([{id:1,name:'a'},{id:1,name:'b'}]).map(i=>i.id).filter((x,i,a)=>a.indexOf(x)!==i).length,0);
// Link aus geteiltem Text (Phase 4)
eq('Link aus Text',L.linkAusText('Schau mal: https://www.vinted.de/items/42-gi-weiss?utm_source=app toll').link,'https://www.vinted.de/items/42-gi-weiss');
eq('erst fremder, dann Vinted-Link',L.linkAusText('https://evil.com/x https://vinted.de/items/7').id,'7');
eq('Text ohne Link',L.linkAusText('nur Text'),null);
// Zusammenführen (Phase 4)
const lok={items:[{id:1,name:'A alt',geaendert:100},{id:2,name:'B',geaendert:300},{id:3,name:'C',geaendert:100},{id:5,name:'E'}],geloescht:{},bilder:{1:'bild-a-alt',2:'bild-b'}};
const imp={items:[{id:1,name:'A neu',geaendert:200},{id:2,name:'B alt',geaendert:250},{id:4,name:'D',geaendert:50},{id:5,name:'E2'}],geloescht:{3:150,9:10},bilder:{1:'bild-a-neu',4:'bild-d'}};
const z=L.zusammenfuehren(lok,imp);
eq('neuere Änderung gewinnt',z.items.map(i=>i.name),['A neu','B','E','D']);
eq('Zahlen',[z.neu,z.aktualisiert,z.entfernt],[1,1,1]);
eq('Bild folgt dem Gewinner',z.bilder,{1:'bild-a-neu',2:'bild-b',4:'bild-d'});
eq('Lösch-Vermerke vereint',z.geloescht,{3:150,9:10});
eq('Änderung nach Löschen bleibt',L.zusammenfuehren({items:[{id:3,name:'C',geaendert:200}]},{geloescht:{3:150}}).items.length,1);
const zf=L.zusammenfuehren({items:[{id:1,name:'Gi',preis:30,geaendert:100,bildAm:100}],bilder:{1:'foto-iphone'}},{items:[{id:1,name:'Gi',preis:25,geaendert:200}],bilder:{}});
eq('Foto bleibt, wenn anderswo der Preis neuer ist',[zf.items[0].preis,zf.items[0].bildAm,zf.bilder[1]],[25,100,'foto-iphone']);
eq('Foto entfernt ist neuer',L.zusammenfuehren({items:[{id:1,geaendert:100,bildAm:100}],bilder:{1:'f'}},{items:[{id:1,geaendert:300,bildAm:300}],bilder:{}}).bilder,{});
eq('in leeren Helfer',L.zusammenfuehren({items:[]},{items:[{id:1,name:'X'}]}).neu,1);
eq('Größe',[L.groesse(500),L.groesse(184320),L.groesse(2621440)],['1 KB','180 KB','2,5 MB']);
console.log(`${ok} ok, ${fail} Fehler`);process.exit(fail?1:0);
