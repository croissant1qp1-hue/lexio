import styles from
const navbarElemente = {
    //dieses Dictonary enthält informationen übner die navbar
    übersicht: {
        name: "Übersicht",
        icon: "fa-solid fa-house",
        link: "/"
    },
    karteikarten: {
        name: "Karteikarten",
        icon: "fa-solid fa-book",
        link: "/karteikarten"
    },

    wortschatz: {
        name: "Wortschatz",
        icon: "fa-solid fa-book-open",
        link: "/wortschatz"
    },

    statistiken: {
        name: "Statistiken",
        icon: "fa-solid fa-chart-bar",
        link: "/statistiken"
    },

    einstellung: {
        name: "Einstellung",
        icon: "fa-solid fa-cog",
        link: "/einstellungen"
    }
}
export default function Navbar() {
    return (
<nav className="side-bar">
    <div className="infos">Version 1.0, Lexio™</div>

    <div className="logo-title">
        <img className="logo" src="/Frontend/images/logo.png" />
        <h4 className="title">Lexio</h4>
    </div>

    <div className="side-bar-menu">
        {}
    </div>

    <div className="streak">
        <div className="streak-count">🔥18</div>
        <div className="streak-label">Tage Streak</div>
    </div>

    <div className="Profile">
        <div className="profile-data">
            <div className="profile-pic-container">
                <img className="profile-pic" src="/Frontend/images/profile_pic.png" />
            </div>
            <div className="profile-info">
                <h4 className="profile-name">Mustermann</h4>
                <p className="profile-level">Level 5 • 6777 XP</p>
            </div>
        </div>

        <div className="profile-progression-bar">
            <div className="progression-bar">
                <div className="progression-fill">XP</div>
            </div>
            <div className="progression-procentage">65%</div>
        </div>
    </div>
</nav>
    );
}