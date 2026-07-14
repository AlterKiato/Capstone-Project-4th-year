CREATE TABLE "research_papers" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"abstract" text NOT NULL,
	"category" varchar(100),
	"keywords" text,
	"status" varchar(20) DEFAULT 'Draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_papers" ADD CONSTRAINT "research_papers_group_id_research_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."research_groups"("id") ON DELETE no action ON UPDATE no action;