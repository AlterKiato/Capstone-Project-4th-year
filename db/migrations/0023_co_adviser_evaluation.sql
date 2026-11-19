ALTER TABLE "co_adviser_review_assignments" ADD COLUMN "evaluation_assignment_id" integer;--> statement-breakpoint
ALTER TABLE "co_adviser_review_assignments" ADD COLUMN "evaluation" jsonb;--> statement-breakpoint
ALTER TABLE "submission_evaluation_assignments" ADD CONSTRAINT "submission_evaluation_assignment_id_submission_unique" UNIQUE("id","submission_id");--> statement-breakpoint
ALTER TABLE "co_adviser_review_assignments" ADD CONSTRAINT "co_recommendation_exact_evaluation_fk" FOREIGN KEY ("evaluation_assignment_id","submission_id") REFERENCES "public"."submission_evaluation_assignments"("id","submission_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_adviser_review_assignments" ADD CONSTRAINT "co_recommendation_evaluation_check" CHECK (("co_adviser_review_assignments"."evaluation_assignment_id" is null and "co_adviser_review_assignments"."evaluation" is null) or
        ("co_adviser_review_assignments"."evaluation_assignment_id" is not null and "co_adviser_review_assignments"."evaluation" is not null and "co_adviser_review_assignments"."state" in ('completed','closed')
        and coalesce(jsonb_typeof("co_adviser_review_assignments"."evaluation") = 'object' and "co_adviser_review_assignments"."evaluation"->'version' = '1'::jsonb
        and jsonb_typeof("co_adviser_review_assignments"."evaluation"->'items') = 'array' and jsonb_array_length("co_adviser_review_assignments"."evaluation"->'items') between 1 and 30
        and ("co_adviser_review_assignments"."evaluation"->>'earned')::integer between 1 and 150
        and ("co_adviser_review_assignments"."evaluation"->>'possible')::integer between ("co_adviser_review_assignments"."evaluation"->>'earned')::integer and 150
        and octet_length("co_adviser_review_assignments"."evaluation"::text) <= 1048576, false)));