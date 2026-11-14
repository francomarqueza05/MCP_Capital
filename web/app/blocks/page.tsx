import { redirect } from "next/navigation";

// The library opens on the first family; each family has its own page.
export default function Page() {
  redirect("/blocks/michael-carter");
}
