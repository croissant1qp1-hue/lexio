fetch("/Frontend/navbar/navbar.html")
.then(response => response.text())
.then(data => {
    document.getElementById("navbar").innerHTML = data;

    setActivePage();
});


function setActivePage() {

    const manualActive = document.body.dataset.active;

    if (manualActive) {
        document.getElementById(manualActive).classList.add("active");
        return;
    }

    const path = window.location.pathname;

    if (path.includes("karteikarten")) {
        document.getElementById("karteikarten").classList.add("active");
    }

    else if (path.includes("wortschatz")) {
        document.getElementById("wortschatz").classList.add("active");
    }

    else if (path.includes("einstellungen")) {
        document.getElementById("einstellung").classList.add("active");
    }

    else if (path.includes("index")) {
        document.getElementById("übersicht").classList.add("active");
    }
}