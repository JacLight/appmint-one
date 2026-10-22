import type { Metadata } from "next";
import { AppPage } from "@/modules/logistics/components/app-page";

export const metadata: Metadata = { title: "Drive with us", description: "Deliver food, packages and rides on your own time. Apply in the driver app." };

export default function DrivePage() {
  return <AppPage service="drive" />;
}
