
-- ============== ENUMS ==============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.market_index AS ENUM ('NIFTY50','BANKNIFTY','SENSEX','FINNIFTY','MIDCPNIFTY','NIFTYNXT50');
CREATE TYPE public.trading_style AS ENUM ('intraday','swing','positional','futures','options','longterm');
CREATE TYPE public.risk_profile AS ENUM ('conservative','moderate','aggressive');
CREATE TYPE public.time_horizon AS ENUM ('1h','same_day','next_session','next_day','next_week');
CREATE TYPE public.signal_kind AS ENUM ('BUY','SELL','CALL','PUT','HOLD');
CREATE TYPE public.direction_kind AS ENUM ('bullish','bearish','neutral');

-- ============== updated_at helper ==============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read"   ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
          NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== ROLES ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============== USER SETTINGS ==============
CREATE TABLE public.settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_index public.market_index DEFAULT 'NIFTY50',
  default_style public.trading_style DEFAULT 'intraday',
  default_risk public.risk_profile DEFAULT 'moderate',
  default_horizon public.time_horizon DEFAULT 'same_day',
  default_capital NUMERIC(14,2) DEFAULT 100000,
  notifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== PROVIDER INTEGRATIONS (Upstox etc) ==============
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,            -- 'upstox','newsapi','tradingeconomics' ...
  status TEXT NOT NULL DEFAULT 'disconnected',
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,  -- api keys / tokens
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own integrations" ON public.integrations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== ANALYSES (AI Reasoning Output) ==============
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_index public.market_index NOT NULL,
  style public.trading_style NOT NULL,
  risk public.risk_profile NOT NULL,
  horizon public.time_horizon NOT NULL,
  capital NUMERIC(14,2) NOT NULL,
  direction public.direction_kind,
  signal public.signal_kind,
  confidence NUMERIC(5,2),
  entry NUMERIC(14,2),
  stop_loss NUMERIC(14,2),
  target1 NUMERIC(14,2),
  target2 NUMERIC(14,2),
  target3 NUMERIC(14,2),
  risk_reward NUMERIC(8,2),
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasoning TEXT,
  market_summary TEXT,
  risk_analysis TEXT,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO authenticated;
GRANT ALL ON public.analyses TO service_role;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own analyses" ON public.analyses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_analyses_user_created ON public.analyses(user_id, created_at DESC);

-- ============== SIGNALS (derived view-records for fast list) ==============
CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE,
  market_index public.market_index NOT NULL,
  signal public.signal_kind NOT NULL,
  confidence NUMERIC(5,2),
  entry NUMERIC(14,2),
  stop_loss NUMERIC(14,2),
  target1 NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own signals" ON public.signals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_signals_user_created ON public.signals(user_id, created_at DESC);

-- ============== FORECASTS ==============
CREATE TABLE public.forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_index public.market_index NOT NULL,
  horizon public.time_horizon NOT NULL,
  direction public.direction_kind,
  predicted_price NUMERIC(14,2),
  predicted_range JSONB,
  confidence NUMERIC(5,2),
  reasoning TEXT,
  actual_price NUMERIC(14,2),
  accuracy NUMERIC(5,2),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecasts TO authenticated;
GRANT ALL ON public.forecasts TO service_role;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own forecasts" ON public.forecasts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_forecasts_user_created ON public.forecasts(user_id, created_at DESC);

-- ============== WEIGHTS HISTORY ==============
CREATE TABLE public.weights_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE,
  weights JSONB NOT NULL,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weights_history TO authenticated;
GRANT ALL ON public.weights_history TO service_role;
ALTER TABLE public.weights_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weights" ON public.weights_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============== MARKET DATA CACHE ==============
CREATE TABLE public.market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_index public.market_index NOT NULL,
  timeframe TEXT NOT NULL,
  candles JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_data TO authenticated;
GRANT ALL ON public.market_data TO service_role;
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own market_data" ON public.market_data FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============== OPTION CHAIN CACHE ==============
CREATE TABLE public.option_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_index public.market_index NOT NULL,
  expiry DATE,
  spot NUMERIC(14,2),
  rows JSONB NOT NULL,
  pcr NUMERIC(8,4),
  max_pain NUMERIC(14,2),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.option_chain TO authenticated;
GRANT ALL ON public.option_chain TO service_role;
ALTER TABLE public.option_chain ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own option_chain" ON public.option_chain FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============== NEWS ==============
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT,
  source TEXT,
  summary TEXT,
  published_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own news" ON public.news FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============== SENTIMENT ==============
CREATE TABLE public.sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  news_id UUID REFERENCES public.news(id) ON DELETE CASCADE,
  bullish_score NUMERIC(5,2),
  bearish_score NUMERIC(5,2),
  sentiment_score NUMERIC(5,2),
  impact_score NUMERIC(5,2),
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentiment TO authenticated;
GRANT ALL ON public.sentiment TO service_role;
ALTER TABLE public.sentiment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sentiment" ON public.sentiment FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============== ECONOMIC EVENTS ==============
CREATE TABLE public.economic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  category TEXT,
  event_date TIMESTAMPTZ,
  actual TEXT, forecast TEXT, previous TEXT,
  importance TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.economic_events TO authenticated;
GRANT ALL ON public.economic_events TO service_role;
ALTER TABLE public.economic_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own econ" ON public.economic_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============== AI LOGS ==============
CREATE TABLE public.ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  model TEXT,
  prompt JSONB,
  response JSONB,
  error TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_logs TO authenticated;
GRANT ALL ON public.ai_logs TO service_role;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs" ON public.ai_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============== CHAT HISTORY ==============
CREATE TABLE public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.chat_threads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_threads_updated BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_history TO authenticated;
GRANT ALL ON public.chat_history TO service_role;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat" ON public.chat_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_chat_history_thread ON public.chat_history(thread_id, created_at);

-- ============== ALERTS ==============
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_index public.market_index,
  condition JSONB NOT NULL,
  message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.alerts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
