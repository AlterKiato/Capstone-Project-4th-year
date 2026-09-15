ALTER TABLE "submissions" DROP CONSTRAINT "submissions_paper_id_research_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_paper_id_research_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."research_papers"("id") ON DELETE no action ON UPDATE no action;