import styles from "./sprachen-auswählen-seite.module.css"
import TextundPfeilZurück from "@/components/sprache-auswählen/top-of-page/text-und-pfeil-zurück"
import TextUnterUeberschrift from "@/components/sprache-auswählen/top-of-page/text-unterueberschrift"
export default function SpracheAuswaählen() {
    return (
        <div className={styles["sprache-auswählen-layout"]}>
            <div className={styles["überschrift-zurück-icon"]}>
                <TextundPfeilZurück />
            </div>
            <div className={styles.mainPartSeite}>
                <div className={styles["text-unterüberschirft"]}>
                    <TextUnterUeberschrift />
                </div>
                <div className={styles["cards-sprachen"]}></div>
            </div>
        </div>
    )
}