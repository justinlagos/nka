import { redirect } from "next/navigation";

// The old case-study list is retired. Examples of the work now live on the homepage.
export default function WorkPage() {
  redirect("/#work");
}
