import { redirect } from "next/navigation";

// Books management moved to the friendlier /upload ("Your library") screen.
export default function AdminBooksPage() {
  redirect("/upload");
}
