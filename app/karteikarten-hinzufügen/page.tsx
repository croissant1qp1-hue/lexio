import Image from "next/image"
import styles from "@/app/styles/modules/vokabeln-hinzufügen/vokabeln-hinzufügen.module.css"

export default function SeiteSpracheAuswahl() {
    return (
        <>
        <div className={styles.seiteSpracheAuswahl} id="seite-sprache-auswahl">
            <div className={styles.überschriftDiv}>
                <h3 className={styles.überschrift}>Welche Sprache möchtest du lernen</h3>
            </div>
            <div className={styles.sprachenAuswahl}>
                <div className="row1">
                    <Image src="/images/vokabel-karten-hinzufügen/sprache-auswählen/englisch.svg" className={styles.spracheAuswählenImg} alt="englisch-card" id="englisch-button" width={412} height={412} />
                    <Image src="/images/vokabel-karten-hinzufügen/sprache-auswählen/französisch.svg" className={styles.spracheAuswählenImg} alt="franz-card" id="französisch-button" width={412} height={412} />
                </div>
                <div className="row2">
                    <Image src="/images/vokabel-karten-hinzufügen/sprache-auswählen/italienisch.svg" className={styles.spracheAuswählenImg} alt="italienisch-card" id="italienisch-button" width={412} height={412} />
                    <Image src="/images/vokabel-karten-hinzufügen/sprache-auswählen/spanisch.svg" className={styles.spracheAuswählenImg} alt="spanisch-card" id="spanisch-button" width={412} height={412} />
                </div>
            </div>
        </div>
        </>
    );
}