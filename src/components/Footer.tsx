import { ENGINE_VERSION, ASSUMPTION_VERSION } from '../contracts/versions';

type GovernancePage = 'scope' | 'methodology' | 'privacy' | 'neutrality';

export default function Footer({ onNavigate }: { onNavigate: (page: GovernancePage) => void }) {
  return (
    <footer className="site-footer">
      <nav className="footer-links">
        <button className="footer-link" onClick={() => onNavigate('scope')}>Scope</button>
        <button className="footer-link" onClick={() => onNavigate('methodology')}>Methodology</button>
        <button className="footer-link" onClick={() => onNavigate('neutrality')}>Neutrality</button>
        <button className="footer-link" onClick={() => onNavigate('privacy')}>Privacy</button>
      </nav>
      <p className="footer-meta">
        Engine v{ENGINE_VERSION} &nbsp;·&nbsp; Assumptions {ASSUMPTION_VERSION}
      </p>
    </footer>
  );
}
