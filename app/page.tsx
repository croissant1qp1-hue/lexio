import KarteikartenUebersicht from '@/components/cards/karteikarten-übersicht';
import Stats from "@/components/stats/stats"
import "@/app/styles/main-body.css";

export default function Home() {
  return (
    <>
    <div className="heading-und-xp">
      <h4 className="heading-kartenhaus">Kartenhaus</h4>
    </div>
    <KarteikartenUebersicht />
    <Stats />
  </>

  );
}
