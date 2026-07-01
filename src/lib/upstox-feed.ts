// Browser-side Upstox V3 Market Data Feed client.
// - Connects directly to the signed WSS URL returned by getOptionFeedSession.
// - Subscribes in `option_chain` mode (LTP + greeks + OI + IV per instrument).
// - Decodes binary protobuf frames with the inlined MarketDataFeedV3 schema.
// No server relay → tick latency ≈ Upstox's own push latency.

// Use the light reflection build with a JSON descriptor instead of parsing a
// `.proto` string at runtime. Some browser bundles tree-shake/alias away the
// text parser, which caused `default.parse is not a function` on this route.
import protobuf from "protobufjs/light";

const root = protobuf.Root.fromJSON({
  nested: {
    LTPC: { fields: { ltp: { type: "double", id: 1 }, ltt: { type: "int64", id: 2 }, ltq: { type: "int64", id: 3 }, cp: { type: "double", id: 4 } } },
    Quote: { fields: { bidQ: { type: "int32", id: 1 }, bidP: { type: "double", id: 2 }, askQ: { type: "int32", id: 3 }, askP: { type: "double", id: 4 } } },
    OptionGreeks: { fields: { delta: { type: "double", id: 1 }, theta: { type: "double", id: 2 }, gamma: { type: "double", id: 3 }, vega: { type: "double", id: 4 }, rho: { type: "double", id: 5 } } },
    OHLC: { fields: { interval: { type: "string", id: 1 }, open: { type: "double", id: 2 }, high: { type: "double", id: 3 }, low: { type: "double", id: 4 }, close: { type: "double", id: 5 }, vol: { type: "int64", id: 6 }, ts: { type: "int64", id: 7 } } },
    MarketOHLC: { fields: { ohlc: { rule: "repeated", type: "OHLC", id: 1 } } },
    MarketLevel: { fields: { bidAskQuote: { rule: "repeated", type: "Quote", id: 1 } } },
    MarketFullFeed: { fields: { ltpc: { type: "LTPC", id: 1 }, marketLevel: { type: "MarketLevel", id: 2 }, optionGreeks: { type: "OptionGreeks", id: 3 }, marketOHLC: { type: "MarketOHLC", id: 4 }, atp: { type: "double", id: 5 }, vtt: { type: "int64", id: 6 }, oi: { type: "double", id: 7 }, iv: { type: "double", id: 8 }, tbq: { type: "double", id: 9 }, tsq: { type: "double", id: 10 } } },
    IndexFullFeed: { fields: { ltpc: { type: "LTPC", id: 1 }, marketOHLC: { type: "MarketOHLC", id: 2 } } },
    FullFeed: { fields: { marketFF: { type: "MarketFullFeed", id: 1 }, indexFF: { type: "IndexFullFeed", id: 2 } } },
    FirstLevelWithGreeks: { fields: { ltpc: { type: "LTPC", id: 1 }, firstDepth: { type: "Quote", id: 2 }, optionGreeks: { type: "OptionGreeks", id: 3 }, vtt: { type: "int64", id: 4 }, oi: { type: "double", id: 5 }, iv: { type: "double", id: 6 } } },
    Feed: { fields: { ltpc: { type: "LTPC", id: 1 }, fullFeed: { type: "FullFeed", id: 2 }, firstLevelWithGreeks: { type: "FirstLevelWithGreeks", id: 3 }, requestMode: { type: "RequestMode", id: 4 } }, nested: { RequestMode: { values: { initial_state: 0, ltpc: 1, full_d5: 2, option_chain: 3, full_d30: 4 } } } },
    MarketInfo: { fields: { segmentStatus: { type: "string", id: 1 }, segmentStatusMap: { keyType: "string", type: "string", id: 2 } } },
    FeedResponse: { fields: { type: { type: "Type", id: 1 }, feeds: { keyType: "string", type: "Feed", id: 2 }, currentTs: { type: "string", id: 3 }, marketInfo: { type: "MarketInfo", id: 4 } }, nested: { Type: { values: { initial_feed: 0, live_feed: 1, market_info: 2 } } } },
  },
});
const FeedResponse = root.lookupType("FeedResponse");

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
