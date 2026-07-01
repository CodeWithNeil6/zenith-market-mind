// Browser-side Upstox V3 Market Data Feed client.
// - Connects directly to the signed WSS URL returned by getOptionFeedSession.
// - Subscribes in `option_chain` mode (LTP + greeks + OI + IV per instrument).
// - Decodes binary protobuf frames with the inlined MarketDataFeedV3 schema.
// No server relay → tick latency ≈ Upstox's own push latency.

// Use full protobufjs build — `protobufjs/light` does not include the .proto
// text parser (protobuf.parse is undefined there), which surfaced as
// "r(...).default.parse is not a function" in production.
import protobuf from "protobufjs";

// MarketDataFeedV3.proto — trimmed to the messages we actually decode.
// Source: Upstox developer docs, "Market Data Feed (v3)".
const PROTO = `
syntax = "proto3";
package com.upstox.marketdatafeederv3udapi.rpc.proto;

message LTPC { double ltp = 1; int64 ltt = 2; int64 ltq = 3; double cp = 4; }
message Quote { int32 bidQ = 1; double bidP = 2; int32 askQ = 3; double askP = 4; }
message OptionGreeks { double delta = 1; double theta = 2; double gamma = 3; double vega = 4; double rho = 5; }
message OHLC { string interval = 1; double open = 2; double high = 3; double low = 4; double close = 5; int64 vol = 6; int64 ts = 7; }
message MarketOHLC { repeated OHLC ohlc = 1; }
message MarketLevel { repeated Quote bidAskQuote = 1; }
message MarketFullFeed {
  LTPC ltpc = 1;
  MarketLevel marketLevel = 2;
  OptionGreeks optionGreeks = 3;
  MarketOHLC marketOHLC = 4;
  double atp = 5;
  int64 vtt = 6;
  double oi = 7;
  double iv = 8;
  double tbq = 9;
  double tsq = 10;
}
message IndexFullFeed { LTPC ltpc = 1; MarketOHLC marketOHLC = 2; }
message FullFeed {
  oneof FullFeedUnion {
    MarketFullFeed marketFF = 1;
    IndexFullFeed indexFF = 2;
  }
}
message FirstLevelWithGreeks {
  LTPC ltpc = 1;
  Quote firstDepth = 2;
  OptionGreeks optionGreeks = 3;
  int64 vtt = 4;
  double oi = 5;
  double iv = 6;
}
message Feed {
  oneof FeedUnion {
    LTPC ltpc = 1;
    FullFeed fullFeed = 2;
    FirstLevelWithGreeks firstLevelWithGreeks = 3;
  }
  enum RequestMode {
    initial_state = 0;
    ltpc = 1;
    full_d5 = 2;
    option_chain = 3;
    full_d30 = 4;
  }
  RequestMode requestMode = 4;
}
message MarketInfo { string segmentStatus = 1; map<string, string> segmentStatusMap = 2; }
message FeedResponse {
  enum Type { initial_feed = 0; live_feed = 1; market_info = 2; }
  Type type = 1;
  map<string, Feed> feeds = 2;
  string currentTs = 3;
  MarketInfo marketInfo = 4;
}
`;

const root = protobuf.parse(PROTO, { keepCase: false }).root;
const FeedResponse = root.lookupType(
  "com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse",
);

export type Tick = {
  ltp: number;
  oi: number;
  iv: number;
  volume: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  ts: number;
};

export type FeedEvent =
  | { kind: "tick"; instrument_key: string; tick: Tick }
  | { kind: "status"; status: "open" | "closed" | "error"; detail?: string };

export type FeedHandle = {
  close: () => void;
};

export function connectUpstoxOptionFeed(args: {
  wsUrl: string;
  instrumentKeys: string[]; // CE + PE keys
  underlyingKey?: string;
  onEvent: (ev: FeedEvent) => void;
}): FeedHandle {
  const { wsUrl, instrumentKeys, underlyingKey, onEvent } = args;
  let closed = false;
  let ws: WebSocket | null = null;

  const open = () => {
    if (closed) return;
    ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      onEvent({ kind: "status", status: "open" });
      const keys = underlyingKey ? [underlyingKey, ...instrumentKeys] : instrumentKeys;
      // Upstox V3 subscribe payload — text JSON, frames after are binary protobuf.
      const sub = {
        guid: crypto.randomUUID(),
        method: "sub",
        data: { mode: "option_chain", instrumentKeys: keys },
      };
      ws?.send(JSON.stringify(sub));
    };

    ws.onmessage = (msg) => {
      if (!(msg.data instanceof ArrayBuffer)) return;
      try {
        const decoded = FeedResponse.decode(new Uint8Array(msg.data)) as unknown as {
          feeds?: Record<string, RawFeed>;
        };
        const feeds = decoded.feeds;
        if (!feeds) return;
        for (const [key, feed] of Object.entries(feeds)) {
          const tick = projectTick(feed);
          if (tick) onEvent({ kind: "tick", instrument_key: key, tick });
        }
      } catch (err) {
        console.warn("[upstox-feed] decode failed", err);
      }
    };

    ws.onerror = () => {
      onEvent({ kind: "status", status: "error", detail: "socket error" });
    };

    ws.onclose = () => {
      onEvent({ kind: "status", status: "closed" });
      // Caller is responsible for renewing wsUrl + reconnecting; signed URL
      // can't be reused after the socket closes.
    };
  };

  open();

  return {
    close: () => {
      closed = true;
      try { ws?.close(); } catch { /* ignore */ }
    },
  };
}

type RawLTPC = { ltp?: number; ltt?: number | bigint; ltq?: number | bigint };
type RawGreeks = { delta?: number; theta?: number; gamma?: number; vega?: number };
type RawFullMarket = {
  ltpc?: RawLTPC;
  optionGreeks?: RawGreeks;
  vtt?: number | bigint;
  oi?: number;
  iv?: number;
};
type RawFirstLevel = {
  ltpc?: RawLTPC;
  optionGreeks?: RawGreeks;
  vtt?: number | bigint;
  oi?: number;
  iv?: number;
};
type RawFeed = {
  ltpc?: RawLTPC;
  fullFeed?: { marketFF?: RawFullMarket; indexFF?: { ltpc?: RawLTPC } };
  firstLevelWithGreeks?: RawFirstLevel;
};

const n = (v: unknown): number =>
  typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : 0;

function projectTick(feed: RawFeed): Tick | null {
  if (feed.firstLevelWithGreeks) {
    const f = feed.firstLevelWithGreeks;
    return {
      ltp: n(f.ltpc?.ltp),
      oi: n(f.oi),
      iv: n(f.iv),
      volume: n(f.vtt),
      delta: n(f.optionGreeks?.delta),
      gamma: n(f.optionGreeks?.gamma),
      theta: n(f.optionGreeks?.theta),
      vega: n(f.optionGreeks?.vega),
      ts: n(f.ltpc?.ltt),
    };
  }
  if (feed.fullFeed?.marketFF) {
    const f = feed.fullFeed.marketFF;
    return {
      ltp: n(f.ltpc?.ltp),
      oi: n(f.oi),
      iv: n(f.iv),
      volume: n(f.vtt),
      delta: n(f.optionGreeks?.delta),
      gamma: n(f.optionGreeks?.gamma),
      theta: n(f.optionGreeks?.theta),
      vega: n(f.optionGreeks?.vega),
      ts: n(f.ltpc?.ltt),
    };
  }
  if (feed.fullFeed?.indexFF) {
    const f = feed.fullFeed.indexFF;
    return { ltp: n(f.ltpc?.ltp), oi: 0, iv: 0, volume: 0, delta: 0, gamma: 0, theta: 0, vega: 0, ts: n(f.ltpc?.ltt) };
  }
  if (feed.ltpc) {
    return { ltp: n(feed.ltpc.ltp), oi: 0, iv: 0, volume: 0, delta: 0, gamma: 0, theta: 0, vega: 0, ts: n(feed.ltpc.ltt) };
  }
  return null;
}
