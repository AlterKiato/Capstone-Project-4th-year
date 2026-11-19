CREATE TABLE "submission_evaluation_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"revision" integer NOT NULL,
	"assigned_by" integer NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_evaluation_assignment_revision_unique" UNIQUE("submission_id","revision"),
	CONSTRAINT "submission_evaluation_assignment_revision_check" CHECK ("submission_evaluation_assignments"."revision" > 0),
	CONSTRAINT "submission_evaluation_snapshot_check" CHECK ("submission_evaluation_assignments"."snapshot" is null or coalesce(jsonb_typeof("submission_evaluation_assignments"."snapshot") = 'object'
        and jsonb_typeof("submission_evaluation_assignments"."snapshot"->'criteria') = 'array' and jsonb_array_length("submission_evaluation_assignments"."snapshot"->'criteria') between 1 and 30
        and jsonb_typeof("submission_evaluation_assignments"."snapshot"->'scale') = 'object' and char_length("submission_evaluation_assignments"."snapshot"->>'name') between 1 and 200, false))
);
--> statement-breakpoint
CREATE TABLE "submission_evaluation_items" (
	"evaluation_id" integer NOT NULL,
	"criterion_key" uuid NOT NULL,
	"rating" integer,
	"na" boolean NOT NULL,
	"reason" text NOT NULL,
	"comment" text NOT NULL,
	CONSTRAINT "submission_evaluation_items_evaluation_id_criterion_key_pk" PRIMARY KEY("evaluation_id","criterion_key"),
	CONSTRAINT "submission_evaluation_item_check" CHECK (char_length("submission_evaluation_items"."comment") <= 2000 and char_length("submission_evaluation_items"."reason") <= 2000
        and (("submission_evaluation_items"."na" = true and "submission_evaluation_items"."rating" is null and "submission_evaluation_items"."reason" ~ '[^[:space:]]')
        or ("submission_evaluation_items"."na" = false and "submission_evaluation_items"."rating" between 1 and 5 and "submission_evaluation_items"."rating" is not null and "submission_evaluation_items"."reason" = '')))
);
--> statement-breakpoint
CREATE TABLE "submission_evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"feedback_id" integer NOT NULL,
	"earned" integer NOT NULL,
	"possible" integer NOT NULL,
	"finalized_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_evaluations_assignment_id_unique" UNIQUE("assignment_id"),
	CONSTRAINT "submission_evaluations_feedback_id_unique" UNIQUE("feedback_id"),
	CONSTRAINT "submission_evaluation_points_check" CHECK ("submission_evaluations"."earned" >= 0 and "submission_evaluations"."possible" >= "submission_evaluations"."earned" and "submission_evaluations"."possible" <= 150)
);
--> statement-breakpoint
ALTER TABLE "submission_evaluation_assignments" ADD CONSTRAINT "submission_evaluation_assignments_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_evaluation_assignments" ADD CONSTRAINT "submission_evaluation_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_evaluation_items" ADD CONSTRAINT "submission_evaluation_items_evaluation_id_submission_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."submission_evaluations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_evaluations" ADD CONSTRAINT "submission_evaluations_assignment_id_submission_evaluation_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."submission_evaluation_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_evaluations" ADD CONSTRAINT "submission_evaluations_feedback_id_feedbacks_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedbacks"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- These three tables are historical records. Replacement/clear inserts a new generation.
CREATE FUNCTION public.prevent_submission_evaluation_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    RAISE EXCEPTION 'Submission evaluation history is immutable' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER submission_evaluation_assignments_immutable BEFORE UPDATE OR DELETE ON public.submission_evaluation_assignments FOR EACH ROW EXECUTE FUNCTION public.prevent_submission_evaluation_mutation();
--> statement-breakpoint
CREATE TRIGGER submission_evaluation_assignments_no_truncate BEFORE TRUNCATE ON public.submission_evaluation_assignments FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_submission_evaluation_mutation();
--> statement-breakpoint
CREATE TRIGGER submission_evaluations_immutable BEFORE UPDATE OR DELETE ON public.submission_evaluations FOR EACH ROW EXECUTE FUNCTION public.prevent_submission_evaluation_mutation();
--> statement-breakpoint
CREATE TRIGGER submission_evaluations_no_truncate BEFORE TRUNCATE ON public.submission_evaluations FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_submission_evaluation_mutation();
--> statement-breakpoint
CREATE TRIGGER submission_evaluation_items_immutable BEFORE UPDATE OR DELETE ON public.submission_evaluation_items FOR EACH ROW EXECUTE FUNCTION public.prevent_submission_evaluation_mutation();
--> statement-breakpoint
CREATE TRIGGER submission_evaluation_items_no_truncate BEFORE TRUNCATE ON public.submission_evaluation_items FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_submission_evaluation_mutation();
