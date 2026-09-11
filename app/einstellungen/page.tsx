'use client';
import "./einstellung.css"
export default function Einstellungen() {
    return(
        <>
        <div className="kopfzeile">
            <h4 className="überschrift">
                Einstellungen
            </h4>

            <p className="unterüberschrift">
                Passe Lexio an deine Bedürfnisse an
            </p>
        </div>

        <div className="main-content">
            <div className="allgemein">
                <h4 className="text-prog">Allgemein</h4>

                <p className="überschrift-sprache">
                    Sprache
                </p>
                <select id="sprache" className="input-field" name="sprache">
                    <option value="deutsch">
                        🇩🇪 Deutsch
                    </option>
                    <option value="englisch">
                        🇬🇧🇺🇸 Englisch
                    </option>
                </select>
                <p className="überschrift-land">
                    Land
                </p>
                <select id="land" className="input-field" name="land">
                    <option value="deutschland">
                        🇩🇪 Deutschland
                    </option>
                    <option value="österreich">
                        🇦🇹 Österreich
                    </option>
                    <option value="schweiz">
                        🇨🇭 Schweiz
                    </option>
                </select>
                <p className="überschrift-design">
                    Design
                </p>
                <select id="design" className="input-field" name="design">
                    <option value="Hell">
                        Hell Mode
                    </option>
                    <option value="Dunkel">
                        Dark Mode
                    </option>
                </select>
                <div className="töne">
                    <div>
                        <p className="überschrift-töne">
                            Töne aktivieren
                        </p>
                        <p className="unterüberschrift-töne">
                            Aktiviere Töne für besseres Lernen
                        </p>
                    </div>

                    <label className="switch2">
                        <input id="tonAn" type="checkbox" />
                        <span className="slider"></span>
                    </label>
                </div>
                    
                <p className="überschrift-tonstärke">Ton Lautstärke</p>
                <select id="tonstärke" className="input-field" name="tonstärke">
                    <option value="leise">
                        Leise
                    </option>
                    <option value="normal">
                        Normal
                    </option>
                    <option value="laut">
                        Laut
                    </option>
                </select>



            </div>

            <div className="restliche-einstellungen">

                <div className="benarichtigung">
                    <h4 className="text-prog">
                        Benarichtigung
                    </h4>
                    <div className="dayly-reminders">
                        <div>
                            <p className="überschrift-reminder">
                                Tägliche Erinnerung
                            </p>
                            <p className="unterüberschrift-reminder">
                                Erhalte eine tägliche Lernerinnerung
                            </p>
                        </div>
                        
                        <label className="switch">
                            <input id="dailyReminder" type="checkbox" />
                            <span className="slider"></span>
                        </label>
                    </div>

                </div>

                <div className="daten">
                    <h4 className="text-prog">
                        Daten
                    </h4>
                    <div className="daten-weiteres">
                        <div className="email">
                            <p className="überschrift-email">
                                Email
                            </p>
                            <input type="email" className="email-input" placeholder="Email" name="email" />
                            <select className="email-variante">
                                <option value="@gmail.com">
                                    @gmail.com
                                </option>
                                <option value="@yahoo.com">
                                    @yahoo.com
                                </option>
                                <option value="@hotmail.com">
                                    @hotmail.com
                                </option>
                                <option value="@outlook.com">
                                    @outlook.com
                                </option>
                                <option value="@icloud.com">
                                    @icloud.com
                                </option>
                                <option value="@gmx.de">
                                    @gmx.de
                                </option>
                            </select>
                        

                        </div>
                        <div className="passwort">
                            <p className="überschrift-passwort">
                                Passwort
                            </p>
                            <input type="password" className="passwort-input" placeholder="Passwort" />

                        </div>

                    </div>

                </div>

                <div className="sonstiges">
                    <h4 className="text-prog">
                        Sonstiges
                    </h4>
                    <div className="feedback">
                        <div>
                            <p className="überschrift-feedback">
                                Feedback
                            </p>
                            <p className="unterüberschrift-feedback">
                                Hilf uns, Lexio besser zu machen
                            </p>
                        </div>
                        <div className="feedback-wrapper">
                            <button className="feedback-button">
                                Feedback
                            </button>
                            <div className="feedback-dropdown">
                                <a href="mailto:deine@email.com" target="_blank">
                                    <i className="fa-solid fa-envelope"></i> Email
                                </a>
                                <a href="https://instagram.com/deinaccount" target="_blank">
                                    <i className="fa-brands fa-instagram"></i> Instagram
                                </a>
                                <a href="https://tiktok.com/@deinaccount" target="_blank">
                                    <i className="fa-brands fa-tiktok"></i> TikTok
                                </a>
                            </div>
                        </div>

                    </div>

                    <div className="about">
                        <div className="about-container">
                            <p className="überschrift-about">
                                Über Lexio
                            </p>
                            <p className="unterüberschrift-about">
                                Version 1.0.0
                            </p>
                        </div>
                        <button className="about-button" onClick={() => window.open('./about.html', '_blank')}>
                            Mehr erfahren
                        </button>

                    </div>
                </div>

            </div>

        </div>
        <div className="footer">
            <button id="reset-button" className="reset-button">
                Einstellungen zurücksetzen
            </button>

            <button id="saveButton" className="save-button">
                Einstellungen speichern
            </button>
        </div>
        </>
    );
}