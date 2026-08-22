import { Activity, ArrowUpRight, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import floodGuardLogo from "../FloodGuard.png";

import "./FloodFooter.css";

const MIN_LEVEL = 20;
const MAX_LEVEL = 80;
const INITIAL_LEVEL = 42;

function randomLevel() {
  return MIN_LEVEL + Math.random() * (MAX_LEVEL - MIN_LEVEL);
}

export default function FloodFooter() {
  const [level, setLevel] = useState(INITIAL_LEVEL);

  useEffect(() => {
    const intervalId = window.setInterval(() => setLevel(randomLevel()), 4500);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <footer className="flood-footer">
      <div className="flood-footer__water" style={{ height: level + "%" }} aria-hidden="true">
        <svg className="flood-footer__wave flood-footer__wave--middle" viewBox="0 0 1200 54" preserveAspectRatio="none">
          <path d="M0 22C100 48 200 2 300 22S500 48 600 22V54H0Z" />
          <path d="M600 22C700 48 800 2 900 22S1100 48 1200 22V54H600Z" />
        </svg>
        <svg className="flood-footer__wave flood-footer__wave--front" viewBox="0 0 1200 42" preserveAspectRatio="none">
          <path d="M0 17C100 40 200 0 300 17S500 40 600 17V42H0Z" />
          <path d="M600 17C700 40 800 0 900 17S1100 40 1200 17V42H600Z" />
        </svg>
      </div>

      <div className="flood-footer__content">
        <div className="flood-footer__brand">
          <div className="flood-footer__brand-mark">
            <img src={floodGuardLogo} alt="FloodGuard logo" className="h-9 w-9 rounded-lg object-contain" />
          </div>
          <div>
            <p className="flood-footer__eyebrow">Community safety network</p>
            <h2>FloodGuard</h2>
            <p className="flood-footer__description">Real-time flood monitoring and early-warning alerts for safer communities.</p>
          </div>
        </div>

        <nav className="flood-footer__links" aria-label="Footer navigation">
          <div>
            <h3>Explore</h3>
            <Link to="/alerts">Alerts <ArrowUpRight size={13} /></Link>
            <Link to="/safety">Flood safety <ArrowUpRight size={13} /></Link>
            <Link to="/map">Flood map <ArrowUpRight size={13} /></Link>
            <Link to="/history">Flood history <ArrowUpRight size={13} /></Link>
          </div>
          <div>
            <h3>Participate</h3>
            <Link to="/reports/community">Community reports <ArrowUpRight size={13} /></Link>
            <Link to="/reports/submit">Report a flood <ArrowUpRight size={13} /></Link>
            <Link to="/register">Create account <ArrowUpRight size={13} /></Link>
          </div>
        </nav>

        <div className="flood-footer__status" aria-label={"Animated water level is " + Math.round(level) + " percent"}>
          <div className="flood-footer__status-heading">
            <span className="flood-footer__status-icon"><Activity size={16} /></span>
            <span>Water level pulse</span>
            <span className="flood-footer__live-dot" aria-hidden="true" />
          </div>
          <strong>{Math.round(level)}%</strong>
          <p>Monitoring active</p>
          <div className="flood-footer__meter" aria-hidden="true"><span style={{ width: level + "%" }} /></div>
        </div>
      </div>

      <div className="flood-footer__bottom">
        <span>Copyright {new Date().getFullYear()} FloodGuard System</span>
        <span className="flood-footer__bottom-note"><Waves size={14} /> Prepared for changing water levels</span>
      </div>
    </footer>
  );
}
