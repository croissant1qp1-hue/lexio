document.addEventListener("DOMContentLoaded", () => {

    const emailInput = document.getElementById("email");
    const spracheInput = document.getElementById("sprache");
    const landInput = document.getElementById("land");
    const designInput = document.getElementById("design");
    const tonAnInput = document.getElementById("tonAn");
    const tonstärkeInput = document.getElementById("tonstärke");
    const dailyReminderInput = document.getElementById("dailyReminder");
    const passwortInput = document.getElementById("passwort");


    const savedEmail = localStorage.getItem("email");
    const savedLand = localStorage.getItem("land");
    const savedDesign = localStorage.getItem("design");
    const savedTonAn = localStorage.getItem("tonAn");
    const savedTonstärke = localStorage.getItem("tonstärke");
    const savedDailyReminder = localStorage.getItem("dailyReminder");
    const savedPasswort = localStorage.getItem("passwort");

    if (savedEmail) {
        emailInput.value = savedEmail;
    }

    if (savedLand) {
        landInput.value = savedLand;
    }

    if (savedDesign) {
        designInput.value = savedDesign;
    }

    if (savedLand) {
        landInput.value = savedLand;
    }
    if (savedTonstärke) {
        tonstärkeInput.value = savedTonstärke;
    }

    if (savedPasswort) {
        passwortInput.value = savedPasswort;
    }

    if (savedTonAn !== null) {
        tonAnInput.checked = savedTonAn === "true";
    }

    if (savedDailyReminder !== null) {
        dailyReminderInput.checked = savedDailyReminder === "true";
    }

    saveButton.addEventListener("click", () =>{

        const email =emailInput.value;
        const sprache = spracheInput.value;
        const land = landInput.value;
        const design = designInput.value;
        const tonAn = tonAnInput.checked;
        const tonstärke = tonstärkeInput.value;
        const dailyReminder = dailyReminderInput.checked;
        const passwort = passwortInput.value;

    })
    

    



});