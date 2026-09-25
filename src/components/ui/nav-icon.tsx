import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import BarChartRounded from "@mui/icons-material/BarChartRounded";
import DashboardRounded from "@mui/icons-material/DashboardRounded";
import FlagRounded from "@mui/icons-material/FlagRounded";
import HandshakeRounded from "@mui/icons-material/HandshakeRounded";
import PieChartRounded from "@mui/icons-material/PieChartRounded";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import type { ComponentType } from "react";

import type { NavIconName } from "@/lib/ui/nav";

const ICONS: Record<NavIconName, ComponentType<SvgIconProps>> = {
  dashboard: DashboardRounded,
  transactions: SwapHorizRounded,
  accounts: AccountBalanceWalletRounded,
  budgets: PieChartRounded,
  goals: FlagRounded,
  investments: TrendingUpRounded,
  debts: HandshakeRounded,
  reports: BarChartRounded,
};

/**
 * Navigation icons: Material "Rounded" icons, so every glyph matches the
 * rounded geometry of the rest of the UI. Decorative (`aria-hidden`), because
 * each is paired with a visible or labelled text node.
 */
export function NavIcon({
  name,
  fontSize = "small",
}: {
  name: NavIconName;
  fontSize?: SvgIconProps["fontSize"];
}) {
  const Icon = ICONS[name];
  return <Icon fontSize={fontSize} aria-hidden="true" />;
}
