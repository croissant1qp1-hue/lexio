import KarteikartenUebersicht from '@/components/karteikarten-übersicht';
import "./main-body.css";

export default function Home() {
  return (
    <>
    <div className="heading-und-xp">
                <h4 className="heading-kartenhaus">Kartenhaus</h4>
            </div>
            <KarteikartenUebersicht />
            <div className="stats">

                <div className="progress">

                    <h4 className="text-prog">Fortschritt</h4>

                    <div className="ring-rest">

                        <div className="ring" style={{ "--progress": 65 } as React.CSSProperties}>

                            <div className="inner">
                                <span>65%</span>
                            </div>

                        </div>


                        <div className="gelernte-karten-rest-stats">

                            <div className="vokabs-gelernt">

                                <div className="vokabeln-gelernt-div-inner">
                                    <p>Vokabeln gelernt:</p>
                                </div>

                                <div className="num-gelernt">
                                    <h6>350</h6>
                                </div>

                            </div>

                        </div>

                    </div>

                </div>


                <div className="Erfolge">

                </div>


            </div>
  </>

  );
}
