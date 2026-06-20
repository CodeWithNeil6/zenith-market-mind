export const INDICES = [
  { value: "NIFTY50", label: "NIFTY 50", tv: "NSE:NIFTY" },
  { value: "BANKNIFTY", label: "BANK NIFTY", tv: "NSE:BANKNIFTY" },
  { value: "SENSEX", label: "SENSEX", tv: "BSE:SENSEX" },
  { value: "FINNIFTY", label: "FINNIFTY", tv: "NSE:NIFTY_FIN_SERVICE" },
  { value: "MIDCPNIFTY", label: "MIDCAP NIFTY", tv: "NSE:NIFTY_MID_SELECT" },
  { value: "NIFTYNXT50", label: "NIFTY NEXT 50", tv: "NSE:NIFTY_NEXT_50" },
] as const;
export type IndexValue = (typeof INDICES)[number]["value"];

export const STYLES = [
  { value: "intraday", label: "Intraday" },
  { value: "swing", label: "Swing Trading" },
  { value: "positional", label: "Positional Trading" },
  { value: "futures", label: "Futures Trading" },
  { value: "options", label: "Options Trading" },
  { value: "longterm", label: "Long-Term Investing" },
] as const;

export const RISKS = [
  { value: "conservative", label: "Conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "aggressive", label: "Aggressive" },
] as const;

export const HORIZONS = [
  { value: "1h", label: "Next 1 Hour" },
  { value: "same_day", label: "Same Trading Day" },
  { value: "next_session", label: "Next Session" },
  { value: "next_day", label: "Next Day" },
  { value: "next_week", label: "Next Week" },
] as const;

export function indexLabel(v: string) {
  return INDICES.find((i) => i.value === v)?.label ?? v;
}
export function tvSymbol(v: string) {
  return INDICES.find((i) => i.value === v)?.tv ?? "NSE:NIFTY";
}
