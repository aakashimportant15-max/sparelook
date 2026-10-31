import type { Metadata } from "next";
import { NotFoundView } from "@/components/NotFoundView";

export const metadata: Metadata = { title: "Not found" };

export default function NotFoundViewPage() {
  return <NotFoundView />;
}
