DROP TABLE "oauth_clients";
--> statement-breakpoint
CREATE TABLE "authorized_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sub" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authorized_users_sub_unique" UNIQUE("sub")
);
