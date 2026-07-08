CREATE TABLE "role" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	CONSTRAINT "role_name_unique" UNIQUE("name")
);
