CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"vertical" text NOT NULL,
	"sub_vertical" text,
	"seniority" text NOT NULL,
	"tier" text,
	"description" text NOT NULL,
	"source_url" text NOT NULL,
	"source" text NOT NULL,
	"location" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"must_haves" jsonb,
	"company_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"embedding" vector(768) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount_vnd" integer NOT NULL,
	"status" text NOT NULL,
	"payment_id" text NOT NULL,
	"match_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "sepay_webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"sepay_order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_sepay_order_id_unique" UNIQUE("sepay_order_id")
);
--> statement-breakpoint
CREATE TABLE "user_seen_job" (
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_seen_job_user_id_job_id_pk" PRIMARY KEY("user_id","job_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"plan_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_seen_job" ADD CONSTRAINT "user_seen_job_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_seen_job" ADD CONSTRAINT "user_seen_job_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_url_unique" ON "jobs" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "jobs_active_vertical_idx" ON "jobs" USING btree ("active","vertical") WHERE active = true;--> statement-breakpoint
CREATE INDEX "orders_pending_amount_idx" ON "orders" USING btree ("status","amount_vnd","created_at") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "subscriptions_user_active_idx" ON "subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_seen_job_seen_at_idx" ON "user_seen_job" USING btree ("user_id","seen_at");--> statement-breakpoint
-- pgvector HNSW index on the embedding column. Appended manually because
-- drizzle-kit 0.31 does not emit pgvector index syntax in its generated SQL.
-- m=16 / ef_construction=64 = pgvector defaults (good build quality for ~1-2K
-- rows). vector_cosine_ops because embeddings are L2-normalized → cosine
-- distance matches the dot-product ranking semantic used elsewhere.
CREATE INDEX "jobs_embedding_hnsw" ON "jobs" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);