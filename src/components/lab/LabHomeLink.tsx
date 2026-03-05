import './lab.css';

export default function LabHomeLink({ onHome }: { onHome: () => void }) {
  return (
    <button className="lab-home" onClick={onHome}>
      ← Home
    </button>
  );
}
