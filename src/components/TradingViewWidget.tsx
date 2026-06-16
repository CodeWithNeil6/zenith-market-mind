import { useEffect, useRef } from "react";

interface Props {
  symbol?: string;
  interval?: string;
  height?: number | string;
}

export function TradingViewWidget({ symbol = "NSE:NIFTY", interval = "15", height = 520 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const container = document.createElement("div");
    container.className = "tradingview-widget-container__widget";
    container.style.height = "100%";
    container.style.width = "100%";
    ref.current.appendChild(container);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Kolkata",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(20, 25, 40, 1)",
      gridColor: "rgba(120, 130, 160, 0.15)",
      hide_side_toolbar: false,
      allow_symbol_change: true,
      withdateranges: true,
      studies: ["STD;EMA", "STD;RSI", "STD;MACD"],
      support_host: "https://www.tradingview.com",
    });
    ref.current.appendChild(script);
  }, [symbol, interval]);

  return (
    <div
      ref={ref}
      className="tradingview-widget-container glass rounded-xl overflow-hidden"
      style={{ height, width: "100%" }}
    />
  );
}
