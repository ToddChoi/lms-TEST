-- Phase 6: Payments
-- Run this in Supabase SQL Editor after Phase 5 schema is applied.

-- payments table
CREATE TABLE payments (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  course_id                 UUID REFERENCES courses(id) ON DELETE SET NULL,
  amount                    INT NOT NULL,            -- 원 단위
  currency                  TEXT DEFAULT 'KRW',
  provider                  TEXT DEFAULT 'stripe',
  stripe_session_id         TEXT UNIQUE,
  stripe_payment_intent_id  TEXT,
  status                    TEXT DEFAULT 'pending',  -- pending|succeeded|failed|refunded
  receipt_url               TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments: self read" ON payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "payments: admin read" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX payments_user_id_idx ON payments(user_id);
CREATE INDEX payments_status_idx ON payments(status);
