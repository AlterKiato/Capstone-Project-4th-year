CREATE TABLE "ai_pilot_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	CONSTRAINT "ai_pilot_release_check" CHECK ("ai_pilot_attempts"."released_at" is null or "ai_pilot_attempts"."released_at" >= "ai_pilot_attempts"."attempted_at")
);
--> statement-breakpoint
ALTER TABLE "ai_pilot_attempts" ADD CONSTRAINT "ai_pilot_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_pilot_day_idx" ON "ai_pilot_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "ai_pilot_user_time_idx" ON "ai_pilot_attempts" USING btree ("user_id","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_pilot_one_active_idx" ON "ai_pilot_attempts" USING btree ((1)) WHERE "ai_pilot_attempts"."released_at" is null;