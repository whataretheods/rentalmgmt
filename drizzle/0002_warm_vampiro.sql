CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_user_id" text NOT NULL,
	"unit_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"payment_method" text NOT NULL,
	"status" text NOT NULL,
	"billing_period" text NOT NULL,
	"note" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;