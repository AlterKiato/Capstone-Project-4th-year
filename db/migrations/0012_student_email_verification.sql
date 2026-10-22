CREATE TABLE "email_verification_requests" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"requested_email" varchar(255) NOT NULL,
	"token_digest" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"last_requested_at" timestamp with time zone NOT NULL,
	"request_times" timestamp with time zone[] NOT NULL,
	CONSTRAINT "email_verification_requests_token_digest_unique" UNIQUE("token_digest"),
	CONSTRAINT "email_verification_digest_check" CHECK ("email_verification_requests"."token_digest" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "email_verification_times_check" CHECK (cardinality("email_verification_requests"."request_times") between 1 and 5 and array_position("email_verification_requests"."request_times", null) is null),
	CONSTRAINT "email_verification_expiry_check" CHECK ("email_verification_requests"."expires_at" > "email_verification_requests"."last_requested_at"),
	CONSTRAINT "email_verification_consumption_check" CHECK ("email_verification_requests"."consumed_at" is null or ("email_verification_requests"."consumed_at" >= "email_verification_requests"."last_requested_at" and "email_verification_requests"."consumed_at" < "email_verification_requests"."expires_at"))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_verification_requests" ADD CONSTRAINT "email_verification_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;