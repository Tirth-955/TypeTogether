CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"doc_type" text NOT NULL,
	"language" text,
	"content" text DEFAULT '' NOT NULL,
	"creator_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_creator_id_idx" ON "documents" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "documents_expires_at_idx" ON "documents" USING btree ("expires_at");