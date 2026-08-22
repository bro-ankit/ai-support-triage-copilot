CREATE TABLE "oauth_clients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"auth0_client_id" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_auth0_client_id_unique" UNIQUE("auth0_client_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_action_approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_investigation_id" uuid NOT NULL,
	"action" text NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "kb_articles" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "kb_articles" SET "tenant_id" = '11111111-1111-1111-1111-111111111111' WHERE "tenant_id" IS NULL;--> statement-breakpoint
UPDATE "kb_chunks" SET "tenant_id" = '11111111-1111-1111-1111-111111111111' WHERE "tenant_id" IS NULL;--> statement-breakpoint
UPDATE "tickets" SET "tenant_id" = '11111111-1111-1111-1111-111111111111' WHERE "tenant_id" IS NULL;--> statement-breakpoint
ALTER TABLE "kb_articles" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "kb_chunks" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_action_approvals" ADD CONSTRAINT "ticket_action_approvals_ticket_investigation_id_ticket_investigations_id_fk" FOREIGN KEY ("ticket_investigation_id") REFERENCES "public"."ticket_investigations"("id") ON DELETE cascade ON UPDATE no action;