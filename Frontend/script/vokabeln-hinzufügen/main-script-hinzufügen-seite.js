//Die vier knöpfe auf der anfang seite zum sprache auswählen
const franzButton = document.getElementById("französisch-button");
const italienButton = document.getElementById("italienisch-button");
const spanischButton = document.getElementById("spanisch-button");
const englischButton = document.getElementById("englisch-button");
//saxhen wie der main-body also der screen
const mainBody = document.getElementById("main-body")
//hier kommen alle links rein
const linkZuStyleNeuFürInput = document.createElement("link");
//jetzt für die vokabeln hinzufügen seite
const vokabelnHinzufügenSeite = document.getElementById("vokabeln-hinzufügen-seite");
//sprache auswählen seite
const spracheAuswählenSeite = document.getElementById("seite-sprache-auswahl");
const inputDeutsch = document.getElementById("deutsch-input-id");
const inputFremd = document.getElementById("fremd-input-id");

vokabelnHinzufügenSeite.style.display = "none";
spracheAuswählenSeite.style.display = "block";

const placeholderTexte = {
    englisch: {
        deutsch: "Katze",
        fremd: "cat",
    },

    französisch: {
        deutsch: "Garten",
        fremd: "jardin",
    },

    spanisch: {
        deutsch: "Hallo",
        fremd: "hola",
    },

    italienisch: {
        deutsch: "Apfel",
        fremd: "mela",
    }
};

//das ist eine liste mit den farben für die verschiedenen sprachen
const sprachenFarben = {
    englisch: "#df9b35",
    französisch: "#801e2e",
    spanisch: "#c85d43",
    italienisch: "#5c7d64"
};

let hintergrundFarbe = "#fff";

//die funktion sorgt dafür das ein neuer link verlingt wird
function dateiHinzufügen(sprache,link,konstante) {
    konstante.rel = sprache;
    konstante.href = link
    document.head.appendChild(konstante)
}
//das ist sozusagen der zweite schritt weil das passt die farben und auch so sachen wie placeholder an anhand der ausgewählten sprache
function htmlAnpass(sprache) {
    hintergrundFarbe = sprachenFarben[sprache];
    dateiHinzufügen("stylesheet","/Frontend/styles/vokabeln-hinzufügen-seite/vokabeln-hinzufügen-input-seite.css",linkZuStyleNeuFürInput);
    vokabelnHinzufügenSeite.style.display = "block";
    spracheAuswählenSeite.style.display = "none";
    vokabelnHinzufügenSeite.style.display = "flex";
    mainBody.style.background = hintergrundFarbe;
    inputDeutsch.placeholder = placeholderTexte[sprache].deutsch;
    inputFremd.placeholder = placeholderTexte[sprache].fremd;

};
//das chekt welcher button  geklickt wird und gibt das halt weiter in die funktion html anpass
function spracheAuswahl() {
    franzButton.addEventListener("click", function() {
        htmlAnpass("französisch")
    });
    italienButton.addEventListener("click", function() {
        htmlAnpass("italienisch")
    });
    spanischButton.addEventListener("click", function() {
        htmlAnpass("spanisch")
    });
    englischButton.addEventListener("click", function() {
        htmlAnpass("englisch")
    });
};
spracheAuswahl();
