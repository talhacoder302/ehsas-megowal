import "server-only";
import { redirect } from "next/navigation";
import { canOpenPath } from "@/lib/roles";
import { getCurrentUser, type CurrentUser } from "./current-user";

/**
 * For layouts and pages. The proxy already routes by the JWT; this checks the
 * database. If the two disagree (account disabled, role changed, password
 * reset by admin) the session is refreshed, which signs the user out or sends
 * them to the right place.
 */
export async function requirePageUser(pathname: string): Promise<CurrentUser> {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || !canOpenPath(pathname, me.role, me.memberId)) {
    redirect(`/api/session/refresh?next=${encodeURIComponent(pathname)}`);
  }
  return me;
}
