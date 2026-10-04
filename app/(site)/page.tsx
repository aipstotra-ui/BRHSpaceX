import { redirect } from "next/navigation";

/** Until the landing page lands, the address people already use keeps working. */
export default function HomePage() {
  redirect("/test");
}
