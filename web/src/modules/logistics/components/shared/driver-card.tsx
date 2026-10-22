import { initials } from "./bits";

export interface DriverVehicle { type?: string; make?: string; model?: string; color?: string; licensePlate?: string }

/**
 * Who is coming: photo (or initials), name, rating, the car and its plate. Server-safe
 * (no hooks) so any module's tracking screen can use it — Logistics trips and Eat orders.
 * Props are stable; add new ones as optional.
 */
export function DriverCard({ name, photo, rating, vehicle, note }: { name: string; photo?: string; rating?: number; vehicle?: DriverVehicle | null; note?: string }) {
  const car = vehicle ? [vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.type || "" : "";
  return (
    <div className="mv-driver">
      <div className="mv-driver-who">
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="mv-driver-av" src={photo} alt={name} />
          : <span className="mv-driver-av" aria-hidden>{initials(name)}</span>}
        <div className="mv-driver-txt">
          <b>{name}</b>
          <small>{[rating ? `★ ${Number(rating).toFixed(1)}` : null, note].filter(Boolean).join(" · ")}</small>
        </div>
      </div>
      {(vehicle?.licensePlate || car) && (
        <div className="mv-driver-car">
          {vehicle?.licensePlate && <span className="mv-plate">{vehicle.licensePlate}</span>}
          {car && <small>{car}</small>}
        </div>
      )}
    </div>
  );
}
