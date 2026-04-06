CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"company" varchar NOT NULL,
	"title" varchar NOT NULL,
	"score" real NOT NULL,
	"reason" text NOT NULL,
	"assets" text NOT NULL,
	"sales" text NOT NULL,
	"reasoning" text NOT NULL,
	"email" varchar,
	"phone" varchar,
	"linked_in" varchar,
	"location" varchar,
	"industry" varchar,
	"aum" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"lead_name" varchar NOT NULL,
	"lead_company" varchar NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"purpose" text NOT NULL,
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"email_subject" text,
	"email_body" text,
	"prep_notes" text,
	"meeting_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"meeting_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"description" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");