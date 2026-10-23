// Testet die Rechenlogik aus index.html. Start: TZ=Europe/Berlin node test.js
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const code=html.split('/* LOGIK-START')[1].split('/* LOGIK-END */')[0].replace(/^[^\n]*\n/,'');
const L=new Function(code+';return {datumOk,kaputteDaten,addWerktage,werktageBis,vorschlag,angebotPreis,ageDays,parsePreise,preisCheck,buendel,titel,titelChecks,beschreibung,migrate,heute,round05,parseLink,linkAusText,zusammenfuehren,groesse,jahr,kategorie,markeVon,gruppen,proStunde,csv,suchLink,suchLinkSauber,sucheName,sucheSauber,suchenMischen,deal,kaufUrteil,kaufNachricht,angebotText,angebotSauber,kaufListe,kaufTipp,kiKaufAntwort,kiMitte,preisAusText,kaufStaffel,kaufFrageApp,ECHT,kiOrtOk,kiStandSauber,kiZaehler,kiAntwort,kiBeschreibung,kiTitelChecks,beschrText,beschrMitAngaben,BESCHR_ENDE,KI_LIMIT,trendSauber,trendSinn,trendKaufListe,nameAusSlug,linkWoerter,linkPartner,trendTag,trendAlter,trendNeuer,trendName,trendMarken,trendListe,trendMax,trendTipp,trendSuche,trendAntwort,TREND_PORTO,vorschlagFrageApp,kiPreise,kiAngaben,trendFrageApp,trendSatz,claudeLink,jsonObjekte,appArt,appAntwort,vorschlagSauber,trendAusApp,APP_REGELN,NISCHEN};')();
// Nur eine Kauf-Check-Antwort, sonst null (nur für diese Tests)
const kiAntwortAusText=s=>{const r=L.appAntwort(s,Date.now());return r.art==='kauf'?r.wert:null};
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
eq('Link gekürzt',[pl.link,pl.name],['https://www.vinted.de/items/4567890123-nike-hoodie-grau','Nike Hoodie grau']);
eq('Link ohne www',L.parseLink('https://vinted.de/items/123').link,'https://www.vinted.de/items/123');
eq('fremder Link',L.parseLink('https://evil.com/items/123'),null);
eq('Fremde Endung ist kein Vinted',['https://www.vinted.top/items/1-a','vinted.xyz/items/1-a','https://vinted.de.evil.com/items/1','https://vinted.co/items/1'].map(x=>L.parseLink(x)),[null,null,null,null]);
eq('Vinted-Länder',['vinted.fr/items/1-a','https://www.VINTED.COM/items/2','vinted.co.uk/items/3','vinted.pl/items/4'].map(x=>L.parseLink(x).link),['https://www.vinted.fr/items/1-a','https://www.vinted.com/items/2','https://www.vinted.co.uk/items/3','https://www.vinted.pl/items/4']);
eq('javascript-Link',L.parseLink('javascript:alert(1)'),null);
eq('Vinted-Katalog kein Artikel',L.parseLink('https://www.vinted.de/catalog?search_text=nike'),null);
eq('doppelte IDs',L.migrate([{id:1,name:'a'},{id:1,name:'b'}]).map(i=>i.id).filter((x,i,a)=>a.indexOf(x)!==i).length,0);
// Link aus geteiltem Text (Phase 4)
eq('Link aus Text',L.linkAusText('Schau mal: https://www.vinted.de/items/42-gi-weiss?utm_source=app toll').link,'https://www.vinted.de/items/42-gi-weiss');
eq('erst fremder, dann Vinted-Link',L.linkAusText('https://evil.com/x https://vinted.de/items/7').id,'7');
eq('Text ohne Link',L.linkAusText('nur Text'),null);
// iPhone-Fix: Links ohne https://, aber nie aus einer fremden Adresse
eq('Link ohne https',L.parseLink('vinted.de/items/123-nike-hoodie').link,'https://www.vinted.de/items/123-nike-hoodie');
eq('Link ohne https im Text',L.linkAusText('Schau mal: www.vinted.de/items/987-gi-a2?share=1 ok').id,'987');
eq('Adresse in fremdem Link zählt nicht',[L.linkAusText('https://evil.com/vinted.de/items/5'),L.linkAusText('evil.com/vinted.de/items/5'),L.parseLink('https://evil.com/vinted.de/items/5')],[null,null,null]);
eq('Link mit Werbe-Anhang',L.linkAusText('https://www.vinted.de/items/4567-polo?referrer=catalog&utm_source=ios_app').link,'https://www.vinted.de/items/4567-polo');
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
eq('Kategorien',['Polo Ralph Lauren Zip-Hoodie weiß L','Jordan Air Flex-Dry Hoodie rot L','Nike Club Logo Sweatshirt beige M','Zara Poloshirt rosa S','Polo Ralph Lauren Fleece Weste grau L','Adidas Gi weiß A2','Lego Technic 42115','Etwas'].map(name=>L.kategorie({name})),
  ['Zip-Hoodie','Hoodie','Pullover/Sweatshirt','T-Shirt/Polo','Jacke/Weste','Kampfsport','Lego/Spiele','Sonstiges']);
eq('Marken',[L.markeVon({name:'Polo Ralph Lauren Sweatshirt blau S'}),L.markeVon({name:'Jordan Air Hoodie'}),L.markeVon({name:'Hoodie grau'}),L.markeVon({name:'x',marke:'Nike'})],['Ralph Lauren','Jordan','Ohne Marke','Nike']);
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
eq('Such-Link',L.suchLink({marke:'Venum',typ:'Gi',groesse:'A2',max:30}),'https://www.vinted.de/catalog?search_text=Venum%20Gi%20A2&order=newest_first&price_to=30&currency=EUR');
eq('Such-Link ohne Preis',L.suchLink({typ:'Rashguard & Shorts'}),'https://www.vinted.de/catalog?search_text=Rashguard%20%26%20Shorts&order=newest_first');
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
eq('Angebotstext lässt Größenreihen, Maße und Datum stehen',L.angebotText('Größen 152 / 158 / 164, Brust 52 54 56 58 60 cm, gekauft 2024-10-23'),'Größen 152 / 158 / 164, Brust 52 54 56 58 60 cm, gekauft 2024-10-23');
eq('Angebotstext nimmt Nummern mit 0, 00 und +',L.angebotText('Tel 030 12345678, 0049 176 1234567, +49 (0)176 1234567'),'Tel [Nummer], [Nummer], [Nummer]');
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
  {marke:'Venum',artikel:'',von:45,bis:60,titel:'',beschreibung:'',nachfrage:'hoch',einschaetzung:'Gute Marke. Lohnt sich.',echtheit:['Patch gestickt'],fragen:['a','b','c'],risiken:[],stand:null});
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
eq('Preis und Versand in einer Zeile',[L.preisAusText('Venum Contender Gi A2, kaum getragen. 30,00 € Versand ab 3,99 €'),L.preisAusText('30,00 € · 31,50 € inkl. Käuferschutz · Versand ab 3,99 €'),L.preisAusText('Neupreis 120 €, jetzt 45 € Versand 4,49 €')],
  [{preis:30,porto:3.99},{preis:30,porto:3.99},{preis:45,porto:4.49}]);
eq('Nur Versand in der Zeile bleibt Porto',L.preisAusText('Versand ab 3,49 €\n25 €'),{preis:25,porto:3.49});
eq('Kein Preis im Text',[L.preisAusText('Größe A2, 72 cm lang'),L.preisAusText(''),L.preisAusText(null)],[null,null,null]);
const st=L.kaufStaffel({vk:50,portoEin:5});
eq('Staffel ohne Kaufpreis',st,{max:32.5,handelnBis:43});
eq('Staffel passt zum Urteil',[L.kaufUrteil({vk:50,portoEin:5,kauf:st.max}).urteil,L.kaufUrteil({vk:50,portoEin:5,kauf:st.handelnBis}).urteil,L.kaufUrteil({vk:50,portoEin:5,kauf:st.handelnBis+1}).urteil],['kaufen','handeln','lassen']);
eq('Staffel ohne Verkaufspreis oder Gewinn',[L.kaufStaffel({}),L.kaufStaffel({vk:8})],[{max:0,handelnBis:0},{max:0,handelnBis:0}]);
const fr=L.kaufFrageApp({was:'  Venum  Gi A2 ',preis:30,text:'Kaum getragen, schreib an lisa@web.de, https://insta.com/x'});
eq('Frage für die Claude-App',[fr.includes('{"marke":"...","artikel":"...","verkauf_von":0,"verkauf_bis":0,"nachfrage":"hoch|mittel|niedrig","einschaetzung":"...","echtheit":["..."],"fragen":["..."],"risiken":["..."],"titel":"...","beschreibung":"..."}'),fr.includes('Angebot: Venum Gi A2'),fr.includes('Preis: 30,00 €'),fr.includes('lisa@web.de'),fr.includes('insta.com'),fr.includes('[E-Mail]')],[true,true,true,false,false,true]);
eq('Frage ohne Name und Preis',[L.kaufFrageApp({}).includes('Angebot: (kein Name, siehe Foto und Text)'),L.kaufFrageApp({}).includes('Preis: unbekannt'),L.kaufFrageApp({}).includes('(kein Text)')],[true,true,true]);
const aw='Hier ist die Einschätzung:\n```json\n{"marke":"Venum","artikel":"Contender Gi","verkauf_von":35,"verkauf_bis":50,"nachfrage":"mittel","einschaetzung":"Lohnt sich.","echtheit":[],"fragen":["Maße?"],"risiken":[]}\n```';
eq('Antwort aus der App lesen',[kiAntwortAusText(aw).bis,kiAntwortAusText(aw).marke,kiAntwortAusText(aw).fragen],[50,'Venum',['Maße?']]);
eq('Antwort aus der App kaputt',[kiAntwortAusText('kein JSON'),kiAntwortAusText('{kaputt}'),kiAntwortAusText('{"titel":"x"}'),kiAntwortAusText(null)],[null,null,null,null]);
// Phase 6: KI-Vorschlag
eq('KI erlaubte Adressen',['https://antont10.github.io','http://localhost:8765','http://127.0.0.1:8765','http://localhost:8766','https://evil.com','null','http://antont10.github.io','https://antont10.github.io.evil.com'].map(L.kiOrtOk),[true,true,true,false,false,false,false,false]);
const mg=L.migrate([{id:'x" onfocus="a',name:'a',status:'eingestellt'},{id:'<img src=x>',name:'b',status:'eingestellt'},{id:123,name:'c',status:'eingestellt'},{id:'abc-1.x_2',name:'d',status:'eingestellt'},{id:123,name:'e',status:'eingestellt'},{id:'a'.repeat(31),name:'f',status:'eingestellt'}]);
eq('IDs aus der Import-Datei: nur harmlose Zeichen',mg.map(i=>/^[\w.-]{1,30}$/.test(String(i.id))),[true,true,true,true,true,true]);
eq('Gute IDs bleiben, doppelte werden neu vergeben',[mg[2].id,mg[3].id,new Set(mg.map(i=>String(i.id))).size],[123,'abc-1.x_2',6]);
eq('KI Zähler aktueller Monat',L.kiZaehler({monat:'2026-10',n:7,limit:50},'2026-10-15'),{monat:'2026-10',n:7,limit:50,rest:43,bekannt:true});
eq('KI Zähler neuer Monat beginnt bei 0',L.kiZaehler({monat:'2026-09',n:99,limit:100},'2026-10-01'),{monat:'2026-10',n:0,limit:100,rest:100,bekannt:true});
eq('KI Zähler unbekannt: Standard 100',L.kiZaehler(null,'2026-10-15'),{monat:'2026-10',n:0,limit:100,rest:100,bekannt:false});
eq('KI Zähler über der Grenze',L.kiZaehler({monat:'2026-10',n:120,limit:100},'2026-10-15').rest,0);
eq('KI Stand prüfen',[L.kiStandSauber({monat:'x',n:1,limit:5}),L.kiStandSauber({monat:'2026-10',n:1,limit:0}),L.kiStandSauber({monat:'2026-10',n:'1',limit:5}),L.kiStandSauber({monat:'2026-10',n:-3,limit:5})],[null,null,null,{monat:'2026-10',n:0,limit:5}]);
const ka=L.kiAntwort({titel:'  Nike   Hoodie grau Gr. M ',beschreibung:'Zeile 1\r\nZeile\u0007 2 ',fehlt:['Größe','',5,'Material'],stand:{monat:'2026-10',n:3,limit:100},extra:'ignoriert'});
eq('KI Antwort säubern',ka,{titel:'Nike Hoodie grau Gr. M',beschreibung:'Zeile 1\nZeile 2',fehlt:['Größe','Material'],stand:{monat:'2026-10',n:3,limit:100},von:0,bis:0,nachfrage:''});
eq('KI Antwort ohne Titel oder Text',[L.kiAntwort({titel:'',beschreibung:'x'}),L.kiAntwort({titel:'x'}),L.kiAntwort('text'),L.kiAntwort(null),L.kiAntwort({titel:5,beschreibung:6})],[null,null,null,null,null]);
eq('KI Antwort kürzt',[L.kiAntwort({titel:'a'.repeat(300),beschreibung:'b'.repeat(5000)}).titel.length,L.kiAntwort({titel:'a',beschreibung:'b'.repeat(5000)}).beschreibung.length,L.kiAntwort({titel:'a',beschreibung:'b',fehlt:Array(20).fill('x')}).fehlt.length],[120,2000,8]);
eq('KI Beschreibung bekommt den Versand-Schluss',L.kiBeschreibung(' Zeile 1 '),'Zeile 1\n'+L.BESCHR_ENDE);
eq('Baukasten-Text endet gleich',L.beschreibung({typ:'Gi'}).endsWith(L.BESCHR_ENDE),true);
eq('KI-Titel gut',L.kiTitelChecks('Nike Hoodie grau Gr. M neu mit Etikett').map(c=>c[0]),['g']);
eq('KI-Titel Großbuchstaben und zu lang',[L.kiTitelChecks('NIKE HOODIE grau Gr. M').some(c=>c[0]==='y'),L.kiTitelChecks('Polo Ralph Lauren Zip-Hoodie Camo-Print Logo khaki Kindergröße Gr. M sehr gut erhalten').some(c=>/Zeichen/.test(c[1]))],[true,true]);
eq('KI-Titel fremde Marke',L.kiTitelChecks('Hoodie wie Nike Gr. M').some(c=>c[0]==='r'),true);
eq('eigene Beschreibung gewinnt',[L.beschrText({typ:'Hoodie',beschr:'Eigener Text'}),L.beschrText({marke:'Nike',typ:'Hoodie',beschr:'  '}).startsWith('Nike Hoodie')],['Eigener Text',true]);
eq('Beschreibung bleibt beim Import',L.migrate([{id:1,name:'a',beschr:'Text'}])[0].beschr,'Text');
eq('Standard-Grenze 100',L.KI_LIMIT,100);
// Phase 8: Trends vom KI-Proxy
const Z=Date.UTC(2026,9,16,9,0);
const TR={zeit:Z,modell:'claude-sonnet-5-5',einkauf:[
  {was:'Carhartt Detroit Jacket',marke:'Carhartt',suche:'Carhartt Detroit Jacket',warum:'Workwear ist gefragt.',verkauf_von:60,verkauf_bis:90,tempo:'mittel',nische:false},
  {was:'Stanley Becher',marke:'Stanley',suche:'Stanley Quencher',verkauf_von:15,verkauf_bis:20,tempo:'schnell'},
  {was:'Tech Fleece Hoodie',marke:'Nike',suche:'Nike Tech Fleece',verkauf_von:40,verkauf_bis:60,tempo:'schnell',nische:false},
  {was:'Venum Contender Gi',marke:'Venum',suche:'Venum Contender Gi',warum:'Neue Kurse.',verkauf_von:55,verkauf_bis:35,tempo:'schnell',nische:true},
  {was:'Vase',tempo:'langsam'}],
  einstellen:[{was:'Daunenjacken',tempo:'schnell'},{was:'Gis',tempo:'mittel',nische:true}],
  quellen:[{titel:'Vinted',url:'https://www.vinted.de/press'},{titel:'x',url:'javascript:alert(1)'},{url:'https://e.de/<b>'},{url:'http://e.de'}]};
const ts=L.trendSauber(TR);
eq('Trends säubern',[ts.einkauf.length,ts.einkauf.map(e=>e.tempo),ts.quellen,ts.einkauf[1].nische,ts.einkauf[3].verkauf_von,ts.einstellen.length],[4,['mittel','schnell','schnell','schnell'],[{titel:'Vinted',url:'https://www.vinted.de/press'}],false,35,2]);
eq('Trends ohne Zeit oder Inhalt',[L.trendSauber({...TR,zeit:'gestern'}),L.trendSauber({...TR,zeit:5}),L.trendSauber({zeit:Z,einkauf:[{was:'Vase',tempo:'langsam'}]}),L.trendSauber(null)],[null,null,null,null]);
eq('Trends: Zahl als Text oder Wahrheitswert zählt nicht',L.trendSauber({zeit:Z,einkauf:[{was:'X',verkauf_von:'30',verkauf_bis:true}]}).einkauf[0],{was:'X',marke:'',suche:'X',warum:'',verkauf_von:0,verkauf_bis:0,tempo:'mittel',nische:false});
eq('Trends kürzen',[L.trendSauber({zeit:Z,einkauf:Array(12).fill({was:'a'.repeat(200)})}).einkauf.length,L.trendSauber({zeit:Z,einkauf:[{was:'a'.repeat(200)}]}).einkauf[0].was.length],[8,80]);
eq('Trend-Alter',[L.trendTag(ts),L.trendAlter(ts,'2026-10-23')],['2026-10-16',7]);
const meine=[{name:'Nike Club Logo Sweatshirt beige M'},{name:'Uniqlo Pocketable Regenjacke'}];
eq('Marken aus meinen Artikeln',L.trendMarken(meine).includes('nike'),true);
eq('Trends: schnell zuerst, darin Nische und eigene Marke',L.trendListe(ts.einkauf,meine).map(e=>[e.marke,e.passt]),[['Nike',true],['Venum',true],['Stanley',false],['Carhartt',false]]);
eq('Trends ohne eigene Artikel',L.trendListe(ts.einkauf,[]).map(e=>e.marke),['Venum','Stanley','Nike','Carhartt']);
eq('Trend merkt sich Claudes Stelle',L.trendListe(ts.einkauf,[]).map(e=>e.i),[3,1,2,0]);
eq('Trend-Name ohne doppelte Marke',[L.trendName(ts.einkauf[2]),L.trendName(ts.einkauf[3])],['Nike Tech Fleece Hoodie','Venum Contender Gi']);
eq('Trend-Höchstpreis wie im Kauf-Check',[L.trendMax(ts.einkauf[3]),L.TREND_PORTO],[{vk:45,max:27.5,handelnBis:36.5},5]);
eq('Trend-Höchstpreis ohne Preis',L.trendMax({verkauf_von:0,verkauf_bis:0}),{vk:null,max:0,handelnBis:0});
eq('Trend-Tipp',[L.trendTipp(L.trendListe(ts.einkauf,[])).e.marke,L.trendTipp(L.trendListe(ts.einkauf,[])).max],['Venum',27.5]);
eq('Trend-Tipp ohne Gewinn',[L.trendTipp([{verkauf_von:10,verkauf_bis:12}]),L.trendTipp([])],[null,null]);
eq('Trend-Tipp nie mit Mini-Höchstpreis',[L.trendMax(ts.einkauf[1]).max,L.trendTipp([ts.einkauf[1]])],[1.5,null]);
eq('Suche aus Trend',[L.trendSuche(ts.einkauf[3]),L.trendSuche({marke:'Nike',suche:'Tech Fleece Nike'}).marke,L.trendSuche({marke:'Stanley',suche:'Quencher Becher'}).marke,L.trendSuche({was:'Gi'}).typ],
  [{marke:'Venum',typ:'Contender Gi',groesse:'',max:27.5},'','Stanley','Gi']);
eq('Suche aus Trend öffnet Vinted mit Höchstpreis',L.suchLink(L.trendSuche(ts.einkauf[3])),'https://www.vinted.de/catalog?search_text=Venum%20Contender%20Gi&order=newest_first&price_to=27.5&currency=EUR');
const alt={...TR,zeit:Z-8*864e5};
eq('Neuere Trends gewinnen',[L.trendNeuer(alt,TR).zeit,L.trendNeuer(TR,alt).zeit,L.trendNeuer(null,TR).zeit,L.trendNeuer(TR,{kaputt:1}).zeit,L.trendNeuer(null,null)],[Z,Z,Z,Z,null]);
const ta=L.trendAntwort(null,{trends:TR,laeuft:false});
eq('Trends geholt',[ta.trends.zeit,ta.msg],[Z,'Neue Trends vom 16.10.']);
eq('Trends: nichts Neueres',[L.trendAntwort(TR,{trends:TR}).msg.startsWith('Keine neueren Trends'),L.trendAntwort(TR,{trends:TR}).msg.includes('ab 23.10.')],[true,true]);
eq('Trends: Recherche läuft',[L.trendAntwort(TR,{trends:null,laeuft:true}).msg.startsWith('Claude recherchiert noch'),L.trendAntwort(TR,{laeuft:true}).trends.zeit],[true,Z]);
eq('Trends: Fehler, alter Stand bleibt',[L.trendAntwort(TR,{letzter_fehler:'Claude ist nicht angemeldet.'}).msg.includes('nicht angemeldet'),L.trendAntwort(TR,{letzter_fehler:'x'}).msg.includes('alten Stand'),L.trendAntwort(TR,{letzter_fehler:'x'}).trends.zeit],[true,true,Z]);
eq('Trends: noch nichts da',L.trendAntwort(null,{}).msg,'Noch keine Trends. Tipp in ein paar Minuten nochmal.');
const htr=(m,ref,o)=>L.heute([],m,ref,o).filter(t=>t.typ==='trends').length;
eq('Heute erinnert an die Trends',[htr({},'2026-10-16',{trends:true}),htr({trends:TR},'2026-10-22',{trends:true}),htr({trends:TR},'2026-10-23',{trends:true}),htr({},'2026-10-16'),htr({},'2026-10-16',{trends:false})],[1,0,1,0,0]);
// Version 8.2: Claude-App-Weg ohne Mac für KI-Vorschlag, Kauf-Check und Trends
const fv=L.vorschlagFrageApp({name:'  Nike  Hoodie grau M\n'});
eq('App-Frage KI-Vorschlag',[fv.startsWith('Vinted-Helfer: KI-Vorschlag'),fv.includes(L.APP_REGELN.vorschlag),fv.includes('\nArtikelname: Nike Hoodie grau M\n'),fv.includes('Codeblock'),fv.includes('Such nicht im Internet')],[true,true,true,true,true]);
eq('App-Frage Kauf-Check mit den Regeln vom Proxy',[fr.startsWith('Vinted-Helfer: Kauf-Check'),fr.includes(L.APP_REGELN.kauf),fr.includes('\nText des Verkäufers:\nKaum getragen, schreib an [E-Mail]')],[true,true,true]);
const ft=L.trendFrageApp(Z);
eq('App-Frage Trends',[ft.includes(L.NISCHEN),ft.includes('__NISCHEN__'),ft.includes('nie vinted.de'),ft.endsWith('\nHeute ist der 16.10.2026 (Oktober). Recherchiere, was sich auf Vinted in Deutschland in den nächsten 2 Wochen schnell verkauft.')],[true,false,true,true]);
eq('Datum in Ortszeit wie im Proxy',L.trendSatz(new Date(2027,0,1,0,30).getTime()).slice(0,34),'Heute ist der 01.01.2027 (Januar).');
const cl=L.claudeLink(ft);
eq('Claude-Link öffnet neuen Chat mit der Frage',[cl.startsWith('claude://claude.ai/new?q='),decodeURIComponent(cl.split('?q=')[1])===ft,/[\s\n]/.test(cl)],[true,true,false]);
const J='{"titel":"Nike Hoodie grau Gr. M","beschreibung":"Nike Hoodie in Grau, Größe M.\\nMit Kängurutasche.","fehlt":["Material"]}';
eq('JSON im Codeblock mit Text drumherum',L.jsonObjekte('Gern!\n```json\n'+J+'\n```\nViel Erfolg {:}').map(o=>o.titel),['Nike Hoodie grau Gr. M']);
eq('JSON doppelt eingefügt',L.jsonObjekte(J+'\n'+J).length,2);
eq('JSON mit typografischen Anführungszeichen und Komma am Ende',L.jsonObjekte('{“titel”: “A”, “beschreibung”: “B”,}')[0],{titel:'A',beschreibung:'B'});
eq('JSON mit unsichtbaren Zeichen und geschütztem Leerzeichen',L.jsonObjekte('\ufeff{"a":\u00a01,\u200b"b":2}')[0],{a:1,b:2});
eq('Klammern in Texten zählen nicht',L.jsonObjekte('{"titel":"Gi {A2}","beschreibung":"x } y"}')[0].titel,'Gi {A2}');
eq('Deutsche Anführungszeichen im Text bleiben',L.jsonObjekte('{"titel":"Modell „Contender“","beschreibung":"x"}')[0].titel,'Modell „Contender“');
eq('Kein oder kaputtes JSON',[L.jsonObjekte('nur Text'),L.jsonObjekte('{"a":1'),L.jsonObjekte('[1,2]'),L.jsonObjekte(null)],[[],[],[],[]]);
eq('Art der Antwort',[L.appArt({titel:'',beschreibung:''}),L.appArt({einschaetzung:'x'}),L.appArt({einkauf:[]}),L.appArt({titel:'x'}),L.appArt([]),L.appArt({was:'X',verkauf_von:5,tempo:'schnell'}),L.appArt({titel:'Q',url:'https://x.de'})],['vorschlag','kauf','trends','','','','']);
const av=L.appAntwort('Hier ist mein Vorschlag:\n```json\n'+J+'\n```',Z);
eq('App-Antwort KI-Vorschlag',[av.art,av.wert.titel,av.wert.beschreibung,av.wert.fehlt],['vorschlag','Nike Hoodie grau Gr. M','Nike Hoodie in Grau, Größe M.\nMit Kängurutasche.',['Material']]);
const ak=L.appAntwort('{"marke":"Venum","artikel":"Contender Gi","verkauf_von":"35","verkauf_bis":"50,00 €","nachfrage":"mittel","einschaetzung":"Lohnt sich.","echtheit":[],"fragen":[],"risiken":[]}',Z);
eq('App-Antwort Kauf-Check, Preis als Text',[ak.art,ak.wert.von,ak.wert.bis,L.kiMitte(ak.wert)],['kauf',35,50,42.5]);
const tj=JSON.stringify({einkauf:TR.einkauf.map(e=>({...e,verkauf_von:String(e.verkauf_von||'')})),einstellen:TR.einstellen,quellen:TR.quellen});
const at=L.appAntwort('Ich habe gesucht.\n```json\n'+tj+'\n```\nQuellen siehe oben.',Z+36e5);
eq('App-Antwort Trends',[at.art,at.wert.zeit,at.wert.modell,at.wert.einkauf.length,at.wert.einkauf[3].verkauf_von,at.wert.einkauf[3].verkauf_bis,at.wert.quellen.length],['trends',Z+36e5,'Claude-App',4,35,55,1]);
eq('App-Trends gewinnen gegen ältere vom Proxy',L.trendNeuer(TR,at.wert).modell,'Claude-App');
eq('Trends aus der App brauchen eine Zeit',L.trendAusApp({einkauf:[{was:'X',tempo:'schnell'}]},'kaputt'),null);
eq('Noch die Frage eingefügt',[L.appAntwort(fv,Z).fehler,L.appAntwort(fr,Z).fehler,L.appAntwort(ft,Z).fehler],['frage','frage','frage']);
eq('Frage und Antwort zusammen eingefügt',[L.appAntwort(fr+'\n\n'+aw,Z).wert.bis,L.appAntwort(ft+'\n'+tj,Z).art],[50,'trends']);
eq('Kein JSON, kaputt oder fremde Felder',[L.appAntwort('Gern helfe ich dir!',Z).fehler,L.appAntwort('```json\n{"titel":"Nike", "beschr',Z).fehler,L.appAntwort('{"name":"x","preis":3}',Z).fehler,L.appAntwort('',Z).fehler],['kein','kaputt','fremd','kein']);
eq('Unbrauchbarer Vorschlag',L.appAntwort('{"titel":"Hoodie Gr. unbekannt","beschreibung":"Zustand bitte ergänzen."}',Z),{art:'vorschlag',wert:null});
eq('Kauf-Check liest nur Kauf-Antworten',[kiAntwortAusText(J),kiAntwortAusText(tj),kiAntwortAusText(fr)],[null,null,null]);
const KA={marke:'Nike',artikel:'Hoodie',verkauf_von:20,verkauf_bis:30,nachfrage:'mittel',einschaetzung:'Lohnt sich.',echtheit:['Etikett'],fragen:[],risiken:[],titel:'Nike Hoodie grau Gr. M',beschreibung:'Nike Hoodie in Grau, Gr. M.\nMit Kapuze.\nZustand: sehr gut.\nPasst zu Jeans.'};
eq('Kauf-Antwort mit Titel ist ein Kauf-Check',[L.appArt(KA),L.appArt({titel:'x',beschreibung:'y',fehlt:[]}),L.appArt({titel:'x',beschreibung:'y',nachfrage:'hoch'})],['kauf','vorschlag','vorschlag']);
const kv=L.kiKaufAntwort(KA);
eq('Kauf-Check bringt Verkaufstext, Zustand fliegt raus',[kv.titel,kv.beschreibung,kv.bis],['Nike Hoodie grau Gr. M','Nike Hoodie in Grau, Gr. M.\nMit Kapuze.\nPasst zu Jeans.',30]);
eq('Kauf-Check ohne brauchbaren Text bleibt gültig',[L.kiKaufAntwort({...KA,titel:'Hoodie Marke unbekannt'}).titel,L.kiKaufAntwort({...KA,beschreibung:''}).beschreibung,L.kiKaufAntwort({...KA,titel:undefined}).bis],['','',30]);
eq('Kauf-Antwort mit Titel im Text der App',kiAntwortAusText('```json\n'+JSON.stringify(KA)+'\n```').titel,'Nike Hoodie grau Gr. M');
const vs=L.vorschlagSauber({titel:'  „Nike   Hoodie“ ',beschreibung:'a \r\nb\u0007',fehlt:['Größe','',5,'x'.repeat(99),...Array(9).fill('n')]});
eq('Vorschlag säubern wie bereinigen im Proxy',[vs.titel,vs.beschreibung,vs.fehlt.length,vs.fehlt[1].length],['Nike Hoodie','a\nb',4,60]);
eq('Vorschlag leer, kein Objekt oder zu lang',[L.vorschlagSauber({titel:'',beschreibung:'x'}),L.vorschlagSauber('text'),L.vorschlagSauber({titel:'a'.repeat(300),beschreibung:'b'.repeat(5000)}).titel.length,L.vorschlagSauber({titel:'a',beschreibung:'b'.repeat(5000)}).beschreibung.length],[null,null,80,1500]);
const vp=L.vorschlagSauber({titel:'Polo Ralph Lauren Sweatshirt blau, Gr. unbekannt',beschreibung:'Polo Ralph Lauren Sweatshirt in Blau.\nIm Foto sieht man den Schnitt gut; Material und Zustand bitte in der Anzeige ergänzen.\nAuf den Fotos sind keine Mängel zu erkennen.\nFür den Alltag.',fehlt:[]});
eq('Vorschlag ohne Platzhalter und Zustandsaussagen',[vp.titel,vp.beschreibung],['Polo Ralph Lauren Sweatshirt blau','Polo Ralph Lauren Sweatshirt in Blau.\nFür den Alltag.']);
eq('Vorschlag mit „unbekannt“ oder nur Platzhalter',[L.vorschlagSauber({titel:'Größe unbekannt',beschreibung:'Text'}),L.vorschlagSauber({titel:'Hoodie',beschreibung:'Zustand bitte ergänzen.'})],[null,null]);
const hap=(m,ref)=>(L.heute([],m,ref,{trends:'app'}).find(t=>t.typ==='trends')||{}).info||'';
eq('Heute: Trends ohne Mac über die Claude-App',[hap({},'2026-10-16').includes('Claude-App'),hap({trends:TR},'2026-10-23').startsWith('Stand vom 16.10. Neue holst du über die Claude-App'),hap({trends:TR},'2026-10-22')],[true,true,'']);
// Version 8.3: Satz für Satz säubern (dieselben Fälle wie test_proxy.py) und die Baukasten-Angaben im KI-Text
const vf=b=>(L.vorschlagSauber({titel:'Hoodie',beschreibung:b})||{}).beschreibung;
eq('Säubern: „prüfe ich noch“ raus, der Rest der Zeile bleibt',vf('Nike Hoodie in Grau, Gr. M. Material, Zustand und Passform prüfe ich vor dem Einstellen noch genau.\nPasst zu Jeans.'),'Nike Hoodie in Grau, Gr. M.\nPasst zu Jeans.');
eq('Säubern: „Gr. S“ und „z. B.“ trennen keine Sätze',vf('Zara Poloshirt in Rosa, Gr. S. Passt z. B. zu Chinos.'),'Zara Poloshirt in Rosa, Gr. S. Passt z. B. zu Chinos.');
eq('Säubern: Zustand, Nichtraucher, Versand und Fragen raus, „neu mit Etikett“ bleibt',vf('Nike Hoodie in Grau, Gr. M, neu mit Etikett.\nSehr guter Zustand, Nichtraucherhaushalt.\nVersand mit DHL. Bei Fragen einfach melden!'),'Nike Hoodie in Grau, Gr. M, neu mit Etikett.');
eq('Säubern: Lochmuster und Flecktarn bleiben, Passform raus, leere Zeilen einzeln',vf('Jacke mit Lochmuster und Flecktarn.\nFällt etwas kleiner aus. Kapuze.\n\n\n\nPasst zu Cargos.'),'Jacke mit Lochmuster und Flecktarn.\nKapuze.\n\nPasst zu Cargos.');
eq('Säubern: Maße auf Anfrage, Fleck, Gefühl und Neupreis raus',vf('Gi in Weiß.\nMaße auf Anfrage. Kleiner Fleck am Ärmel. Weiches Material, bequem. Neupreis 90 €.\nFürs Training.'),'Gi in Weiß.\nFürs Training.');
eq('Säubern: nur Reden über Name und Foto',L.vorschlagSauber({titel:'Hoodie',beschreibung:'Laut Artikelname ein Hoodie. Auf dem Foto nicht erkennbar.'}),null);
eq('Säubern: „Foto“ ist kein Prüfpunkt',L.vorschlagSauber({titel:'Hoodie',beschreibung:'x',fehlt:['Foto','fotos','Zustand','Foto vom Etikett']}).fehlt,['Zustand','Foto vom Etikett']);
const kiT='Nike Hoodie in Grau, Gr. M.\nPasst zu Jeans.\n'+L.BESCHR_ENDE;
eq('KI-Text ohne Angaben bleibt',[L.beschrMitAngaben(kiT,{}),L.beschrMitAngaben(kiT,null),L.beschrMitAngaben('',{zustand:'Gut'})],[kiT,kiT,'']);
eq('Angaben vor den Versand-Satz',L.beschrMitAngaben(kiT,{material:'Baumwolle',zustand:'Sehr gut',maengel:'kleiner Fleck am Ärmel',masse:'Länge 70 cm'}),'Nike Hoodie in Grau, Gr. M.\nPasst zu Jeans.\nMaterial: Baumwolle.\nZustand: Sehr gut.\nMängel: kleiner Fleck am Ärmel (siehe Fotos).\nMaße: Länge 70 cm.\n'+L.BESCHR_ENDE);
eq('Angaben nicht doppelt, ohne Versand-Satz ans Ende',L.beschrMitAngaben('Hoodie aus Baumwolle.\nZustand: gut',{material:' baumwolle ',zustand:'Sehr gut',masse:'Länge 70 cm'}),'Hoodie aus Baumwolle.\nZustand: gut\nMaße: Länge 70 cm.');
eq('Beschreibung aus KI-Text und Angaben',L.beschrText({typ:'Hoodie',zustand:'Gut',beschr:kiT}),'Nike Hoodie in Grau, Gr. M.\nPasst zu Jeans.\nZustand: Gut.\n'+L.BESCHR_ENDE);
// 8.4: Name aus der Adresse, Link zum vorhandenen Artikel, Such-Link ohne „+“, Trends nach Gewinn pro Euro
eq('Name aus Adresse',['jordan-air-flex-dry-hoodie-rot-l','polo-ralph-lauren-zip-hoodie-khaki-kindergrosse-m','basic-weisses-top-grosse-s','venum-gi-a2','levi-s-501-w32-l32','nike-hoodie-gr-m','','tnf-xxl'].map(L.nameAusSlug),
  ['Jordan Air Flex Dry Hoodie rot L','Polo Ralph Lauren Zip Hoodie khaki Kindergröße M','Basic weißes Top Größe S','Venum Gi A2',"Levi's 501 W32 L32",'Nike Hoodie Gr. M','','Tnf XXL']);
eq('Name aus Link mit Umlaut-Kodierung',L.parseLink('https://www.vinted.de/items/9-wei%C3%9F-hoodie').name,'weiß Hoodie');
eq('Vergleichswörter wie Vinted',L.linkWoerter('Polo Ralph Lauren Zip-Hoodie weiß (Kindergröße XL)'),['polo','ralph','lauren','zip','hoodie','weiss','kindergrosse','xl']);
const ANT=['Jordan Air Flex-Dry Hoodie rot L','Polo Ralph Lauren Zip-Hoodie Camo-Print Logo khaki (Kindergröße M)','Zara Poloshirt rosa S','Nike Club Logo Sweatshirt beige M','Polo Ralph Lauren Sweatshirt blau S','Polo Ralph Lauren Zip-Hoodie weiß L','Uniqlo Pocketable Regenjacke navy S','Polo Ralph Lauren Fleece Weste grau L'].map((name,id)=>({id,name}));
const lp=s=>{const r=L.linkPartner('https://www.vinted.de/items/77-'+s,ANT);return [r.klar&&r.klar.id,r.wahl.map(i=>i.id)]};
eq('Link findet den eigenen Artikel',[lp('jordan-air-flex-dry-hoodie-rot-l')[0],lp('polo-ralph-lauren-zip-hoodie-weiss-l')[0],lp('ralph-lauren-hoodie-kinder-xl')[0],lp('uniqlo-regenjacke')[0],lp('zara-polo-shirt')[0],lp('nike-sweatshirt-creme')[0]],[0,5,1,6,2,3]);
eq('Unklarer Link: Wahl statt raten',lp('ralph-lauren-hoodie'),[null,[5,1,4]]);
eq('Fremder Link: kein Treffer',[lp('venum-gi-a2'),L.linkPartner('https://www.vinted.de/items/77',ANT),L.linkPartner('kein Link',ANT)],[[null,[]],{klar:null,wahl:[]},{klar:null,wahl:[]}]);
eq('Artikel mit Link zählen nicht',L.linkPartner('https://www.vinted.de/items/77-uniqlo-regenjacke',[{id:1,name:'Uniqlo Regenjacke',link:'https://www.vinted.de/items/55-uniqlo-regenjacke'},{id:2,name:'Uniqlo Regenjacke schwarz',link:'Notiz'}]).klar.id,2);
eq('Zwei gleiche Artikel: fragen',L.linkPartner('https://www.vinted.de/items/77-nike-hoodie-grau',[{id:1,name:'Nike Hoodie grau M'},{id:2,name:'Nike Hoodie grau L'}]).klar,null);
eq('Eigener Link: + im Suchtext wird %20',L.suchLink({link:'https://www.vinted.de/catalog?search_text=venum+gi&catalog[]=5',max:30}),'https://www.vinted.de/catalog?search_text=venum%20gi&catalog[]=5&price_to=30&currency=EUR&order=newest_first');
eq('Echtes Plus bleibt erkennbar',L.suchLink({typ:'C++ Buch'}),'https://www.vinted.de/catalog?search_text=C%2B%2B%20Buch&order=newest_first');
eq('Trend-Wert: Gewinn pro Euro',[L.trendSinn(ts.einkauf[3]),L.trendSinn(ts.einkauf[0]).woche,L.trendSinn(ts.einkauf[1]).woche],[{vk:45,max:27.5,handelnBis:36.5,einsatz:34.58,gewinn:10.42,prozent:30,woche:30},8,0]);
eq('Trends nach Sinn sortiert',L.trendKaufListe(ts.einkauf,meine).map(e=>[e.marke,e.sinn.woche]),[['Venum',30],['Nike',26],['Carhartt',8],['Stanley',0]]);
eq('Tipp nach neuer Reihenfolge',L.trendTipp(L.trendKaufListe(ts.einkauf,[])).e.marke,'Venum');
const IP=L.trendSauber({zeit:Z,einkauf:[
  {was:'The North Face Nuptse 700 Daunenjacke',marke:'The North Face',verkauf_von:90,verkauf_bis:130,tempo:'schnell',nische:true},
  {was:'The North Face Fleecejacke',marke:'The North Face',verkauf_von:35,verkauf_bis:55,tempo:'schnell',nische:true},
  {was:'Nike Air Force 1 Low in Weiß',marke:'Nike',verkauf_von:40,verkauf_bis:60,tempo:'schnell',nische:true},
  {was:'New Balance 9060',marke:'New Balance',verkauf_von:60,verkauf_bis:90,tempo:'mittel'},
  {was:'Nike Tech Fleece',marke:'Nike',verkauf_von:35,verkauf_bis:55,tempo:'schnell',nische:true},
  {was:"Levi's 501 Jeans",marke:"Levi's",verkauf_von:25,verkauf_bis:40,tempo:'mittel'},
  {was:'Ralph Lauren Strickpullover',marke:'Ralph Lauren',verkauf_von:30,verkauf_bis:50,tempo:'mittel',nische:true}]});
eq('Trends vom iPhone (20.10.2026): Nuptse nicht mehr oben',L.trendKaufListe(IP.einkauf,ANT).map(e=>e.i),[1,4,2,5,6,0,3]);
// Version 8.5: KI-Preis im KI-Vorschlag. Start oben, Mindest unten, eine Zahl lässt 15 % Luft.
eq('KI-Preis aus der Spanne',[L.kiPreise({von:25,bis:35}),L.kiPreise({von:24.7,bis:34.8}),L.kiPreise({von:30,bis:30}),L.kiPreise({von:0,bis:20})],
  [{start:35,min:25},{start:35,min:24.5},{start:30,min:25.5},{start:20,min:17}]);
eq('KI-Preis ohne Schätzung oder winzig',[L.kiPreise({von:0,bis:0}),L.kiPreise(null),L.kiPreise({von:0.3,bis:0.6})],[null,null,{start:1,min:1}]);
const kp=L.kiAntwort({titel:'Nike Hoodie',beschreibung:'Text',verkauf_von:40,verkauf_bis:30,nachfrage:'hoch'});
eq('KI-Antwort mit Preis',[kp.von,kp.bis,kp.nachfrage],[30,40,'hoch']);
eq('KI-Antwort Preis als Text zählt nicht',[L.kiAntwort({titel:'x',beschreibung:'y',verkauf_von:'30',verkauf_bis:true,nachfrage:'sehr'}).bis,L.kiAntwort({titel:'x',beschreibung:'y',verkauf_bis:25}).von],[0,25]);
const fa=L.vorschlagFrageApp({name:'Nike Hoodie grau M',zustand:'Sehr gut',groesse:'M'});
eq('App-Frage mit Zustand und Größe',[fa.includes('Zustand laut Verkäufer: Sehr gut'),fa.includes('Größe laut Verkäufer: M'),L.vorschlagFrageApp({name:'Nike'}).includes('laut Verkäufer')],[true,true,false]);
eq('Angaben aus dem Baukasten',[L.kiAngaben({zustand:'Gut',groesse:' L ',marke:'Nike'}),L.kiAngaben(null)],[{zustand:'Gut',groesse:'L'},{}]);
const pa=L.appAntwort('```json\n{"titel":"Nike Hoodie grau Gr. M","beschreibung":"Nike Hoodie in Grau.","fehlt":[],"verkauf_von":"25 €","verkauf_bis":35,"nachfrage":"mittel"}\n```',Date.now());
eq('Claude-App: Preis aus der Antwort',[pa.art,pa.wert.von,pa.wert.bis,pa.wert.nachfrage],['vorschlag',25,35,'mittel']);
// Kaputte Datumsfelder aus einem Import dürfen die Heute-Liste nicht einfrieren (früher: Endlosschleife in werktageBis)
const kd=L.migrate([{id:1,name:'a',status:'verkauft',verkauftAm:'gestern',datum:20261020,versendetAm:'2026-10-20'},{id:2,name:'b',status:'verkauft',verkauftAm:'2026-10-20'}]);
eq('Kaputtes Datum fliegt raus',[kd[0].verkauftAm,kd[0].datum,kd[0].versendetAm,kd[1].verkauftAm],[undefined,undefined,'2026-10-20','2026-10-20']);
// Absurdes Jahr braucht fast eine Sekunde pro Heute-Aufruf, darum nur 1900 bis 2099. Die Import-Meldung zählt die entfernten Angaben.
const ab=[{id:1,name:'a',verkauftAm:'9999-12-31',datum:'22.10.2026',versendetAm:'2026-10-20'},{id:2,name:'b',verkauftAm:'2026-10-20'},null];
eq('Jahr 9999 fliegt raus',L.migrate(ab).map(i=>[i.verkauftAm,i.datum]),[[undefined,undefined],['2026-10-20',undefined]]);
eq('Kaputte Daten zählen',[L.kaputteDaten(ab),L.kaputteDaten([{id:1,name:'x',datum:'2026-10-20'}]),L.kaputteDaten(null)],[2,0,0]);
// Das Datumsfeld im Bearbeiten-Fenster speichert nur, was datumOk annimmt (halb getippte Jahre „0002“ und „202520“ sowie leer nicht)
eq('datumOk',['2026-10-23','0002-10-23','202520-10-23','','1999-01-01','2100-01-01'].map(L.datumOk),[true,false,false,false,true,false]);
eq('Heute mit kaputtem Datum',L.heute(kd,{postfach:'2026-10-22'},'2026-10-22').filter(t=>t.typ==='versand').length,1);
console.log(`${ok} ok, ${fail} Fehler`);process.exit(fail?1:0);
