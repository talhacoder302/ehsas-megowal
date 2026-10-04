import type { LucideIcon } from "lucide-react";
import {
  FileChartColumnIcon,
  HandCoinsIcon,
  HeartHandshakeIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { Messages } from "@/i18n/messages";
import type { Role } from "@/lib/roles";

export type ManageNavKey = keyof Messages["manage"]["nav"];

export type ManageNavItem = {
  key: ManageNavKey;
  href: string;
  icon: LucideIcon;
  /** false until the module that builds this screen is done. */
  ready: boolean;
  adminOnly?: boolean;
};

export const manageNavItems: readonly ManageNavItem[] = [
  { key: "dashboard", href: "/manage", icon: LayoutDashboardIcon, ready: true },
  { key: "members", href: "/manage/members", icon: UsersIcon, ready: true },
  { key: "payments", href: "/manage/payments", icon: HandCoinsIcon, ready: false },
  { key: "cases", href: "/manage/cases", icon: HeartHandshakeIcon, ready: false },
  { key: "expenses", href: "/manage/expenses", icon: ReceiptIcon, ready: false },
  { key: "accounts", href: "/manage/accounts", icon: WalletIcon, ready: false },
  { key: "reports", href: "/manage/reports", icon: FileChartColumnIcon, ready: false },
  { key: "users", href: "/manage/users", icon: ShieldCheckIcon, ready: true, adminOnly: true },
  { key: "settings", href: "/manage/settings", icon: SettingsIcon, ready: false, adminOnly: true },
  { key: "profile", href: "/manage/profile", icon: UserIcon, ready: true },
];

export function navItemsFor(role: Role): ManageNavItem[] {
  return manageNavItems.filter((item) => !item.adminOnly || role === "admin");
}
