CREATE TABLE "auth_rate_limit_buckets" (
	"key_digest" varchar(64) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"hit_count" integer NOT NULL,
	CONSTRAINT "auth_rate_limit_buckets_key_digest_window_start_pk" PRIMARY KEY("key_digest","window_start"),
	CONSTRAINT "auth_rate_limit_digest_check" CHECK ("auth_rate_limit_buckets"."key_digest" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "auth_rate_limit_count_check" CHECK ("auth_rate_limit_buckets"."hit_count" > 0),
	CONSTRAINT "auth_rate_limit_expiry_check" CHECK ("auth_rate_limit_buckets"."expires_at" > "auth_rate_limit_buckets"."window_start")
);
--> statement-breakpoint
CREATE INDEX "auth_rate_limit_expiry_idx" ON "auth_rate_limit_buckets" USING btree ("expires_at");