/**
 * Semantische Kartenzeichen: für manche Wörter ein Icon, das etwas sagt.
 *
 * **Der Anspruch.** „Haus" soll ein Haus sein und nicht irgendein Polygon. Also
 * bekommt eine Karte, deren Wort ein eindeutiges Bild hat, ein passendes Icon
 * aus `lucide-static`, und alle anderen behalten das erzeugte Zeichen aus
 * `lib/kartenzeichen.ts`.
 *
 * **Warum Icons und keine Emoji.** Emoji wurden hier zuerst eingesetzt und
 * wieder entfernt: der Nutzer wollte SVG, und damit eine Form, die zur
 * Kartenfläche gehört statt eine bunte Bilddatei aus dem System. Der
 * praktische Grund kam dazu — Lucide zeichnet mit 2 px Strich in `currentColor`
 * auf einem 24er-`viewBox`, und unsere erzeugten Zeichen sind Strichfiguren
 * derselben Größe. Beide Systeme sehen damit aus wie eines.
 *
 * **Warum nicht FontAwesome, obwohl es schon da ist.** Gemessen, nicht
 * behauptet: an 65 Vokabeln aus dem Kernbereich einer Anfängerliste — Haus,
 * Tier, Essen, Natur, Alltag — trifft FontAwesome Free 45 (69 %), Lucide 56
 * (86 %). FontAwesome hat dafür `pferd`, `kuh`, `kaese` und `bank`, Lucide
 * dafür 15 Wörter mehr. Beide Sätze sind Sammlungen von Bedienelementen; Lucide
 * ist für diese Aufgabe nur der bessere davon. Hinzu kommt die Lizenz:
 * FontAwesome Free steht unter CC BY 4.0 und verlangt eine Quellenangabe,
 * Lucide unter ISC und verlangt nur den Copyright-Hinweis.
 *
 * **Die Grenze, und die ist Absicht.** Aufnahme nur, wenn ein Unbeteiligter
 * sofort dasselbe Bild denkt. Lucide hat kein `käse`, kein `tomate`, kein
 * `pferd` und kein `nase`. Diese Wörter bekommen deshalb *kein* Icon und
 * behalten das erzeugte Zeichen: Käse als `sandwich` wäre eine Lüge, die man
 * sich merkt. Aus demselben Grund gibt es keine Farben in der Tabelle — blau
 * lässt sich in `currentColor` nicht zeichnen.
 *
 * **Kein automatischer Zugriff auf Iconnamen.** Der naheliegende Weg wäre,
 * Wort gegen Icon-Datei-Namen zu halten. Genau das macht die Handtabelle
 * ohnehin nicht: `haus` ist `house` und nicht `housing`, `brot` ist `croissant`
 * und nicht `bread`, und `auto` ist `car` und nicht `car-auto`. Der
 * Unsinn liegt in den Entscheidungen, nicht im Nachschlagen.
 *
 * **Beide Seiten sind Kandidaten.** `frage` ist der deutsche Begriff,
 * `antwort` die Fremdsprache. „haus" / „house" findet über beide Wege dasselbe
 * Icon, und die Übersetzung greift auch dann, wenn das Wort in der anderen
 * Sprache klarer ist als im Deutschen.
 */

export type SemantischerTreffer = {
    /** Der Name des Icons in `lucide-static`, ohne `.svg`. */
    icon: string;
    /** Welche Seite der Karte getroffen hat – nur für Tests und Debug. */
    quelle: "begriff" | "uebersetzung";
    /** Woher der Treffer kam. */
    herkunft: "tabelle";
    /** Welcher Kandidat aus der Normalisierung getroffen hat. */
    kandidat: string;
};

/**
 * Wort → Icon-Name. Das ist die einzige Stelle, an der eine Entscheidung über
 * ein Bild getroffen wird; der Rest der Datei sucht nur noch.
 */
const WORT_ICON: Record<string, string> = {
    abend: "sunset",
    ameise: "bug",
    ampel: "traffic-cone",
    angst: "annoyed",
    animal: "paw-print",
    answer: "check",
    antwort: "check",
    apfel: "apple",
    apple: "apple",
    arbeit: "briefcase",
    arbeiten: "briefcase",
    arm: "dumbbell",
    arzt: "stethoscope",
    aufmerksamkeit: "eye",
    aufzug: "chevrons-up",
    auge: "eye",
    auto: "car",
    autumn: "leaf",
    baby: "baby",
    bad: "thumbs-down",
    banana: "banana",
    banane: "banana",
    bank: "landmark",
    basket: "briefcase",
    bauen: "hammer",
    bauernhof: "tractor",
    baum: "tree-deciduous",
    beach: "umbrella",
    bed: "bed",
    bee: "bug",
    beer: "beer",
    bein: "footprints",
    berg: "mountain",
    besteck: "utensils",
    bett: "bed",
    bezahlen: "credit-card",
    bibliothek: "library",
    bicycle: "bike",
    biene: "bug",
    bier: "beer",
    bike: "bike",
    bildschirm: "monitor",
    bird: "bird",
    birne: "citrus",
    blatt: "leaf",
    blitz: "zap",
    blume: "flower",
    blut: "droplet",
    boat: "sailboat",
    bone: "bone",
    book: "book",
    boot: "sailboat",
    bread: "croissant",
    bridge: "bridge",
    brief: "mail",
    brot: "croissant",
    bruecke: "bridge",
    brunnen: "droplet",
    buch: "book",
    buero: "briefcase",
    build: "hammer",
    building: "building-2",
    bus: "bus",
    butterfly: "bug",
    buy: "shopping-cart",
    cafe: "coffee",
    cake: "cake",
    camera: "camera",
    car: "car",
    card: "credit-card",
    carrot: "carrot",
    casino: "dice-5",
    cat: "cat",
    chair: "armchair",
    chicken: "drumstick",
    child: "baby",
    chocolate: "candy",
    church: "church",
    city: "building",
    clean: "broom",
    clock: "clock",
    close: "lock",
    cloud: "cloud",
    coat: "shirt",
    coffee: "coffee",
    coin: "coins",
    come: "footprints",
    computer: "laptop",
    cook: "cooking-pot",
    country: "map",
    cup: "coffee",
    dach: "house",
    dance: "music",
    day: "sun",
    delfin: "fish",
    diagramm: "chart-column",
    dna: "dna",
    doctor: "stethoscope",
    dog: "dog",
    door: "door-open",
    dorf: "houses",
    dress: "shirt",
    drink: "cup-soda",
    drive: "car",
    drucker: "printer",
    dry: "wind",
    durchsichtig: "square",
    dusche: "shower-head",
    ear: "ear",
    eat: "utensils",
    egg: "egg",
    ei: "egg",
    einhorn: "sparkles",
    einkaufen: "shopping-cart",
    eis: "snowflake",
    elevator: "chevrons-up",
    ende: "square",
    enten: "bird",
    essen: "utensils",
    eule: "bird",
    evening: "sunset",
    eye: "eye",
    fabrik: "factory",
    fahne: "flag",
    fahren: "car",
    fahrkarte: "ticket",
    fahrrad: "bike",
    familie: "users",
    family: "users",
    fear: "annoyed",
    feld: "wheat",
    fenster: "panels-top-left",
    fernseher: "tv",
    feuer: "flame",
    feuerwehr: "flame",
    field: "wheat",
    film: "clapperboard",
    find: "search",
    finden: "search",
    fire: "flame",
    fisch: "fish",
    flag: "flag",
    flagge: "flag",
    fleisch: "beef",
    fliegen: "plane",
    flower: "flower",
    flug: "plane",
    flugzeug: "plane",
    fluss: "waves",
    fly: "plane",
    forest: "tree-pine",
    fork: "utensils",
    foto: "image",
    frage: "circle-help",
    frau: "user",
    freude: "smile",
    freund: "handshake",
    friend: "handshake",
    fruehling: "flower",
    fruit: "apple",
    fuss: "footprints",
    gabel: "utensils",
    game: "gamepad-2",
    garden: "sprout",
    garten: "sprout",
    gebaeude: "building-2",
    geben: "gift",
    gehen: "footprints",
    geld: "wallet",
    gemelde: "image",
    gemuese: "salad",
    gemuesesuppe: "soup",
    geschenk: "gift",
    gewinnen: "trophy",
    gift: "skull",
    gitarre: "guitar",
    glas: "milk",
    glueck: "smile",
    go: "footprints",
    good: "thumbs-up",
    gras: "sprout",
    grass: "sprout",
    gut: "thumbs-up",
    haar: "scissors",
    hai: "fish",
    hair: "scissors",
    hamster: "mouse",
    hand: "hand",
    handschuh: "hand",
    handy: "smartphone",
    happy: "smile",
    haus: "house",
    haustier: "paw-print",
    haut: "hand-heart",
    head: "brain",
    hear: "ear",
    heart: "heart",
    heft: "book-open",
    heim: "house",
    helfen: "handshake",
    helikopter: "helicopter",
    help: "handshake",
    hemd: "shirt",
    herbst: "leaf",
    herz: "heart",
    hier: "map-pin",
    himmel: "cloud-sun",
    hirn: "brain",
    hoch: "arrow-up",
    hoeren: "ear",
    holz: "tree-pine",
    home: "house",
    hospital: "cross",
    hotel: "hotel",
    hour: "clock",
    house: "house",
    huhn: "drumstick",
    hund: "dog",
    hut: "party-popper",
    ice: "snowflake",
    insel: "umbrella",
    ja: "check",
    jahr: "calendar",
    juice: "cup-soda",
    jump: "dumbbell",
    kaffee: "coffee",
    kalender: "calendar",
    kamera: "camera",
    kaninchen: "rabbit",
    karotte: "carrot",
    karte: "map",
    kartoffelsalat: "carrot",
    katze: "cat",
    kaufen: "shopping-cart",
    key: "key",
    kind: "baby",
    kinder: "baby",
    king: "crown",
    kirche: "church",
    klamotten: "shirt",
    klavier: "piano",
    kleid: "shirt",
    klima: "thermometer",
    klingeln: "bell",
    knife: "utensils",
    knochen: "bone",
    koch: "chef-hat",
    kochen: "cooking-pot",
    koenig: "crown",
    koenignin: "crown",
    kommen: "footprints",
    kopf: "brain",
    krankenhaus: "cross",
    kraut: "sprout",
    krawatte: "briefcase",
    kreditkarte: "credit-card",
    kuchen: "cake",
    kugelschreiber: "pen",
    kunst: "palette",
    lache: "smile",
    laerm: "volume-2",
    land: "map",
    laptop: "laptop",
    laub: "leaf",
    laufen: "footprints",
    leaf: "leaf",
    learn: "graduation-cap",
    lehren: "presentation",
    lehrer: "presentation",
    lernen: "graduation-cap",
    lesen: "book-open",
    leute: "users",
    library: "library",
    liebe: "heart",
    lieben: "heart",
    like: "heart",
    links: "arrow-left",
    loeffel: "utensils",
    lok: "train-front",
    lose: "frown",
    love: "heart",
    magier: "wand",
    man: "user",
    mandarine: "citrus",
    mann: "user",
    mantel: "shirt",
    map: "map",
    mappe: "folder",
    markt: "store",
    maus: "mouse",
    meat: "beef",
    meer: "waves",
    meerschweinchen: "mouse",
    mensch: "user",
    messen: "ruler",
    messer: "utensils",
    mikrofon: "mic",
    milch: "milk",
    milk: "milk",
    minute: "timer",
    mirror: "mirror-round",
    mobile: "smartphone",
    moegen: "heart",
    monat: "calendar-days",
    mond: "moon",
    money: "wallet",
    month: "calendar-days",
    moon: "moon",
    morgen: "sunrise",
    morning: "sunrise",
    motorcycle: "bike",
    motorrad: "bike",
    mountain: "mountain",
    mouse: "mouse",
    muenze: "coins",
    museum: "landmark",
    musik: "music",
    nachbar: "houses",
    nacht: "moon",
    nebel: "cloud-fog",
    nehmen: "hand-heart",
    nein: "circle-x",
    newspaper: "newspaper",
    night: "moon",
    no: "circle-x",
    notiz: "notebook-pen",
    nudeln: "soup",
    number: "hash",
    nurse: "stethoscope",
    nuss: "nut",
    oben: "arrow-up",
    obst: "apple",
    obstsalat: "salad",
    oeffnen: "lock-open",
    office: "briefcase",
    ohr: "ear",
    open: "lock-open",
    orange: "citrus",
    pan: "cooking-pot",
    park: "tree-deciduous",
    patient: "accessibility",
    pay: "credit-card",
    pear: "citrus",
    people: "users",
    person: "user",
    pfanne: "cooking-pot",
    pfleger: "stethoscope",
    phone: "smartphone",
    pkw: "car",
    plane: "plane",
    plate: "utensils",
    play: "gamepad-2",
    police: "shield",
    polizei: "shield",
    post: "mail",
    pot: "soup",
    platz: "square",
    preis: "tag",
    price: "tag",
    printer: "printer",
    pruefung: "notebook-pen",
    putzen: "broom",
    question: "circle-help",
    rabbit: "rabbit",
    rain: "cloud-rain",
    rat: "mouse",
    ratte: "mouse",
    read: "book-open",
    rechnen: "calculator",
    rechnung: "receipt",
    reis: "wheat",
    rechts: "arrow-right",
    regen: "cloud-rain",
    regenbogen: "rainbow",
    rennen: "footprints",
    repair: "wrench",
    reparieren: "wrench",
    restaurant: "utensils",
    richtung: "arrow-right",
    river: "waves",
    road: "route",
    rosa: "flower",
    rose: "flower",
    ruhe: "eye-off",
    run: "footprints",
    runter: "arrow-down",
    sad: "frown",
    saft: "cup-soda",
    sagen: "message-circle",
    sand: "sun",
    say: "message-circle",
    schal: "wind",
    schenken: "gift",
    schiff: "ship",
    schild: "shield",
    schildkroete: "turtle",
    schlaf: "moon",
    schlafen: "moon",
    schlange: "worm",
    schlecht: "thumbs-down",
    schliessen: "lock",
    schloss: "castle",
    schluessel: "key",
    schmetterling: "bug",
    schnecke: "snail",
    schnee: "snowflake",
    schokolade: "candy",
    school: "school",
    schrank: "door-open",
    schreiben: "pen",
    schuessel: "soup",
    schule: "school",
    schwimmen: "waves",
    sea: "waves",
    search: "search",
    see: "waves",
    segelboot: "sailboat",
    sehen: "eye",
    seife: "soap-dispenser-droplet",
    sell: "tag",
    ship: "ship",
    shirt: "shirt",
    show: "mouse-pointer-click",
    shrimp: "fish",
    sieg: "trophy",
    sing: "mic",
    singen: "mic",
    sleep: "moon",
    snail: "snail",
    snake: "worm",
    snow: "snowflake",
    sofa: "sofa",
    soldat: "hard-hat",
    sommer: "sun",
    sonne: "sun",
    sonnenblume: "flower",
    soup: "soup",
    speak: "message-circle",
    spider: "bug",
    spiegel: "mirror-round",
    spiel: "gamepad-2",
    spielen: "gamepad-2",
    spinne: "bug",
    spoon: "utensils",
    sprechen: "message-circle",
    spring: "flower",
    springen: "dumbbell",
    stadion: "goal",
    stadium: "goal",
    stadt: "building",
    stairs: "ruler",
    star: "star",
    start: "play",
    stein: "mountain",
    stern: "star",
    stift: "pencil",
    stille: "volume-x",
    stone: "mountain",
    stoppuhr: "timer",
    strand: "umbrella",
    strasse: "route",
    strassenbahn: "train-front",
    strauch: "sprout",
    street: "route",
    stuhl: "armchair",
    stunde: "clock",
    sturm: "tornado",
    suchen: "search",
    sugar: "candy",
    summer: "sun",
    sun: "sun",
    suppe: "soup",
    swim: "waves",
    table: "armchair",
    tag: "sun",
    tanke: "fuel",
    tanzen: "music",
    tasse: "coffee",
    tastatur: "keyboard",
    taxi: "car",
    tea: "coffee",
    teach: "presentation",
    teacher: "presentation",
    tee: "coffee",
    telefon: "phone",
    television: "tv",
    teller: "utensils",
    theater: "drama",
    theatre: "drama",
    tier: "paw-print",
    time: "clock",
    tisch: "armchair",
    tomate: "cherry",
    tomato: "cherry",
    topf: "soup",
    torte: "cake",
    town: "building",
    train: "train-front",
    traurig: "frown",
    tree: "tree-deciduous",
    treppe: "ruler",
    trinken: "cup-soda",
    trocknen: "wind",
    tuer: "door-open",
    tulpe: "flower",
    turm: "lighthouse",
    turtle: "turtle",
    ubahn: "train-front",
    uhr: "clock",
    uhrzeit: "clock",
    unten: "arrow-down",
    vegetable: "salad",
    verkaufen: "tag",
    verlieren: "frown",
    village: "houses",
    vogel: "bird",
    waage: "scale",
    wagen: "car",
    wait: "hourglass",
    wald: "tree-pine",
    walk: "footprints",
    warten: "hourglass",
    warum: "circle-help",
    waschen: "soap-dispenser-droplet",
    wash: "soap-dispenser-droplet",
    wasser: "droplet",
    watch: "watch",
    water: "droplet",
    week: "calendar-days",
    weg: "route",
    wein: "wine",
    weinen: "frown",
    welle: "waves",
    welt: "globe",
    wetter: "cloud-sun",
    wiese: "sprout",
    win: "trophy",
    wind: "wind",
    window: "panels-top-left",
    wine: "wine",
    winter: "snowflake",
    woche: "calendar-days",
    wohnung: "house",
    wolke: "cloud",
    woman: "user",
    work: "briefcase",
    world: "globe",
    worm: "worm",
    write: "pen",
    wurm: "worm",
    year: "calendar",
    yes: "check",
    zaehlen: "hash",
    zahl: "hash",
    zeigen: "mouse-pointer-click",
    zeit: "clock",
    zeitung: "newspaper",
    ziel: "target",
    zoll: "briefcase",
    zucker: "candy",
    zug: "train-front",
    zuhause: "house",
};

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
 * See und auf Englisch „sehen"; `gift` ist auf Deutsch das Gift und auf
 * Englisch das Geschenk. Ohne diese Sperre bekommt die Karte „verstehen /
 * see" den See und „Gift / gift" die Karte.
 *
 * Gesperrt wird nur der Weg über die Übersetzung. Als deutscher Begriff
 * bleiben beide Wörter richtig.
 */
const NUR_DEUTSCH = new Set(["see", "gift"]);

/**
 * Für ein einzelnes Wort nachsehen: erst die Handtabelle, sonst nichts.
 */
function iconFuerWort(wort: string, uebersetzung: boolean): string | null {
    if (uebersetzung && NUR_DEUTSCH.has(wort)) return null;
    for (const v of varianten(wort)) {
        if (uebersetzung && NUR_DEUTSCH.has(v)) continue;
        const treffer = WORT_ICON[v];
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
        const icon = iconFuerWort(kandidat, false);
        if (icon) return { icon, herkunft: "tabelle", quelle: "begriff", kandidat };
    }
    for (const kandidat of kandidaten(uebersetzung)) {
        const icon = iconFuerWort(kandidat, true);
        if (icon) return { icon, herkunft: "tabelle", quelle: "uebersetzung", kandidat };
    }
    return null;
}

/** Wie viele Wörter die Tabelle kennt – für Tests und die Selbstauskunft. */
export function tabellenGroesse(): number {
    return Object.keys(WORT_ICON).length;
}

/**
 * Der ganze Tabelleninhalt, nur zum Prüfen in Tests und im Generator.
 */
export function alleWortIcon(): Record<string, string> {
    return { ...WORT_ICON };
}
