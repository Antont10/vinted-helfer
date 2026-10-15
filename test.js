// Testet die Rechenlogik aus index.html. Start: TZ=Europe/Berlin node test.js
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const code=html.split('/* LOGIK-START')[1].split('/* LOGIK-END */')[0].replace(/^[^\n]*\n/,'');
const L=new Function(code+';return {addWerktage,werktageBis,vorschlag,angebotPreis,ageDays,parsePreise,preisCheck,buendel,titel,titelChecks,beschreibung,migrate,heute,round05,parseLink,linkAusText,zusammenfuehren,groesse,jahr,kategorie,markeVon,gruppen,proStunde,csv,suchLink,suchLinkSauber,sucheName,sucheSauber,suchenMischen,deal,kaufUrteil,kaufNachricht,angebotText,angebotSauber,kaufListe,kaufTipp,kiKaufAntwort,kiMitte,preisAusText,kaufStaffel,kaufFrageApp,kiAntwortAusText,KAUF_JSON,ECHT,kiOrtOk,kiStandSauber,kiZaehler,kiAntwort,kiBeschreibung,kiTitelChecks,beschrText,BESCHR_ENDE,KI_LIMIT};')();
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
// Jahreszähler (Phase 3)
const vk=(n,eur,d='2026-05-01')=>Array.from({length:n},(_,k)=>({id:k,status:'bewertet',vk:eur,verkauftAm:d}));
eq('24 Verkäufe',L.jahr(vk(24,10),2026).stufe,0);
eq('25 Verkäufe warnt',L.jahr(vk(25,10),2026).stufe,1);
eq('30 Verkäufe Meldegrenze',L.jahr(vk(30,10),2026).stufe,2);
eq('1.500 € warnt',L.jahr(vk(3,500),2026).stufe,1);
eq('2.000 € Meldegrenze',[L.jahr(vk(4,500),2026).stufe,L.jahr(vk(4,500),2026).umsatz],[2,2000]);
eq('anderes Jahr zählt nicht',L.jahr([...vk(30,10,'2025-12-31'),{status:'eingestellt',vk:99,verkauftAm:'2026-01-01'}],2026).n,0);
eq('Heute-Hinweis bis Gesehen',[L.heute(vk(25,10),{postfach:'2026-05-02',export:'2026-05-02'},'2026-05-02').map(t=>t.typ),L.heute(vk(25,10),{postfach:'2026-05-02',export:'2026-05-02',jahrHinweis:'2026:1'},'2026-05-02').length],[['jahr'],0]);
// Marke und Kategorie
eq('Kategorien',['Polo Ralph Lauren Zip-Hoodie weiß M','Jordan Air Dri-FIT Hoodie schwarz S','Nike Center Swoosh Sweatshirt creme M','Zara Poloshirt beige S','Polo Ralph Lauren Performance Weste blau L','Adidas Gi weiß A2','Lego Technic 42115','Etwas'].map(name=>L.kategorie({name})),
  ['Zip-Hoodie','Hoodie','Pullover/Sweatshirt','T-Shirt/Polo','Jacke/Weste','Kampfsport','Lego/Spiele','Sonstiges']);
eq('Marken',[L.markeVon({name:'Polo Ralph Lauren Sweatshirt grau S'}),L.markeVon({name:'Jordan Air Hoodie'}),L.markeVon({name:'Hoodie grau'}),L.markeVon({name:'x',marke:'Nike'})],['Ralph Lauren','Jordan','Ohne Marke','Nike']);
const gl=L.gruppen([{name:'Nike Hoodie',status:'verkauft',vk:30,ek:5,datum:'2026-10-01',verkauftAm:'2026-10-05'},{name:'Nike Hoodie 2',status:'eingestellt'},{name:'Zara Shirt',status:'bewertet',vk:10,datum:'2026-10-01',verkauftAm:'2026-10-03'},{name:'Idee',status:'idee'}],L.markeVon);
eq('Gruppen',gl.map(g=>[g.k,g.n,g.gewinn,g.tageSchnitt,g.offen]),[['Nike',1,25,4,1],['Zara',1,10,2,0]]);
eq('Gewinn pro Stunde',L.proStunde([{status:'verkauft',vk:20,minuten:30},{status:'verkauft',vk:10,kosten:2,minuten:30},{status:'verkauft',vk:50}]).wert,28);
eq('ohne Zeit',L.proStunde([{status:'verkauft',vk:20}]),null);
// CSV
const c=L.csv([{name:'Gi; "Adidas"',status:'verkauft',vk:16,ek:0,datum:'2026-10-10',verkauftAm:'2026-10-12'},{name:'=SUMME(A1)',status:'versendet',vk:10.5,kosten:12,verkauftAm:'2026-10-11'},{name:'Alt',status:'verkauft',vk:5,verkauftAm:'2025-12-01'}],2026).split('\r\n');
eq('CSV Kopf und BOM',c[0].startsWith('﻿Verkauft am;Artikel;Marke'),true);
eq('CSV sortiert, Komma, Schutz vor Formeln',c[1],"11.10.2026;'=SUMME(A1);'=SUMME(A1);Sonstiges;Versendet;;;10,50;0,00;12,00;-1,50;;");
eq('CSV Anführungszeichen',c[2].split(';').slice(0,1).concat(c[2].includes('"Gi; ""Adidas"""')),['12.10.2026',true]);
eq('CSV Summe',c[3],';Summe (2 Verkäufe);;;;;;26,50;0,00;12,00;14,50;;');
// Phase 5: Such-Link, Deal-Rechner, Suchen zusammenführen
eq('Such-Link',L.suchLink({marke:'Venum',typ:'Gi',groesse:'A2',max:30}),'https://www.vinted.de/catalog?search_text=Venum+Gi+A2&order=newest_first&price_to=30&currency=EUR');
eq('Such-Link ohne Preis',L.suchLink({typ:'Rashguard & Shorts'}),'https://www.vinted.de/catalog?search_text=Rashguard+%26+Shorts&order=newest_first');
eq('Such-Link leer',L.suchLink({marke:' ',max:20}),null);
eq('Suche säubern',L.sucheSauber({id:7,marke:' Nike ',typ:'Hoodie',max:'25,5',x:'<b>',geaendert:'5'}),{id:'7',marke:'Nike',typ:'Hoodie',groesse:'',max:25.5,link:'',geaendert:5});
eq('Suche ohne id',L.sucheSauber({marke:'Nike'}),null);
// 6.1: eigener Such-Link von vinted.de (Größe und Kategorie über Vinteds Filter)
const VL='https://www.vinted.de/catalog?search_text=venum%20gi&catalog[]=2656&size_ids[]=1234&brand_ids[]=99';
eq('Eigener Link säubern',L.suchLinkSauber(VL+'&time=1760540000&search_id=123&page=2&utm_source=x'),VL);
eq('Eigener Link ohne https und www',L.suchLinkSauber('vinted.de/catalog?catalog[]=5'),'https://www.vinted.de/catalog?catalog[]=5');
eq('Eigener Link aus Text',L.suchLinkSauber('Schau mal: '+VL+' danke'),VL);
eq('Eigener Link Kategorie-Seite',L.suchLinkSauber('https://www.vinted.de/catalog/2050-herren?size_ids[]=208#oben'),'https://www.vinted.de/catalog/2050-herren?size_ids[]=208');
eq('Kein Such-Link',['https://www.vinted.de/items/123-hoodie','https://www.vinted.fr/catalog?x=1','https://vinted.de.evil.com/catalog','https://www.vinted.de@evil.com/catalog','https://www.vinted.de:8080/catalog','https://www.vinted.de/catalogue','',null].map(L.suchLinkSauber),[null,null,null,null,null,null,null,null]);
eq('Such-Link mit eigenem Link',L.suchLink({marke:'Venum',link:VL}),VL+'&order=newest_first');
eq('Höchstpreis ersetzt Preis im Link',L.suchLink({link:'https://www.vinted.de/catalog?catalog[]=5&price_to=50&currency=EUR&order=price_low_to_high',max:30}),'https://www.vinted.de/catalog?catalog[]=5&order=price_low_to_high&price_to=30&currency=EUR');
eq('Link ohne Filter',L.suchLink({link:'https://www.vinted.de/catalog'}),'https://www.vinted.de/catalog?order=newest_first');
eq('Ungültiger Link nimmt Suchtext',L.suchLink({marke:'Nike',link:'https://evil.com/catalog'}),'https://www.vinted.de/catalog?search_text=Nike&order=newest_first');
eq('Name der Suche',[L.sucheName({marke:'Nike',typ:'Hoodie',link:VL}),L.sucheName({link:VL}),L.sucheName({link:'https://www.vinted.de/catalog?catalog[]=5'})],['Nike Hoodie','venum gi','Eigene Vinted-Suche']);
eq('Suche mit Link säubern',[L.sucheSauber({id:1,link:VL+'&time=1'}).link,L.sucheSauber({id:2,link:'javascript:alert(1)'}).link],[VL,'']);
const d1=L.deal({kauf:20,portoEin:4.5,vk:45,minuten:30});
eq('Deal Schutz und Kosten',[d1.schutz,d1.kosten,d1.gewinn],[1.7,26.2,18.8]);
eq('Deal pro Stunde und Ampel',[Math.round(d1.stunde*10)/10,d1.ampel],[37.6,'g']);
eq('Deal höchstens zahlen',d1.maxKauf,28);
eq('Deal Mindestgewinn knapp',[L.deal({kauf:28,portoEin:4.5,vk:45}).gewinn>=10,L.deal({kauf:28.5,portoEin:4.5,vk:45}).gewinn>=10],[true,false]);
eq('Deal gelb unter 10 €',L.deal({kauf:30,vk:40}).ampel,'y');
eq('Deal gelb unter 10 €/Std.',L.deal({kauf:10,vk:30,minuten:120}).ampel,'y');
eq('Deal rot',L.deal({kauf:30,portoEin:5,vk:30}).ampel,'r');
eq('Deal Technik 8 %',L.deal({kauf:50,schutz:8,vk:90}).schutz,4.7);
eq('Deal nichts möglich',L.deal({vk:5}).maxKauf,0);
const sm=L.suchenMischen({suchen:[{id:'1',marke:'A',geaendert:5},{id:'2',marke:'B',geaendert:5}],weg:{}},{suchen:[{id:'1',marke:'A neu',geaendert:9},{id:'3',marke:'C',geaendert:1}],weg:{'2':7}});
eq('Suchen zusammenführen',[sm.suchen.map(s=>s.marke),sm.weg],[['A neu','C'],{'2':7}]);
eq('Lösch-Vermerk älter als Änderung',L.suchenMischen({suchen:[{id:'1',geaendert:9}],weg:{}},{suchen:[],weg:{'1':3}}).suchen.length,1);
eq('Checklisten',Object.keys(L.ECHT),['kampfsport','kleidung','sneaker','technik']);
// Phase 7: Kauf-Empfehlung (kaufen, handeln, lassen), Merkliste, KI-Kauf-Check
const k1=L.kaufUrteil({kauf:30,portoEin:6,vk:55,minuten:45});
eq('Urteil kaufen',[k1.urteil,k1.angebot,k1.max],['kaufen',27,36]);
const k2=L.kaufUrteil({kauf:30,portoEin:6,vk:45,minuten:45});
eq('Urteil handeln',[k2.urteil,k2.angebot,k2.max],['handeln',23,26.5]);
eq('Urteil lassen',L.kaufUrteil({kauf:40,portoEin:6,vk:45}).urteil,'lassen');
const k4=L.kaufUrteil({kauf:20,portoEin:6,vk:45,minuten:120});
eq('Höchstpreis hält 10 € pro Stunde ein',[k4.urteil,k4.max,k4.angebot],['handeln',17,15]);
eq('Urteil ohne Verkaufspreis',L.kaufUrteil({kauf:20}).urteil,null);
eq('Leeres Feld zählt als Standard',[L.deal({kauf:20,schutz:null,vk:40}).schutz,L.deal({kauf:20,vk:40,minGewinn:null}).maxKauf],[1.7,27.5]);
eq('Nachricht Gegenangebot',L.kaufNachricht(' Venum  Gi A2 ',23),'Hallo! Ich interessiere mich für „Venum Gi A2“. Wäre 23 € für dich okay? Dann kaufe ich direkt. Viele Grüße');
eq('Nachricht ohne Name, mit Cent',L.kaufNachricht('',22.5),'Hallo! Ich interessiere mich für deinen Artikel. Wäre 22,50 € für dich okay? Dann kaufe ich direkt. Viele Grüße');
eq('Angebotstext ohne Kontaktdaten',L.angebotText('Kaum getragen. Fragen an lisa.m@web.de oder 0176 1234 5678, mehr auf https://insta.com/x\r\n'),'Kaum getragen. Fragen an [E-Mail] oder [Nummer], mehr auf [Link]');
eq('Angebotstext lässt Maße stehen',L.angebotText('Länge 72 cm, Breite 55 cm, Größe A2, Gr. 152 164'),'Länge 72 cm, Breite 55 cm, Größe A2, Gr. 152 164');
eq('Angebot säubern',L.angebotSauber({id:5,was:'  Venum   Gi ',link:'https://www.vinted.de/items/123-venum-gi?ref=x',kauf:'30',vk:55,schutz:'',minuten:'45',x:1,geaendert:'7'}),
  {id:'5',was:'Venum Gi',link:'https://www.vinted.de/items/123-venum-gi',kauf:30,schutz:null,portoEin:null,portoAus:null,vk:55,minuten:45,minGewinn:null,kiVon:null,kiBis:null,kiText:'',geaendert:7});
eq('Angebot ohne Namen',L.angebotSauber({id:1,was:' '}),null);
const as=L.angebotSauber({id:1,was:'x',link:'https://evil.com/items/1',kauf:-5});
eq('Angebot fremder Link, negativer Preis',[as.link,as.kauf],['',null]);
const kl=L.kaufListe([{id:'a',was:'Lassen',kauf:40,portoEin:6,vk:45},{id:'b',was:'Handeln',kauf:30,portoEin:6,vk:45,minuten:45},{id:'c',was:'Kaufen klein',kauf:30,portoEin:6,vk:50,minuten:45},{id:'d',was:'Kaufen groß',kauf:30,portoEin:6,vk:55,minuten:45}]);
eq('Merkliste sortiert',kl.map(x=>x.a.was),['Kaufen groß','Kaufen klein','Handeln','Lassen']);
eq('Merkliste rechnet Handeln mit dem Angebot',[kl[2].preis,Math.round(kl[2].gewinn*100)/100],[23,14.15]);
const tp=L.kaufTipp([{id:1,name:'Nike Hoodie grau',status:'verkauft',vk:30,datum:'2026-10-08',verkauftAm:'2026-10-12'},{id:2,name:'Ralph Lauren Sweatshirt',status:'versendet',vk:55,datum:'2026-10-10',verkauftAm:'2026-10-11'},{id:3,name:'Uniqlo Jacke',status:'eingestellt',preis:20,datum:'2026-10-10'}]);
eq('Tipp aus deinen Verkäufen',[tp.schnell.k,tp.marke.k],['Pullover/Sweatshirt','Ralph Lauren']);
eq('Tipp ohne Verkäufe',L.kaufTipp([]),{schnell:null,marke:null});
eq('KI-Kauf-Antwort säubern',L.kiKaufAntwort({marke:' Venum ',verkauf_von:60,verkauf_bis:'45',nachfrage:'hoch',einschaetzung:'Gute Marke.\nLohnt sich.',echtheit:['Patch gestickt','',5],fragen:['a','b','c','d'],risiken:[]}),
  {marke:'Venum',artikel:'',von:45,bis:60,nachfrage:'hoch',einschaetzung:'Gute Marke. Lohnt sich.',echtheit:['Patch gestickt'],fragen:['a','b','c'],risiken:[],stand:null});
eq('KI-Kauf-Antwort nur ein Preis',[L.kiKaufAntwort({verkauf_bis:50}).von,L.kiKaufAntwort({verkauf_von:50,nachfrage:'egal'}).nachfrage],[50,'']);
eq('KI-Kauf-Antwort leer',[L.kiKaufAntwort({einschaetzung:''}),L.kiKaufAntwort('x')],[null,null]);
eq('Mitte der Schätzung',[L.kiMitte({von:45,bis:60}),L.kiMitte({von:0,bis:0})],[52.5,null]);
// Version 7.1: Kauf-Check füllt sich selbst aus
eq('Preis aus Text',L.preisAusText('Venum Gi A2\nSehr gut\n25,00 €\n27,95 €\nInklusive Käuferschutz\nVersand ab 3,49 €'),{preis:25,porto:3.49});
eq('Preis mit Käuferschutz zuerst',L.preisAusText('26,95 €\n25,00 €'),{preis:25,porto:null});
eq('Preis mit Zusatz in der Zeile',L.preisAusText('32,20 € inkl. Käuferschutz\nPreis: 30 €'),{preis:30,porto:null});
eq('Neupreis zählt nicht',L.preisAusText('Neupreis 120 €, kaum getragen.\nPreis 45 €'),{preis:45,porto:null});
eq('Versand in eigener Zeile',L.preisAusText('Versand ab\n4,29 €\n€18.50'),{preis:18.5,porto:4.29});
eq('Tausender und Euro-Wort',[L.preisAusText('1.200,00 €').preis,L.preisAusText('Preis 40 Euro').preis],[1200,40]);
eq('Kein Preis im Text',[L.preisAusText('Größe A2, 72 cm lang'),L.preisAusText(''),L.preisAusText(null)],[null,null,null]);
const st=L.kaufStaffel({vk:50,portoEin:5});
eq('Staffel ohne Kaufpreis',st,{max:32.5,handelnBis:43});
eq('Staffel passt zum Urteil',[L.kaufUrteil({vk:50,portoEin:5,kauf:st.max}).urteil,L.kaufUrteil({vk:50,portoEin:5,kauf:st.handelnBis}).urteil,L.kaufUrteil({vk:50,portoEin:5,kauf:st.handelnBis+1}).urteil],['kaufen','handeln','lassen']);
eq('Staffel ohne Verkaufspreis oder Gewinn',[L.kaufStaffel({}),L.kaufStaffel({vk:8})],[{max:0,handelnBis:0},{max:0,handelnBis:0}]);
const fr=L.kaufFrageApp({was:'  Venum  Gi A2 ',preis:30,text:'Kaum getragen, schreib an lisa@web.de, https://insta.com/x'});
eq('Frage für die Claude-App',[fr.includes(L.KAUF_JSON),fr.includes('Angebot: Venum Gi A2'),fr.includes('Preis: 30,00 €'),fr.includes('lisa@web.de'),fr.includes('insta.com'),fr.includes('[E-Mail]')],[true,true,true,false,false,true]);
eq('Frage ohne Name und Preis',[L.kaufFrageApp({}).includes('(kein Name, siehe Foto)'),L.kaufFrageApp({}).includes('Preis: unbekannt')],[true,true]);
const aw='Hier ist die Einschätzung:\n```json\n{"marke":"Venum","artikel":"Contender Gi","verkauf_von":35,"verkauf_bis":50,"nachfrage":"mittel","einschaetzung":"Lohnt sich.","echtheit":[],"fragen":["Maße?"],"risiken":[]}\n```';
eq('Antwort aus der App lesen',[L.kiAntwortAusText(aw).bis,L.kiAntwortAusText(aw).marke,L.kiAntwortAusText(aw).fragen],[50,'Venum',['Maße?']]);
eq('Antwort aus der App kaputt',[L.kiAntwortAusText('kein JSON'),L.kiAntwortAusText('{kaputt}'),L.kiAntwortAusText('{"titel":"x"}'),L.kiAntwortAusText(null)],[null,null,null,null]);
// Phase 6: KI-Vorschlag
eq('KI erlaubte Adressen',['https://antont10.github.io','http://localhost:8765','http://127.0.0.1:8766','https://evil.com','null','http://antont10.github.io','https://antont10.github.io.evil.com'].map(L.kiOrtOk),[true,true,true,false,false,false,false]);
eq('KI Zähler aktueller Monat',L.kiZaehler({monat:'2026-10',n:7,limit:50},'2026-10-15'),{monat:'2026-10',n:7,limit:50,rest:43,bekannt:true});
eq('KI Zähler neuer Monat beginnt bei 0',L.kiZaehler({monat:'2026-09',n:99,limit:100},'2026-10-01'),{monat:'2026-10',n:0,limit:100,rest:100,bekannt:true});
eq('KI Zähler unbekannt: Standard 100',L.kiZaehler(null,'2026-10-15'),{monat:'2026-10',n:0,limit:100,rest:100,bekannt:false});
eq('KI Zähler über der Grenze',L.kiZaehler({monat:'2026-10',n:120,limit:100},'2026-10-15').rest,0);
eq('KI Stand prüfen',[L.kiStandSauber({monat:'x',n:1,limit:5}),L.kiStandSauber({monat:'2026-10',n:1,limit:0}),L.kiStandSauber({monat:'2026-10',n:'1',limit:5}),L.kiStandSauber({monat:'2026-10',n:-3,limit:5})],[null,null,null,{monat:'2026-10',n:0,limit:5}]);
const ka=L.kiAntwort({titel:'  Nike   Hoodie grau Gr. M ',beschreibung:'Zeile 1\r\nZeile\u0007 2 ',fehlt:['Größe','',5,'Material'],stand:{monat:'2026-10',n:3,limit:100},extra:'ignoriert'});
eq('KI Antwort säubern',ka,{titel:'Nike Hoodie grau Gr. M',beschreibung:'Zeile 1\nZeile 2',fehlt:['Größe','Material'],stand:{monat:'2026-10',n:3,limit:100}});
eq('KI Antwort ohne Titel oder Text',[L.kiAntwort({titel:'',beschreibung:'x'}),L.kiAntwort({titel:'x'}),L.kiAntwort('text'),L.kiAntwort(null),L.kiAntwort({titel:5,beschreibung:6})],[null,null,null,null,null]);
eq('KI Antwort kürzt',[L.kiAntwort({titel:'a'.repeat(300),beschreibung:'b'.repeat(5000)}).titel.length,L.kiAntwort({titel:'a',beschreibung:'b'.repeat(5000)}).beschreibung.length,L.kiAntwort({titel:'a',beschreibung:'b',fehlt:Array(20).fill('x')}).fehlt.length],[120,2000,8]);
eq('KI Beschreibung bekommt den Versand-Schluss',L.kiBeschreibung(' Zeile 1 '),'Zeile 1\n'+L.BESCHR_ENDE);
eq('Baukasten-Text endet gleich',L.beschreibung({typ:'Gi'}).endsWith(L.BESCHR_ENDE),true);
eq('KI-Titel gut',L.kiTitelChecks('Nike Hoodie grau Gr. M neu mit Etikett').map(c=>c[0]),['g']);
eq('KI-Titel Großbuchstaben und zu lang',[L.kiTitelChecks('NIKE HOODIE grau Gr. M').some(c=>c[0]==='y'),L.kiTitelChecks('Polo Ralph Lauren Zip-Hoodie Tie-Dye Pony navy Kindergröße Gr. XL sehr gut erhalten').some(c=>/Zeichen/.test(c[1]))],[true,true]);
eq('KI-Titel fremde Marke',L.kiTitelChecks('Hoodie wie Nike Gr. M').some(c=>c[0]==='r'),true);
eq('eigene Beschreibung gewinnt',[L.beschrText({typ:'Hoodie',beschr:'Eigener Text'}),L.beschrText({marke:'Nike',typ:'Hoodie',beschr:'  '}).startsWith('Nike Hoodie')],['Eigener Text',true]);
eq('Beschreibung bleibt beim Import',L.migrate([{id:1,name:'a',beschr:'Text'}])[0].beschr,'Text');
eq('Standard-Grenze 100',L.KI_LIMIT,100);
console.log(`${ok} ok, ${fail} Fehler`);process.exit(fail?1:0);
