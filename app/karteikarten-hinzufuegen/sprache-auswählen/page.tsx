import styles from "./sprachen-auswählen-seite.module.css"
import PfeilZurück from "@/components/sprache-auswählen/pfeil-zurück"
export default function SpracheAuswaählen() {
    return (
        <div className={styles["sprache-auswählen-layout"]}>
            <div className={styles["überschrift-zurück-icon"]}>
                <PfeilZurück />
            </div>
            <div className={styles["text-unterüberschirft"]}></div>
            <div className={styles["cards-sprachen"]}></div>
        </div>
    )
}