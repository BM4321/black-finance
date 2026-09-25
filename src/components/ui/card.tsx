import MuiCard, { type CardProps } from "@mui/material/Card";

/**
 * Surface container, built on Material UI's outlined Card (rounded 16px, see
 * the theme). Padding stays with the caller so lists can run edge to edge.
 */
export function Card(props: CardProps) {
  return <MuiCard {...props} />;
}
