"use client";

import {
  Computer,
  FileText,
  Headphones,
  HelpCircle,
  KeyRound,
  Mail,
  Monitor,
  Package,
  Printer,
  Server,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  Wifi,
} from "lucide-react";

const iconMap = {
  Computer,
  FileText,
  Headphones,
  HelpCircle,
  KeyRound,
  Mail,
  Monitor,
  Package,
  Printer,
  Server,
  Settings,
  Shield,
  User,
  Users,
  Wifi,
  Apps: Settings,
  DesktopWindows: Monitor,
  Email: Mail,
  ManageAccounts: UserCog,
  PersonAdd: UserCog,
  Print: Printer,
  SupportAgent: Headphones,
  WifiOff: Wifi,
  support_agent: Headphones,
};

export default function CatalogIcon({ name, size = 18 }: { name?: string | null; size?: number }) {
  const Icon = iconMap[name as keyof typeof iconMap] || HelpCircle;
  return <Icon size={size} />;
}
