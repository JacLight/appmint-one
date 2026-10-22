/**
 * Logistics (muvmnt) data shapes — the engine's `delivery_job` / `delivery_agent`
 * records as appengine `client/logistics/*` returns them
 * (/Users/imzee/projects/appengine/src/logistics, schema in dbsdk models/logistics).
 * Plain types only: safe to import from server AND client code.
 */

/** The engine's job statuses, verbatim (delivery.service.ts JobStatus) plus the two
 *  it writes outside the enum: `awaiting_payment` (order created, card not confirmed)
 *  and `payment_failed`. `draft` is in the schema enum. */
export type JobStatus =
  | "draft"
  | "awaiting_payment"
  | "payment_failed"
  | "pending"
  | "broadcasting"
  | "assigned"
  | "en_route_pickup"
  | "arrived_pickup"
  | "picked_up"
  | "en_route_dropoff"
  | "arrived_dropoff"
  | "delivered"
  | "completed"
  | "cancelled"
  | "failed";

export interface StopAddress {
  street1?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  zipCode?: string;
  country?: string;
}

export interface JobStop {
  sequence?: number;
  type: "pickup" | "dropoff";
  status?: "pending" | "en_route" | "arrived" | "completed" | "failed";
  location: {
    lat?: number;
    lng?: number;
    address?: string | StopAddress;
    formattedAddress?: string;
    placeName?: string;
  };
  contact?: { name?: string; phone?: string; email?: string };
  instructions?: string;
  items?: { description: string; quantity?: number; weight?: number }[];
  /** Schema field on the stop — carries "now" vs a scheduled time. */
  timeWindow?: { type: "asap" | "scheduled" | "window"; scheduledAt?: string };
  arrivedAt?: string;
  completedAt?: string;
  proof?: { photos?: ProofFile[]; images?: ProofFile[]; notes?: string; recipientName?: string; collectedAt?: string };
}

export interface ProofFile { path?: string; url?: string; contentType?: string }

export interface TimelineEvent {
  timestamp: string;
  event: string;
  description?: string;
  actor?: string;
}

export interface DeliveryJob {
  jobNumber: string;
  status: JobStatus;
  customer?: { customerId?: string; firstName?: string; lastName?: string; email?: string; phone?: string };
  stops: JobStop[];
  notes?: string;
  scheduling?: { type?: "asap" | "scheduled"; scheduledDate?: string };
  tracking?: {
    distance?: number;
    duration?: number;
    liveLocation?: { lat: number; lng: number; updatedAt?: string };
    estimatedArrival?: string;
  };
  /** Customer-side money — stripped by the engine for drivers. */
  pricing?: { currency?: string; total?: number; basePrice?: number; tip?: number };
  payment?: { method?: string; status?: string; amount?: number; currency?: string; paidAt?: string; stripePaymentIntentId?: string; refund?: { amount?: number; processedAt?: string } };
  /** Driver-side money — what the driver earns on this job. */
  driverPay?: { total?: number; basePay?: number; tip?: number };
  earnings?: { driverTotal?: number; driverTip?: number; status?: string; creditedAt?: string };
  assignment?: { mode?: string; agent?: string; agentName?: string; agentPhone?: string; agentPhoto?: string; assignedAt?: string; acceptedAt?: string };
  timeline?: TimelineEvent[];
  images?: (ProofFile & { category?: string; stopIndex?: number; addedAt?: string })[];
  issues?: { id: string; type: string; description?: string; status?: string; reportedAt?: string }[];
  rating?: { value: number; comment?: string; ratedAt?: string };
  cancellation?: { cancelledAt?: string; cancelledBy?: string; reason?: string; refundPercent?: number; refundAmount?: number; refundProcessed?: boolean };
  failure?: { reason?: string; notes?: string; failedAt?: string };
}

export interface JobEnvelope {
  sk: string;
  data: DeliveryJob;
  createdate?: string;
  modifydate?: string;
}

/** GET orders/:jobId/track — the customer's live view. */
export interface TrackView {
  jobId: string;
  status: JobStatus;
  tracking?: { currentLocation?: { lat: number; lng: number; updatedAt?: string }; lastUpdate?: string; estimatedArrival?: string };
  agent?: {
    name?: string;
    phone?: string;
    photo?: string;
    rating?: number;
    vehicle?: { type?: string; make?: string; model?: string; color?: string; licensePlate?: string };
    currentLocation?: { lat: number; lng: number };
  } | null;
}

export type AgentStatus = "pending" | "under_review" | "approved" | "active" | "suspended" | "inactive" | "rejected";

export interface DriverProfile {
  sk: string;
  name?: string;
  data: {
    status: AgentStatus;
    availability?: "online" | "offline" | "busy";
    vehicles?: { type?: string; make?: string; model?: string; color?: string; licensePlate?: string; isPrimary?: boolean }[];
    performance?: { totalJobs?: number; completedJobs?: number; averageRating?: number; totalRatings?: number; deliveriesToday?: number; deliveriesThisWeek?: number };
    appliedAt?: string;
  };
}
