-- Enable Row Level Security (RLS) on transactional, secret, and operational tables
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_item_modifiers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guest_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "manual_refund_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;

-- Revoke all permissions on transactional tables from anon and authenticated roles if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "orders", "order_items", "order_item_modifiers", "payment_attempts", 
                   "idempotency_records", "staff_users", "guest_sessions", "audit_logs", 
                   "manual_refund_records", "print_logs", "outbox_events" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "orders", "order_items", "order_item_modifiers", "payment_attempts", 
                   "idempotency_records", "staff_users", "guest_sessions", "audit_logs", 
                   "manual_refund_records", "print_logs", "outbox_events" FROM authenticated;
  END IF;
END $$;

