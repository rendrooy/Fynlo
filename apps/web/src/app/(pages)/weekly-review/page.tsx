import { redirect } from "next/navigation";

// Keeps saved links to the page's old name working.
export default function WeeklyReviewPage() {
  redirect("/review");
}
