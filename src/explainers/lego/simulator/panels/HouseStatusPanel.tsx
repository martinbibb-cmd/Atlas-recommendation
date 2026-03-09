/**
 * HouseStatusPanel — stylised static house cutaway.
 *
 * Shows a domestic property layout with floors and rooms.
 * PR1: static. Live per-room temperature / state comes later.
 */

const FLOORS = [
  {
    key: 'loft',
    label: 'Loft',
    className: 'house-floor--loft',
    rooms: ['Loft space', 'Airing cupboard'],
  },
  {
    key: 'first',
    label: 'First floor',
    className: 'house-floor--first',
    rooms: ['Bedroom 1', 'Bedroom 2', 'Bathroom'],
  },
  {
    key: 'ground',
    label: 'Ground floor',
    className: 'house-floor--ground',
    rooms: ['Kitchen', 'Lounge', 'Bathroom / WC'],
  },
  {
    key: 'outside',
    label: 'Outside',
    className: 'house-floor--outside',
    rooms: ['Garden / external'],
  },
] as const;

export default function HouseStatusPanel() {
  return (
    <div className="house-cutaway">
      {FLOORS.map(floor => (
        <div key={floor.key} className={`house-floor ${floor.className}`}>
          <div className="house-floor__label">{floor.label}</div>
          <div className="house-rooms">
            {floor.rooms.map(room => (
              <span key={room} className="house-room">{room}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
