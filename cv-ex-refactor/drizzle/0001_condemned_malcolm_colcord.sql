CREATE TABLE "user_cvs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_cvs" ADD CONSTRAINT "user_cvs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_cvs_user_id_idx" ON "user_cvs" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_cvs_one_default_per_user" ON "user_cvs" USING btree ("user_id") WHERE is_default = true;