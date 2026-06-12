CREATE TYPE "public"."interview_mode" AS ENUM('job_fit', 'standalone');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "applied_jobs" (
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"source" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applied_jobs_user_id_job_id_pk" PRIMARY KEY("user_id","job_id"),
	CONSTRAINT "applied_jobs_source_check" CHECK ("source" IN ('job_fit', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mode" "interview_mode" NOT NULL,
	"job_id" text,
	"role_title" text,
	-- STORED generated column: case/whitespace-insensitive equality lookup
	-- driver for uq_interview_standalone_active. Hand-edited from Drizzle's
	-- plain `text` emit because drizzle-kit 0.31 cannot author this expression.
	"role_title_hash" text GENERATED ALWAYS AS (encode(sha256(lower(btrim(coalesce("role_title", '')))::bytea), 'hex')) STORED,
	"anchor_role_title" text NOT NULL,
	"status" "interview_status" DEFAULT 'in_progress' NOT NULL,
	"questions" jsonb NOT NULL,
	"dual_lens" jsonb NOT NULL,
	"overall_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "applied_jobs" ADD CONSTRAINT "applied_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applied_jobs" ADD CONSTRAINT "applied_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_applied_jobs_user_recent" ON "applied_jobs" USING btree ("user_id","applied_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_interview_jobfit_active" ON "interview_sessions" USING btree ("user_id","job_id") WHERE mode = 'job_fit' AND job_id IS NOT NULL AND status <> 'abandoned';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_interview_standalone_active" ON "interview_sessions" USING btree ("user_id","role_title_hash") WHERE mode = 'standalone' AND role_title_hash IS NOT NULL AND status <> 'abandoned';--> statement-breakpoint
CREATE INDEX "idx_interview_user_recent" ON "interview_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_interview_in_progress_for_cron" ON "interview_sessions" USING btree ("created_at") WHERE status = 'in_progress';