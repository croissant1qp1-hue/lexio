import styles from "@/components/styles/stats.module.css"
export default function Stats() {
    return(
        <div className={styles.stats}>
            <div className={styles.box1} style={{ gridArea: "box1" }}>
                    test
            </div>
            <div className={styles.box2} style={{ gridArea: "box2" }}>
                test
            </div>
            <div className={styles.box3} style={{ gridArea: "box3" }}>
                    test
            </div>
            <div className={styles.box4} style={{ gridArea: "box4" }}>
                test
            </div>
        </div>
    );
}