const franzButton = document.getElementById("französisch-button");
const italienButton = document.getElementById("italienisch-button");
const spanischButton = document.getElementById("spanisch-button");
const englischButton = document.getElementById("englisch-button");
const mainBody = document.getElementById("main-body")
const link = document.createElement("link");

link.rel = "stylesheet";
link.href = "/Frontend/styles/vokabeln-hinzufügen-seite/vokabeln-hinzufügen-input-seite.css";

const sprachenFarben = {
    englisch: "#df9b35",
    französisch: "#801e2e",
    spanisch: "#c85d43",
    italienisch: "#5c7d64"
};

let hintergrundFarbe = "#fff";

function htmlAnpass(sprache) {
    hintergrundFarbe = sprachenFarben[sprache];
    alert(hintergrundFarbe);
    document.head.appendChild(link);
};

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
