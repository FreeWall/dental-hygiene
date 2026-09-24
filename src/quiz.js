// Kvízové otázky z dentální hygieny (správná odpověď je vždy první, při zobrazení se míchají).
export const QUESTIONS = [
  {
    q: 'Jaké číslo má v systému FDI první dolní levý stálý molár?',
    a: ['36', '46', '26', '16'],
    why: 'Kvadrant 3 = dolní levý, pozice 6 = první molár.',
  },
  {
    q: 'Který zub má v systému FDI číslo 13?',
    a: ['Horní pravý špičák', 'Horní levý špičák', 'Dolní pravý špičák', 'Horní pravý první premolár'],
    why: 'Kvadrant 1 je horní pravý, pozice 3 je špičák.',
  },
  {
    q: 'Kde se supragingivální zubní kámen tvoří nejčastěji?',
    a: [
      'Linguálně na dolních frontálních zubech',
      'Palatinálně na horních řezácích',
      'Na okluzních plochách premolárů',
      'Vestibulárně na dolních molárech',
    ],
    why: 'Naproti vývodům podčelistní a podjazykové slinné žlázy. Druhým typickým místem jsou bukální plochy horních molárů u vývodu příušní žlázy.',
  },
  {
    q: 'Vývod které slinné žlázy ústí naproti horním molárům?',
    a: ['Příušní žlázy (Stensenův vývod)', 'Podčelistní žlázy (Whartonův vývod)', 'Podjazykové žlázy (Bartholinův vývod)', 'Patrových žlázek'],
    why: 'Stensenův vývod příušní žlázy ústí na papile ve výši horních molárů – proto tam bývá kámen bukálně.',
  },
  {
    q: 'Jak obarví dvoubarevný plakový indikátor starší (zralý) plak?',
    a: ['Modrofialově', 'Růžově', 'Zeleně', 'Neobarví ho vůbec'],
    why: 'Nový plak se barví růžově až červeně, zralý (starší než cca 48 h) modrofialově.',
  },
  {
    q: 'Kolik zubů má kompletní dočasný chrup?',
    a: ['20', '24', '28', '32'],
    why: 'Dočasný chrup: v každém kvadrantu 2 řezáky, 1 špičák a 2 moláry.',
  },
  {
    q: 'Jaká je běžná koncentrace fluoridů v zubní pastě pro dospělé?',
    a: ['1450 ppm', '500 ppm', '5000 ppm', '100 ppm'],
    why: 'Pro dospělé se doporučuje 1450 ppm F⁻. Pasty s 5000 ppm jsou pro rizikové pacienty na doporučení.',
  },
  {
    q: 'Který ruční nástroj je určen k odstranění subgingiválního kamene?',
    a: ['Gracey kyreta', 'Srpovitý scaler', 'Stomatologické zrcátko', 'Pinzeta'],
    why: 'Gracey kyreta je specifická pro oblast, má zaoblenou špičku a jednu řeznou hranu. Srpovitý scaler je jen na supragingivální kámen.',
  },
  {
    q: 'Jaký prášek se v protokolu GBT používá pro supra- i subgingivální Airflow?',
    a: ['Erythritol', 'Hydrogenuhličitan sodný', 'Pemza', 'Oxid hlinitý'],
    why: 'Jemný erythritolový prášek je šetrný k dásním i výplním. Hydrogenuhličitan sodný je abrazivnější – jen supragingiválně na pigmenty.',
  },
  {
    q: 'Jaká hloubka sulku odpovídá zdravé gingivě?',
    a: ['Do 3 mm', '4–6 mm', '6–8 mm', 'Přes 8 mm'],
    why: 'Fyziologický gingivální sulkus měří zhruba 0,5–3 mm. Hlubší nález znamená pseudochobot nebo parodontální chobot.',
  },
  {
    q: 'Při které technice čištění míří vlákna kartáčku pod úhlem 45° do sulku a dělají drobné vibrační pohyby?',
    a: ['Modifikovaná Bassova technika', 'Fonesova (krouživá) technika', 'Horizontální drhnutí', 'Leonardova technika'],
    why: 'Bassova technika čistí sulkus a krčky. Fonesova krouživá technika se učí hlavně malé děti.',
  },
  {
    q: 'Jak často se obvykle doporučuje recall u pacienta s parodontitidou v udržovací fázi?',
    a: ['Každé 3 měsíce', 'Jednou za 2 roky', 'Každý týden', 'Jen při bolesti'],
    why: 'Podpůrná parodontální terapie probíhá typicky po 3 (až 4) měsících, podle rizika pacienta.',
  },
  {
    q: 'Co hodnotí index PBI?',
    a: ['Krvácení z mezizubních papil', 'Množství zubního kamene', 'Hloubku chobotů', 'Zabarvení zubů'],
    why: 'PBI (Papillen-Blutungs-Index) hodnotí krvácení po šetrném projetí sondou v sulku u papily.',
  },
  {
    q: 'Kolik kořenů má typicky první horní stálý molár?',
    a: ['3 (dva bukální, jeden palatinální)', '2 (meziální a distální)', '1', '4'],
    why: 'Horní moláry mají typicky tři kořeny, dolní moláry dva (meziální a distální).',
  },
  {
    q: 'Jak kmitá hrot piezoelektrického ultrazvuku?',
    a: ['Lineárně (tam a zpět)', 'Eliptickým pohybem', 'Kruhově', 'Vůbec nekmitá'],
    why: 'Piezo kmitá lineárně – pracují hlavně boční strany hrotu. Eliptické kmity má magnetostrikční systém.',
  },
  {
    q: 'Proč kuřáci při sondáži často méně krvácejí?',
    a: ['Nikotin způsobuje vazokonstrikci a maskuje zánět', 'Kouř ničí bakterie plaku', 'Mají přirozeně tvrdší dásně', 'Kuřákům se nesonduje'],
    why: 'Snížené krvácení u kuřáků je zavádějící – zánět a parodontitida mohou být přítomné i bez krvácení.',
  },
  {
    q: 'Které plochy zubů vyčistí zubní kartáček nejhůř?',
    a: ['Aproximální (mezizubní) plochy', 'Vestibulární plochy řezáků', 'Okluzní plochy', 'Bukální plochy molárů'],
    why: 'Na mezizubní prostory jsou mezizubní kartáčky nebo nit – kartáček se tam nedostane.',
  },
  {
    q: 'Proč se při ultrazvuku používá vodní chlazení?',
    a: ['Hrot se kmitáním zahřívá a voda chladí a odplavuje', 'Voda rozpouští zubní kámen', 'Jen aby pacient nemluvil', 'Voda zvyšuje frekvenci kmitů'],
    why: 'Bez chlazení by teplo mohlo poškodit dřeň. Voda navíc vyplachuje kámen a biofilm (kavitace).',
  },
];

export function pickQuestion(used) {
  const pool = QUESTIONS.map((q, i) => i).filter((i) => !used.has(i));
  const idx = pool.length ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * QUESTIONS.length);
  used.add(idx);
  if (used.size >= QUESTIONS.length) used.clear();
  const q = QUESTIONS[idx];
  const order = q.a.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { q: q.q, answers: order.map((i) => q.a[i]), correct: order.indexOf(0), why: q.why };
}
