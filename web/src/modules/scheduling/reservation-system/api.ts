// Stands in for base-app/src/modules/reservation-system/api (getReservationAPI), with the
// same method names, so the ported screens keep their calls. Each goes through a server
// action to @/api/reservations; a failure is thrown in the shape the screens read
// (error.response.data.message).
import { availabilityAction, cancelByEmailAction, rescheduleByEmailAction } from "../actions/reservations";

type Result = { ok: true; data?: any } | { ok: false; error: string };

const unwrap = (r: Result) => {
  if (!r.ok) throw { response: { data: { message: r.error } } };
  return r.data;
};

const api = {
  getAvailability: async (request: { reservationDefinitionId: string; serviceName?: string; from?: string; days?: number; host?: string; excludeReservationId?: string }) =>
    unwrap(await availabilityAction(request)),
  rescheduleReservationByEmail: async (email: string, reservationNumber: string, body: { startTime: string; reason?: string }) =>
    unwrap(await rescheduleByEmailAction(email, reservationNumber, body)),
  cancelReservation: async (email: string, reservationNumber: string, reason?: string) => {
    unwrap(await cancelByEmailAction(email, reservationNumber, reason));
    return true;
  },
};

export const getReservationAPI = () => api;
