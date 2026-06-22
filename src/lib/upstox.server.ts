// Server-only Upstox v2 REST client. Never import from client code.
// Docs: https://upstox.com/developer/api-documentation/

export const UPSTOX_INSTRUMENTS: Record<string, string> = {
  NIFTY50: "NSE_INDEX|Nifty 50",
  BANKNIFTY: "NSE_INDEX|Nifty Bank",
  FINNIFTY: "NSE_INDEX|Nifty Fin Service",
  MIDCPNIFTY: "NSE_INDEX|NIFTY MID SELECT",
  NIFTYNXT50: "NSE_INDEX|Nifty Next 50",
  SENSEX: "BSE_INDEX|SENSEX",
};

const BASE = "https://api.upstox.com/v2";
const BASE_V3 = "https://api.upstox.com/v3";

export class UpstoxError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call(path: string, token: string, base: string = BASE) {
  const res = await fetch(`${base}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Api-Version": "2.0",
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new UpstoxError(res.status, text.slice(0, 300));
  }
  if (!res.ok) {
    const msg =
      (body as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message ??
      `Upstox ${res.status}`;
    throw new UpstoxError(res.status, msg);
  }
  return body as { data: unknown };
}

export type LiveQuote = {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePct: number;
  ts: string;
};

export async function fetchQuote(token: string, marketIndex: string): Promise<LiveQuote> {
  const key = UPSTOX_INSTRUMENTS[marketIndex];
  if (!key) throw new Error(`Unknown index ${marketIndex}`);
  const q = new URLSearchParams({ instrument_key: key });
  const body = await call(`/market-quote/quotes?${q.toString()}`, token);
  const data = body.data as Record<string, Record<string, unknown>>;
  const first = Object.values(data)[0] ?? {};
  const ltp = Number(first.last_price ?? 0);
  const ohlc = (first.ohlc as Record<string, number> | undefined) ?? { open: 0, high: 0, low: 0, close: 0 };
  const close = Number(ohlc.close ?? 0);
  const change = ltp - close;
  return {
    symbol: marketIndex,
    ltp,
    open: Number(ohlc.open ?? 0),
    high: Number(ohlc.high ?? 0),
    low: Number(ohlc.low ?? 0),
    close,
    change,
    changePct: close ? (change / close) * 100 : 0,
    ts: String(first.timestamp ?? new Date().toISOString()),
  };
}

export async function fetchExpiries(token: string, marketIndex: string): Promise<string[]> {
  const key = UPSTOX_INSTRUMENTS[marketIndex];
  if (!key) throw new Error(`Unknown index ${marketIndex}`);
  const q = new URLSearchParams({ instrument_key: key });
  const body = await call(`/option/contract?${q.toString()}`, token);
  const arr = (body.data as Array<{ expiry: string }>) ?? [];
  const set = new Set<string>();
  for (const c of arr) if (c.expiry) set.add(c.expiry);
  return Array.from(set).sort();
}

export type OptionContract = {
  strike: number;
  call_key: string;
  put_key: string;
};

/**
 * Returns one row per strike for the requested expiry with the Upstox
 * instrument_key for both CE and PE legs — needed to subscribe over the
 * Market Data Feed v3 WebSocket.
 */
export async function fetchOptionContracts(
  token: string,
  marketIndex: string,
  expiry: string,
): Promise<{ underlying_key: string; contracts: OptionContract[] }> {
  const key = UPSTOX_INSTRUMENTS[marketIndex];
  if (!key) throw new Error(`Unknown index ${marketIndex}`);
  const q = new URLSearchParams({ instrument_key: key });
  const body = await call(`/option/contract?${q.toString()}`, token);
  const arr = (body.data as Array<{
    expiry: string;
    strike_price: number;
    instrument_type: string; // "CE" | "PE"
    instrument_key: string;
  }>) ?? [];
  const byStrike = new Map<number, { call_key?: string; put_key?: string }>();
  for (const c of arr) {
    if (c.expiry !== expiry) continue;
    const strike = Number(c.strike_price);
    const slot = byStrike.get(strike) ?? {};
    if (c.instrument_type === "CE") slot.call_key = c.instrument_key;
    else if (c.instrument_type === "PE") slot.put_key = c.instrument_key;
    byStrike.set(strike, slot);
  }
  const contracts: OptionContract[] = [];
  for (const [strike, v] of byStrike.entries()) {
    if (v.call_key && v.put_key) contracts.push({ strike, call_key: v.call_key, put_key: v.put_key });
  }
  contracts.sort((a, b) => a.strike - b.strike);
  return { underlying_key: key, contracts };
}

/**
 * Upstox V3 Market Data Feed authorize. Returns a short-lived signed WSS URL
 * the browser can connect to directly — no server WebSocket relay needed.
 * Docs: https://upstox.com/developer/api-documentation/market-quote/market-data-feed-v3
 */
export async function getMarketFeedAuthorization(token: string): Promise<string> {
  const body = await call(`/feed/market-data-feed/authorize`, token);
  const data = body.data as { authorized_redirect_uri?: string } | null;
  const url = data?.authorized_redirect_uri;
  if (!url) throw new Error("Upstox feed authorize: missing authorized_redirect_uri");
  return url;
}

export type OptionLeg = {
  ltp: number;
  oi: number;
  oi_change: number;
  volume: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
};
export type OptionRow = {
  strike: number;
  call: OptionLeg;
  put: OptionLeg;
};
export type OptionChain = {
  spot: number;
  expiry: string;
  rows: OptionRow[];
  pcr: number;
  max_pain: number;
  total_call_oi: number;
  total_put_oi: number;
};

function leg(side: Record<string, unknown> | undefined): OptionLeg {
  const md = (side?.market_data as Record<string, number> | undefined) ?? {};
  const g = (side?.option_greeks as Record<string, number> | undefined) ?? {};
  return {
    ltp: Number(md.ltp ?? 0),
    oi: Number(md.oi ?? 0),
    oi_change: Number(md.prev_oi != null ? Number(md.oi ?? 0) - Number(md.prev_oi) : 0),
    volume: Number(md.volume ?? 0),
    iv: Number(g.iv ?? 0),
    delta: Number(g.delta ?? 0),
    gamma: Number(g.gamma ?? 0),
    theta: Number(g.theta ?? 0),
    vega: Number(g.vega ?? 0),
  };
}

function maxPain(rows: OptionRow[]): number {
  if (!rows.length) return 0;
  let best = rows[0].strike;
  let bestPain = Infinity;
  for (const r of rows) {
    let pain = 0;
    for (const s of rows) {
      if (s.strike < r.strike) pain += (r.strike - s.strike) * s.call.oi;
      else if (s.strike > r.strike) pain += (s.strike - r.strike) * s.put.oi;
    }
    if (pain < bestPain) {
      bestPain = pain;
      best = r.strike;
    }
  }
  return best;
}

export async function fetchOptionChain(
  token: string,
  marketIndex: string,
  expiry: string,
): Promise<OptionChain> {
  const key = UPSTOX_INSTRUMENTS[marketIndex];
  if (!key) throw new Error(`Unknown index ${marketIndex}`);
  const q = new URLSearchParams({ instrument_key: key, expiry_date: expiry });
  const body = await call(`/option/chain?${q.toString()}`, token);
  const arr = (body.data as Array<Record<string, unknown>>) ?? [];
  const rows: OptionRow[] = arr
    .map((r) => ({
      strike: Number(r.strike_price ?? 0),
      call: leg(r.call_options as Record<string, unknown> | undefined),
      put: leg(r.put_options as Record<string, unknown> | undefined),
    }))
    .sort((a, b) => a.strike - b.strike);
  const spot = Number((arr[0]?.underlying_spot_price as number) ?? 0);
  const total_call_oi = rows.reduce((s, r) => s + r.call.oi, 0);
  const total_put_oi = rows.reduce((s, r) => s + r.put.oi, 0);
  const pcr = total_call_oi ? total_put_oi / total_call_oi : 0;
  return {
    spot,
    expiry,
    rows,
    pcr,
    max_pain: maxPain(rows),
    total_call_oi,
    total_put_oi,
  };
}
