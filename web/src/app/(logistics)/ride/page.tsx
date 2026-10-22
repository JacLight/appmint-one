import type { Metadata } from "next";
import { AppPage } from "@/modules/logistics/components/app-page";

export const metadata: Metadata = { title: "Ride", description: "Request a ride in the app: a fixed price before you confirm, and your driver live on the map." };

export default function RidePage() {
  return <AppPage service="ride" />;
}
