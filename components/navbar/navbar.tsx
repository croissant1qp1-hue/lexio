import "./side-bar.css";
import "@/app/global.css";
import Image from "next/image";
import ButtonElementNavbar from "./button-element-navbar";
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
        <Image 
        alt="Logo" 
        className="logo" 
        src="/images/logo.png"
        width={1254}
        height={1254} />
        
        <h4 className="title">Lexio</h4>
    </div>

    <div className="side-bar-menu">
        {Object.values(navbarElemente).map((element) => (
            <ButtonElementNavbar
                key={element.name}
                name={element.name}
                icon={element.icon}
                link={element.link}
            />
        ))}
    </div>

    <div className="streak">
        <div className="streak-count">🔥18</div>
        <div className="streak-label">Tage Streak</div>
    </div>

    <div className="Profile">
        <div className="profile-data">
            <div className="profile-pic-container">
                <Image 
                alt="Profilbild" 
                className="profile-pic" 
                src="/images/profile_pic.png"
                width={170}
                height={170}
                />
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
)};