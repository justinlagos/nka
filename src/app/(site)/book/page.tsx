import { redirect } from "next/navigation";

// Calls are booked through the demo now: it collects the same details and sets up a workspace.
export default function Book() {
  redirect("/demo");
}
