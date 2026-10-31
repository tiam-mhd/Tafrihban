import { redirect } from "next/navigation";
import { requireOperationalActor } from "@/server/auth-guards";

export default async function OperationalPasswordPage() {
  await requireOperationalActor();
  redirect("/app/select-scope");
}
