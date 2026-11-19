CREATE TABLE "evaluation_template_criteria" (
	"template_id" integer NOT NULL,
	"criterion_key" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"allows_na" boolean DEFAULT false NOT NULL,
	CONSTRAINT "evaluation_template_criteria_template_id_criterion_key_pk" PRIMARY KEY("template_id","criterion_key"),
	CONSTRAINT "evaluation_template_criteria_position_unique" UNIQUE("template_id","position"),
	CONSTRAINT "evaluation_template_criteria_position_check" CHECK ("evaluation_template_criteria"."position" between 0 and 29),
	CONSTRAINT "evaluation_template_criteria_name_check" CHECK (char_length("evaluation_template_criteria"."name") between 1 and 200 and "evaluation_template_criteria"."name" ~ '[^[:space:]]'),
	CONSTRAINT "evaluation_template_criteria_description_check" CHECK (char_length("evaluation_template_criteria"."description") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "evaluation_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"scale" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluation_templates_name_check" CHECK (char_length("evaluation_templates"."name") between 1 and 200 and "evaluation_templates"."name" ~ '[^[:space:]]'),
	CONSTRAINT "evaluation_templates_revision_check" CHECK ("evaluation_templates"."revision" >= 0),
	CONSTRAINT "evaluation_templates_scale_check" CHECK (coalesce(
        jsonb_typeof("evaluation_templates"."scale") = 'object' and "evaluation_templates"."scale"->'version' = '1'::jsonb
        and jsonb_typeof("evaluation_templates"."scale"->'levels') = 'array'
        and jsonb_array_length("evaluation_templates"."scale"->'levels') between 2 and 5
        and "evaluation_templates"."scale" #> '{levels,0,points}' = '1'::jsonb
        and "evaluation_templates"."scale" #> '{levels,1,points}' = '2'::jsonb
        and (jsonb_array_length("evaluation_templates"."scale"->'levels') < 3 or "evaluation_templates"."scale" #> '{levels,2,points}' = '3'::jsonb)
        and (jsonb_array_length("evaluation_templates"."scale"->'levels') < 4 or "evaluation_templates"."scale" #> '{levels,3,points}' = '4'::jsonb)
        and (jsonb_array_length("evaluation_templates"."scale"->'levels') < 5 or "evaluation_templates"."scale" #> '{levels,4,points}' = '5'::jsonb)
        and not jsonb_path_exists("evaluation_templates"."scale", '$.levels[*] ? (@.label.type() != "string" || @.label == "" || @.description.type() != "string")')
        and jsonb_array_length(jsonb_path_query_array("evaluation_templates"."scale", '$.levels[*].label')) = jsonb_array_length("evaluation_templates"."scale"->'levels')
        and jsonb_array_length(jsonb_path_query_array("evaluation_templates"."scale", '$.levels[*].description')) = jsonb_array_length("evaluation_templates"."scale"->'levels')
    , false))
);
--> statement-breakpoint
ALTER TABLE "evaluation_template_criteria" ADD CONSTRAINT "evaluation_template_criteria_template_id_evaluation_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."evaluation_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_templates" ADD CONSTRAINT "evaluation_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evaluation_templates_owner_archive_id_idx" ON "evaluation_templates" USING btree ("owner_id","archived_at","id");