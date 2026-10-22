import type { Metadata } from "next";
import { AppPage } from "@/modules/logistics/components/app-page";

export const metadata: Metadata = { title: "Send a package", description: "Send anything across town in the app, at a fixed price, tracked to the door." };

export default function SendPage() {
  return <AppPage service="send" />;
}
