"use client";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
const router = useRouter();
const pathname = usePathname();
export default function ButtonElementNavbar({ name, icon, link }: { name: string; icon: string; link: string }) {
    return (
        <button id={name.toLowerCase()} onClick={() => router.push(link)} className={(pathname === link) ? "button active" : "button"}>
            <i className={icon}></i>
            {name}
        </button>
    );
};