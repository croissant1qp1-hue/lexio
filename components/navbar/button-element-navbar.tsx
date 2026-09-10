"use client";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";

/* Erzeugt immer ein Element der Navbar und setzt es aktiv oder inaktiv. */
type NavButtonProps = { name: string; icon: string; link: string };

export default function ButtonElementNavbar({ name, icon, link }: NavButtonProps) {
    const router = useRouter();
    const pathname = usePathname();

    const safeId = name.toLowerCase().replace(/\s+/g, "-").normalize("NFKD").replace(/[^\w-]/g, "");
    const isActive = pathname === link || (pathname && pathname.startsWith(link + "/"));

    return (
        <button
            id={safeId}
            onClick={() => router.push(link)}
            className={isActive ? "button active" : "button"}
        >
            <i className={icon} aria-hidden="true"></i>
            <span className="button-text">{name}</span>
        </button>
    );
}
