import { redirect } from "next/navigation";
import { TOTAL_SLUG } from "@/lib/db/types";

// The root sends players to the combined "total" event board.
export default function Home() {
  redirect(`/e/${TOTAL_SLUG}`);
}
