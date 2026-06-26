import { redirect } from "next/navigation";

/** Legacy entry — one unified home at Office Hub. */
export default function PortalPage() {
  redirect("/office-hub");
}
