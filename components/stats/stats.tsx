import styles from "./stats.module.css"
import XpChart from "./stats-types/xp-chart";
export default function Stats() {
    return(
        <div className={styles.stats}>
            <div className={styles.box1} style={{ gridArea: "box1" }}>
            </div>
            <div className={styles.box2} style={{ gridArea: "box2" }}>
                <XpChart />
            </div>
            <div className={styles.box3} style={{ gridArea: "box3" }}>

            </div>
            <div className={styles.box4} style={{ gridArea: "box4" }}>
            </div>
        </div>
    );
}