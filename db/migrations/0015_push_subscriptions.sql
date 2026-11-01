CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"endpoint" varchar(2048),
	"p256dh" varchar(87),
	"auth" varchar(22),
	"vapid_key_id" varchar(64),
	"authorized_until" timestamp with time zone,
	"browser_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint"),
	CONSTRAINT "push_subscription_material_check" CHECK ((
        "push_subscriptions"."enabled" and "push_subscriptions"."endpoint" is not null and "push_subscriptions"."p256dh" is not null and "push_subscriptions"."auth" is not null
        and "push_subscriptions"."vapid_key_id" is not null and "push_subscriptions"."authorized_until" is not null
    ) or (not "push_subscriptions"."enabled" and "push_subscriptions"."endpoint" is null and "push_subscriptions"."p256dh" is null and "push_subscriptions"."auth" is null
        and "push_subscriptions"."vapid_key_id" is null and "push_subscriptions"."authorized_until" is null and "push_subscriptions"."browser_expires_at" is null)),
	CONSTRAINT "push_subscription_endpoint_check" CHECK ("push_subscriptions"."endpoint" is null or (octet_length("push_subscriptions"."endpoint") <= 2048 and "push_subscriptions"."endpoint" ~ '^https://[^[:space:]]+$')),
	CONSTRAINT "push_subscription_keys_check" CHECK (("push_subscriptions"."p256dh" is null or "push_subscriptions"."p256dh" ~ '^[A-Za-z0-9_-]{87}$') and ("push_subscriptions"."auth" is null or "push_subscriptions"."auth" ~ '^[A-Za-z0-9_-]{22}$') and ("push_subscriptions"."vapid_key_id" is null or "push_subscriptions"."vapid_key_id" ~ '^[A-Za-z0-9_-]{1,64}$')),
	CONSTRAINT "push_subscription_expiry_check" CHECK (not "push_subscriptions"."enabled" or ("push_subscriptions"."authorized_until" > "push_subscriptions"."updated_at" and ("push_subscriptions"."browser_expires_at" is null or "push_subscriptions"."browser_expires_at" >= "push_subscriptions"."authorized_until")))
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;