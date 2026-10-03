/**
 * Semantische Kartenzeichen: für manche Wörter ein Bild, das etwas sagt.
 *
 * **Der Anspruch.** „Haus" soll ein Haus sein und nicht irgendein Polygon. Also
 * bekommt eine Karte, deren Wort ein eindeutiges Bild hat, ein Emoji, und alle
 * anderen behalten das erzeugte Zeichen aus `lib/kartenzeichen.ts`.
 *
 * **Emoji und nicht FontAwesome — und warum.** Der Plan war zuerst ein Icon aus
 * `@fortawesome/fontawesome-free`, das ohnehin schon als Abhängigkeit im Projekt
 * liegt. Die Messung hat das widerlegt: von 1992 Icons in der eingebundenen
 * CSS-Datei fehlen ausgerechnet die für eine Vokabel-App entscheidenden —
 * kein `bird`, `bear`, `lion`, `elephant`, `tomato`, `mushroom`, `flower`,
 * `grass`, und nicht einmal ein schlichtes `hand` oder `ear`. FontAwesome Free
 * ist eine Sammlung von Bedienelementen, keine Sammlung von Dingen. Emoji
 * decken dieselben Kategorien dagegen vollständig ab, brauchen keine neue
 * Abhängigkeit und sind im Projekt ohnehin schon in Gebrauch.
 *
 * **Die Grenze, und die ist Absicht.** Aufnahme nur, wenn ein Unbeteiligter
 * sofort dasselbe Bild denkt. Alles andere bekommt das erzeugte Zeichen. Der
 * Grund ist nicht Reinheit, sondern Lernen: „werden" als Uhr, „wissen" als
 * Glühbirne oder „verstehen" als Auge wären drei falsche Bilder, die man sich
 * merkt – und die falsch bleiben, lange nachdem man das Kartenzeichen
 * abgeschaltet hat. Von den 100 Karten des Demovets sind rund 85 Wörter wie
 * der, sein, und, von, haben, werden, scheinen, bedeuten; die bekommen
 * zu Recht nichts.
 *
 * **Beide Seiten sind Kandidaten.** `frage` ist der deutsche Begriff,
 * `antwort` die Fremdsprache. „haus" / „house" findet über beide Wege dasselbe
 * Bild, und die Übersetzung greift auch dann, wenn das Wort in der anderen
 * Sprache klarer ist als im Deutschen.
 */

export type SemantischerTreffer = {
    /** Das Zeichen selbst, als Emoji. */
    emoji: string;
    /** Welche Seite der Karte getroffen hat – nur für Tests und Debug. */
    quelle: "begriff" | "uebersetzung";
    /** Woher der Treffer kam. */
    herkunft: "tabelle";
    /** Welcher Kandidat aus der Normalisierung getroffen hat. */
    kandidat: string;
};

/**
 * Wort → Emoji. Der Schlüssel ist die normalisierte Form, nicht der Wortlaut:
 * `straße` steht als `strasse`, `Mädchen` als `maedchen`, `schön` als `schoen`.
 *
 * Bewusst nicht vollständig. Eine Lücke ist ein erzeugtes Zeichen und damit
 * eine harmlose Form. Ein falscher Treffer wäre ein falsches Wortbild, und das
 * ist der teurere Fehler von beiden.
 */
const WORT_EMOJI: Record<string, string> = {
    // Keine Schlüssel mit Unterstrich, auch nicht als Ausweg für zwei
    // Bedeutungen: die Normalisierung macht aus jedem `_` ein Leerzeichen,
    // `geben_wort` wäre also unerreichbarer Code. Was zwei Bedeutungen
    // braucht, kommt unten in `NUR_DEUTSCH` bei den Schlüsseln vor, die
    // auf der Übersetzungsseite gesperrt werden.
    /* Gebäude und Orte */
    haus: "🏠",
    heim: "🏠",
    zuhause: "🏠",
    wohnung: "🏠",
    gebaeude: "🏢",
    schule: "🏫",
    kirche: "⛪",
    krankenhaus: "🏥",
    hotel: "🏨",
    restaurant: "🍽️",
    cafe: "☕",
    baeckerei: "🥖",
    baecker: "🥐",
    bank: "🏦",
    post: "📮",
    bibliothek: "📚",
    museum: "🏛️",
    theater: "🎭",
    stadion: "🏟️",
    buero: "💼",
    dorf: "🏘️",
    stadt: "🏙️",
    land: "🗺️",
    welt: "🌍",
    strand: "🏖️",
    park: "🌳",
    wald: "🌲",
    garten: "🪴",
    berg: "⛰️",
    meer: "🌊",
    insel: "🏝️",
    feld: "🌾",
    platz: "🟫",
    schloss: "🏰",
    turm: "🗼",
    bruecke: "🌉",
    fabrik: "🏭",
    bauernhof: "🚜",
    fluss: "🌊",
    see: "🏞️",
    himmel: "🌤️",
    brunnen: "⛲",
    weg: "🛣️",
    strasse: "🛣️",

    /* Wohnen und Haushalt */
    tisch: "🪑",
    stuhl: "🪑",
    bett: "🛏️",
    sofa: "🛋️",
    schrank: "🚪",
    spiegel: "🪞",
    tuer: "🚪",
    fenster: "🪟",
    dach: "🏠",
    treppe: "🪜",
    aufzug: "🛗",
    schluessel: "🔑",
    uhr: "⏰",
    dusche: "🚿",
    seife: "🧼",
    zahnbuerste: "🪥",
    brief: "✉️",
    buch: "📕",
    heft: "📖",
    zeitung: "📰",
    mappe: "🗂️",
    karte: "🗺️",
    teller: "🍽️",
    gabel: "🍴",
    messer: "🔪",
    loeffel: "🥄",
    pfanne: "🍳",
    topf: "🍲",
    glas: "🥛",
    tasse: "☕",
    schuessel: "🥣",
    besteck: "🍴",
    waschmaschine: "🧺",
    klamotten: "👕",

    /* Essen und Trinken */
    brot: "🍞",
    milch: "🥛",
    ei: "🥚",
    kaese: "🧀",
    obst: "🍎",
    gemuese: "🥦",
    apfel: "🍎",
    birne: "🍐",
    orange: "🍊",
    mandarine: "🍊",
    banane: "🍌",
    kartoffel: "🥔",
    tomate: "🍅",
    karotte: "🥕",
    zwiebel: "🧅",
    knoblauch: "🧄",
    fleisch: "🥩",
    wurst: "🌭",
    fisch: "🐟",
    huhn: "🍗",
    reis: "🍚",
    nudeln: "🍜",
    pasta: "🍝",
    suppe: "🍲",
    kuchen: "🍰",
    torte: "🍰",
    schokolade: "🍫",
    zucker: "🍬",
    salz: "🧂",
    kaffee: "☕",
    tee: "🍵",
    saft: "🧃",
    bier: "🍺",
    wein: "🍷",
    honig: "🍯",
    mais: "🌽",
    pilz: "🍄",
    obstsalat: "🥗",
    kartoffelsalat: "🥔",
    gemuesesuppe: "🍲",
    nuss: "🌰",
    shrimp: "🍤",

    /* Tiere */
    hund: "🐶",
    katze: "🐱",
    vogel: "🐦",
    pferd: "🐴",
    kuh: "🐮",
    schaf: "🐑",
    ziege: "🐐",
    maus: "🐭",
    ratte: "🐀",
    kaninchen: "🐰",
    biene: "🐝",
    schmetterling: "🦋",
    spinne: "🕷️",
    wurm: "🐛",
    drache: "🐉",
    wolf: "🐺",
    loewe: "🦁",
    baer: "🐻",
    affe: "🐒",
    elefant: "🐘",
    schlange: "🐍",
    schildkroete: "🐢",
    schnecke: "🐌",
    frosch: "🐸",
    ameise: "🐜",
    tier: "🐾",
    haustier: "🐾",
    wal: "🐳",
    delfin: "🐬",
    hai: "🦈",
    octopus: "🐙",
    krabbe: "🦀",
    enten: "🦆",
    eule: "🦉",
    dinosaurier: "🦖",
    einhorn: "🦄",
    hamster: "🐹",
    meerschweinchen: "🐹",

    /* Körper */
    hand: "✋",
    kopf: "🧠",
    hirn: "🧠",
    auge: "👁️",
    ohr: "👂",
    nase: "👃",
    mund: "👄",
    zahn: "🦷",
    haar: "💇",
    arm: "💪",
    bein: "🦵",
    fuss: "🦶",
    herz: "❤️",
    knochen: "🦴",
    haut: "🤲",
    blut: "🩸",
    dna: "🧬",
    lache: "😄",
    weinen: "😢",
    schlaf: "😴",

    /* Kleidung */
    hemd: "👕",
    hose: "👖",
    kleid: "👗",
    schuh: "👟",
    schuhe: "👟",
    mantel: "🧥",
    hut: "🎩",
    handschuh: "🧤",
    schal: "🧣",
    krawatte: "👔",

    /* Farben */
    blau: "🔵",
    rot: "🔴",
    gruen: "🟢",
    gelb: "🟡",
    schwarz: "⚫",
    weiss: "⚪",
    braun: "🟤",
    grau: "🩶",
    lila: "🟣",
    rosa: "🌸",
    durchsichtig: "🔲",

    /* Natur und Wetter */
    sonne: "☀️",
    mond: "🌙",
    stern: "⭐",
    wolke: "☁️",
    regen: "🌧️",
    schnee: "❄️",
    wind: "🌬️",
    wetter: "🌤️",
    blitz: "⚡",
    feuer: "🔥",
    wasser: "💧",
    baum: "🌳",
    blatt: "🍃",
    blume: "🌸",
    kraut: "🌿",
    strauch: "🌿",
    gras: "🌿",
    grass: "🌿",
    wiese: "🌿",
    stein: "🪨",
    sand: "🏜️",
    eis: "🧊",
    laub: "🍂",
    holz: "🪵",
    sturm: "🌪️",
    nebel: "🌫️",
    welle: "🌊",
    regenbogen: "🌈",
    klima: "🌡️",
    sonnenblume: "🌻",
    tulpe: "🌷",
    rose: "🌹",

    /* Fahren */
    auto: "🚗",
    wagen: "🚗",
    pkw: "🚗",
    taxi: "🚕",
    fahrrad: "🚲",
    bus: "🚌",
    zug: "🚆",
    lok: "🚂",
    flugzeug: "✈️",
    schiff: "🚢",
    segelboot: "⛵",
    boot: "⛵",
    ubahn: "🚇",
    strassenbahn: "🚋",
    motorrad: "🏍️",
    helikopter: "🚁",
    tanke: "⛽",
    fahrkarte: "🎫",
    flug: "✈️",

    /* Arbeit, Schule, Technik */
    arbeit: "💼",
    stift: "✏️",
    kugelschreiber: "🖊️",
    computer: "💻",
    laptop: "💻",
    telefon: "☎️",
    handy: "📱",
    fernseher: "📺",
    kamera: "📷",
    drucker: "🖨️",
    tastatur: "⌨️",
    bildschirm: "🖥️",
    musik: "🎵",
    gitarre: "🎸",
    klavier: "🎹",
    mikrofon: "🎤",
    spielen: "🎮",
    spiel: "🎮",
    film: "🎬",
    foto: "🖼️",
    gemelde: "🖼️",
    kunst: "🎨",
    diagramm: "📊",
    rechnen: "🧮",
    zaehlen: "🔢",
    messen: "📏",
    waage: "⚖️",
    kalender: "📅",
    woche: "🗓️",
    notiz: "📝",
    pruefung: "📝",

    /* Menschen */
    mensch: "🧑",
    person: "👤",
    leute: "👥",
    mann: "👨",
    frau: "👩",
    kind: "🧒",
    kinder: "👧",
    baby: "👶",
    familie: "👨‍👩‍👧",
    freund: "🤝",
    nachbar: "🏘️",
    lehrer: "🧑‍🏫",
    arzt: "👨‍⚕️",
    pfleger: "👩‍⚕️",
    patient: "🧑‍🦽",
    koenig: "🤴",
    koenignin: "👸",
    soldat: "🪖",
    polizei: "👮",
    magier: "🧙",
    koch: "👨‍🍳",
    feuerwehr: "🧑‍🚒",

    /* Einkaufen, Geld, Stadt */
    einkaufen: "🛒",
    kaufen: "🛒",
    markt: "🏪",
    geld: "💰",
    muenze: "🪙",
    preis: "🏷️",
    geschenk: "🎁",
    flagge: "🚩",
    fahne: "🚩",
    schild: "🛡️",
    kreditkarte: "💳",
    rechnung: "🧾",
    zoll: "🛃",
    casino: "🎰",
    zoo: "🦓",
    parkhaus: "🅿️",

    /* Abstract, aber eindeutig */
    zeit: "⏰",
    uhrzeit: "⏰",
    stoppuhr: "⏱️",
    tag: "☀️",
    nacht: "🌙",
    jahr: "📅",
    monat: "📆",
    stunde: "🕐",
    minute: "⏱️",
    morgen: "🌅",
    abend: "🌆",
    fruehling: "🌷",
    sommer: "🌞",
    herbst: "🍂",
    winter: "⛄",
    frage: "❓",
    antwort: "✅",
    warum: "❓",
    ja: "✅",
    nein: "🚫",
    zahl: "🔢",
    richtung: "➡️",
    links: "⬅️",
    rechts: "➡️",
    oben: "⬆️",
    hoch: "⬆️",
    unten: "⬇️",
    runter: "⬇️",
    hier: "📍",
    start: "▶️",
    ende: "⏹️",
    gewinnen: "🏆",
    sieg: "🏆",
    verlieren: "😢",
    liebe: "❤️",
    lieben: "❤️",
    moegen: "❤️",
    freude: "😄",
    glueck: "😄",
    angst: "😨",
    traurig: "😢",
    gut: "👍",
    schlecht: "👎",
    ruhe: "🤫",
    laerm: "🔊",  // war: lärm
    stille: "🔇",
    aufmerksamkeit: "👀",
    ziel: "🎯",

    /* Tun und Handeln */
    arbeiten: "💼",
    geben: "🎁",
    gehen: "🚶",
    kommen: "🏃",
    laufen: "🏃",
    rennen: "🏃",
    springen: "🤸",
    sehen: "👀",
    hoeren: "👂",
    sprechen: "💬",
    sagen: "🗣️",
    schreiben: "✍️",
    lesen: "📖",
    lernen: "🎓",
    lehren: "🧑‍🏫",
    singen: "🎤",
    tanzen: "🕺",
    kochen: "🍳",
    backen: "🥖",
    schlafen: "😴",
    trinken: "🥤",
    essen: "🍽️",
    schwimmen: "🏊",
    fliegen: "✈️",
    fahren: "🚗",
    oeffnen: "🔓",
    schliessen: "🔒",
    bezahlen: "💳",
    verkaufen: "🏷️",
    finden: "🔍",
    suchen: "🔍",
    helfen: "🤝",
    zeigen: "👉",
    nehmen: "🤲",
    bauen: "🔨",
    reparieren: "🔧",
    putzen: "🧹",
    waschen: "🧼",
    trocknen: "💨",
    warten: "⏳",
    schenken: "🎁",
    klingeln: "🔔",
    ampel: "🚦",

    /* Englische Entsprechungen, damit die Fremdseite ebenso greift */
    house: "🏠",
    home: "🏠",
    building: "🏢",
    school: "🏫",
    church: "⛪",
    hospital: "🏥",
    library: "📚",
    theatre: "🎭",
    stadium: "🏟️",
    office: "💼",
    city: "🏙️",
    town: "🏙️",
    village: "🏘️",
    country: "🗺️",
    world: "🌍",
    street: "🛣️",
    road: "🛣️",
    bridge: "🌉",
    mountain: "⛰️",
    river: "🌊",
    sea: "🌊",
    beach: "🏖️",
    garden: "🪴",
    forest: "🌲",
    field: "🌾",
    table: "🪑",
    chair: "🪑",
    bed: "🛏️",
    mirror: "🪞",
    door: "🚪",
    window: "🪟",
    stairs: "🪜",
    elevator: "🛗",
    key: "🔑",
    clock: "⏰",
    watch: "⌚",
    book: "📕",
    newspaper: "📰",
    map: "🗺️",
    card: "💳",
    cup: "☕",
    plate: "🍽️",
    knife: "🔪",
    fork: "🍴",
    spoon: "🥄",
    pan: "🍳",
    pot: "🍲",
    basket: "🧺",
    bread: "🍞",
    milk: "🥛",
    egg: "🥚",
    cheese: "🧀",
    fruit: "🍎",
    apple: "🍎",
    pear: "🍐",
    banana: "🍌",
    vegetable: "🥦",
    carrot: "🥕",
    tomato: "🍅",
    potato: "🥔",
    onion: "🧅",
    meat: "🥩",
    sausage: "🌭",
    chicken: "🍗",
    rice: "🍚",
    soup: "🍲",
    cake: "🍰",
    chocolate: "🍫",
    sugar: "🍬",
    coffee: "☕",
    tea: "🍵",
    juice: "🧃",
    beer: "🍺",
    wine: "🍷",
    honey: "🍯",
    corn: "🌽",
    mushroom: "🍄",
    dog: "🐶",
    cat: "🐱",
    bird: "🐦",
    horse: "🐴",
    cow: "🐮",
    sheep: "🐑",
    goat: "🐐",
    mouse: "🐭",
    rat: "🐀",
    rabbit: "🐰",
    bee: "🐝",
    butterfly: "🦋",
    spider: "🕷️",
    worm: "🐛",
    dragon: "🐉",
    lion: "🦁",
    bear: "🐻",
    monkey: "🐒",
    elephant: "🐘",
    snake: "🐍",
    turtle: "🐢",
    snail: "🐌",
    frog: "🐸",
    animal: "🐾",
    head: "🧠",
    eye: "👁️",
    ear: "👂",
    nose: "👃",
    mouth: "👄",
    tooth: "🦷",
    hair: "💇",
    heart: "❤️",
    bone: "🦴",
    shirt: "👕",
    dress: "👗",
    shoes: "👟",
    coat: "🧥",
    sun: "☀️",
    moon: "🌙",
    star: "⭐",
    cloud: "☁️",
    rain: "🌧️",
    snow: "❄️",
    fire: "🔥",
    water: "💧",
    tree: "🌳",
    leaf: "🍃",
    flower: "🌸",
    stone: "🪨",
    ice: "🧊",
    car: "🚗",
    bicycle: "🚲",
    bike: "🚲",
    train: "🚆",
    plane: "✈️",
    ship: "🚢",
    boat: "⛵",
    motorcycle: "🏍️",
    phone: "📱",
    mobile: "📱",
    television: "📺",
    camera: "📷",
    printer: "🖨️",
    game: "🎮",
    play: "🎮",
    people: "👥",
    man: "👨",
    woman: "👩",
    child: "🧒",
    family: "👨‍👩‍👧",
    friend: "🤝",
    teacher: "🧑‍🏫",
    doctor: "👨‍⚕️",
    nurse: "👩‍⚕️",
    king: "🤴",
    police: "👮",
    money: "💰",
    coin: "🪙",
    price: "🏷️",
    gift: "☠️",
    flag: "🚩",
    time: "⏰",
    day: "☀️",
    night: "🌙",
    year: "📅",
    month: "📆",
    week: "🗓️",
    hour: "🕐",
    morning: "🌅",
    evening: "🌆",
    spring: "🌷",
    summer: "🌞",
    autumn: "🍂",
    question: "❓",
    answer: "✅",
    number: "🔢",
    yes: "✅",
    no: "🚫",
    go: "🚶",
    come: "🏃",
    walk: "🚶",
    run: "🏃",
    jump: "🤸",
    hear: "👂",
    speak: "💬",
    say: "🗣️",
    write: "✍️",
    read: "📖",
    learn: "🎓",
    teach: "🧑‍🏫",
    work: "💼",
    sing: "🎤",
    dance: "🕺",
    cook: "🍳",
    bake: "🥖",
    sleep: "😴",
    drink: "🥤",
    eat: "🍽️",
    swim: "🏊",
    fly: "✈️",
    drive: "🚗",
    open: "🔓",
    close: "🔒",
    buy: "🛒",
    pay: "💳",
    sell: "🏷️",
    find: "🔍",
    search: "🔍",
    help: "🤝",
    show: "👉",
    build: "🔨",
    repair: "🔧",
    clean: "🧹",
    wash: "🧼",
    dry: "💨",
    wait: "⏳",
    win: "🏆",
    lose: "😢",
    love: "❤️",
    like: "❤️",
    happy: "😄",
    sad: "😢",
    fear: "😨",
    good: "👍",
    bad: "👎",
};

/**
 * Wortform → Grundform, ganz konservativ.
 *
 * Nur Formen, bei denen die Kurzform eindeutig ist: `ge` am Anfang fällt weg,
 * ein `-e` und ein `-n` am Ende auch. Kein Rumpeln nach `ern` oder einem
 * zweiten `e` – sonst würde `hause` zu `haus` und das Haus würde plötzlich
 * bedeuten, dass jemand ein Haus besitzt. Falsche Treffer sind hier der
 * schlimmere Fehler, weil sie ein falsches Wortbild erzeugen statt keinem.
 */
function varianten(wort: string): string[] {
    const raus = [wort];
    // `ge` steht vorn und wird vorn abgeschnitten. Das ist getrennt von den
    // Endungen zu behandeln: had man beides mit demselben `slice(0, -2)`
    // geprüft, würde „bekommen" zu „kommen" – und die Karte „bekommen"
    // bekäme das Bild von „kommen".
    if (wort.startsWith("ge")) {
        const rest = wort.slice(2);
        if (rest.length >= 3) raus.push(rest);
    }
    for (const endung of ["e", "n", "en"]) {
        // Ohne diese Prüfung schneidet die Regel blind das letzte Zeichen ab:
        // aus „many" würde „man" und die Karte „viele" bekäme einen Mann.
        if (!wort.endsWith(endung)) continue;
        const rest = wort.slice(0, -endung.length);
        if (rest.length >= 3) raus.push(rest);
    }
    return [...new Set(raus)];
}

/**
 * Ein Wort in die Schlüsselform bringen, in der die Tabelle steht.
 *
 * Umlaute werden zu `ae`/`oe`/`ue` und scharfes `s` zu `ss`, damit `straße`,
 * `Strasse` und `strasse` denselben Schlüssel treffen. Kleingeschrieben, ohne
 * Satzzeichen, mit einfachen Leerzeichen.
 */
export function normiere(wort: string): string {
    return wort
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .normalize("NFC")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

/**
 * Kandidaten für ein Kartenfeld.
 *
 * Kartenfelder enthalten oft Alternativen mit Komma – `"an, auf"`, `"du, Sie"`,
 * `"dieser, diese, jedes"` – und die sind einzeln gemeint. Also wird zuerst das
 * ganze Feld probiert und danach jedes Teilchen; der erste Treffer gewinnt. Die
 * Reihenfolge ist damit auch eine Rangfolge: das erste Alternativwort ist
 * normalerweise das gebräuchlichere.
 *
 * Der zweite Durchlauf trennt an Komma, Semikolon, Schrägstrich und ` und `,
 * weil dieselbe Unordnung auch dort auftaucht: aus einem Import kommt nicht
 * selten `du/Sie` oder `in/auf` in einem Feld.
 */
export function kandidaten(feld: string): string[] {
    const normiert = normiere(feld);
    if (!normiert) return [];
    const raus = [normiert];
    for (const teil of normiert.split(" ")) raus.push(teil);
    for (const teil of feld.split(/[,;/]| und /i)) {
        const n = normiere(teil);
        if (n && !raus.includes(n)) raus.push(n);
    }
    return [...new Set(raus)];
}

/**
 * Schlüssel, die auf der Übersetzungsseite gesperrt sind.
 *
 * Ein deutscher Schlüssel und ein englischer können sich auf zwei Zeichen
 * schreiben und doch verschiedene Wörter meinen. `see` ist auf Deutsch der
 * See 🏞️ und auf Englisch „sehen" 👀; `gift` ist auf Deutsch das Gift ☠️ und
 * auf Englisch das Geschenk 🎁. Ohne diese Sperre bekommt die Karte
 * „verstehen / see" den See und „Gift / gift" die Karte.
 *
 * Gesperrt wird nur der Weg über die Übersetzung. Als deutscher Begriff
 * bleiben beide Wörter richtig.
 */
const NUR_DEUTSCH = new Set(["see", "gift"]);

/**
 * Für ein einzelnes Wort nachsehen: erst die Handtabelle, sonst nichts.
 *
 * **Warum kein automatischer Zugriff auf die Emoji-Namen.** Der Versuch war
 * naheliegend und ist gescheitert, und zwar an einem Beispiel, das genügt:
 * `emoji-woerter.mjs` liest die Namen der Emoji und liefert daraus „but" → 😥,
 * weil das Gesicht „sad but relieved face" heißt. Ähnlich „from" → 😤 aus
 * „face with steam from nose" und „die" → 🎲 aus „game die". Ein Name ist ein
 * Beschreibungstext, kein Wörterbuch, und die gemeinsamen englischen Wörter
 * darin sind zufällige Mitläufer.
 *
 * Die Datei `lib/emoji-woerter.generated.ts` bleibt deshalb, was ihr eigener
 * Kopf sagt: ein Vorschlagsgenerator für Menschen. Sie wird nicht geladen.
 *
 * **Deshalb ist die Handtabelle nicht optional.** Sie entscheidet überall dort,
 * wo die Namen mehrdeutig sind: `house` ist 🏠 und nicht 🏚️, `sun` ist ☀️ und
 * nicht ⛅, `car` ist 🚗 und nicht 🚓. Genau diese Entscheidungen sind der
 * Inhalt von „haus ist ein Haus" — die liefert keine Namenssuche.
 */
function emojiFuerWort(wort: string, uebersetzung: boolean): string | null {
    if (uebersetzung && NUR_DEUTSCH.has(wort)) return null;
    for (const v of varianten(wort)) {
        if (uebersetzung && NUR_DEUTSCH.has(v)) continue;
        const treffer = WORT_EMOJI[v];
        if (treffer) return treffer;
    }
    return null;
}

/**
 * Das semantische Zeichen für eine Karte – oder `null`, wenn keines passt.
 *
 * Reihenfolge: erst der deutsche Begriff, dann die Übersetzung. Das ist
 * Absicht, weil auf der Rückseite der Begriff steht und die Karte dort als
 * Lernanker dient; die Übersetzung ist der zweite Versuch, kein gleichwertiger.
 */
export function semantischesZeichen(begriff: string, uebersetzung: string): SemantischerTreffer | null {
    for (const kandidat of kandidaten(begriff)) {
        const emoji = emojiFuerWort(kandidat, false);
        if (emoji) return { emoji, herkunft: "tabelle", quelle: "begriff", kandidat };
    }
    for (const kandidat of kandidaten(uebersetzung)) {
        const emoji = emojiFuerWort(kandidat, true);
        if (emoji) return { emoji, herkunft: "tabelle", quelle: "uebersetzung", kandidat };
    }
    return null;
}

/** Wie viele Wörter die Tabelle kennt – für Tests und die Selbstauskunft. */
export function tabellenGroesse(): number {
    return Object.keys(WORT_EMOJI).length;
}

/**
 * Der ganze Tabelleninhalt, nur zum Prüfen in Tests.
 *
 * Bewusst kein Teil der Laufzeit-API: `semantischesZeichen` ist der einzige
 * Weg, der von aßen nach einem Bild sieht.
 */
export function alleWortEmoji(): Record<string, string> {
    return { ...WORT_EMOJI };
}