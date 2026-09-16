import PfeilZurück from "@/components/sprache-auswählen/top-of-page/pfeil-zurück"
import styles from "./pfeil-zurück-page.module.css"
export default function TextundPfeilZurück() {
    return (
        <div className={styles.topOfpage}>
            <PfeilZurück />
            <h4>Vokabeln hinzufügen</h4>
        </div>
    )
}