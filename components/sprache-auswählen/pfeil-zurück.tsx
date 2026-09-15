'use client';
import { useRouter } from "next/navigation";
import styles from "./pfeil-zurück-page.module.css"
export default function PfeilZurück() {
    const router = useRouter()
    return (
        <div className={styles.pfeilVokabelnHinzufügenText}>
            <svg
                onClick={() => {router.push("/")}}
                xmlns="http://www.w3.org/2000/svg"
                height={"clamp(20px, 2vw, 32px)"}
                viewBox="0 -960 960 960"
                width={"clamp(20px, 2vw, 32px)"}
                fill="#e3e3e3">

                <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />

            </svg>
            <h2>Vokabeln hinzufügen</h2>
        </div>
    )
}