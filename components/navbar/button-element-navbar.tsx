"use client";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css";
export default function ButtonElementNavbar({ name, icon, link }: { name: string; icon: string; link: string }) {
    const router = useRouter();
    const pathname = usePathname();
    return (
        <button id={name.toLowerCase()} onClick={() => router.push(link)} className={(pathname === link) ? "button active" : "button"}>
            <i className={icon}></i>
            {name}
        </button>
    );
};