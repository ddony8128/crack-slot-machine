import { redirect } from "next/navigation";

// The root sends players to the Season 1 hub.
export default function Home() {
  redirect("/season");
}
