import { redirect } from "next/navigation";

// The library and the path are now one screen. Keep the old URL working.
export default function LibraryPage() {
  redirect("/path");
}
