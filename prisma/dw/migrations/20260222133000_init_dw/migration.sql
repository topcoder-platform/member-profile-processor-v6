-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "dw";

-- CreateTable
CREATE TABLE "dw"."algo_rating_type" (
    "id" INTEGER NOT NULL,
    "algo_rating_type_desc" VARCHAR(64) NOT NULL,

    CONSTRAINT "algo_rating_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."coder_rank_type" (
    "id" INTEGER NOT NULL,
    "coder_rank_type_desc" VARCHAR(64) NOT NULL,

    CONSTRAINT "coder_rank_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."round_type_lu" (
    "id" INTEGER NOT NULL,
    "round_type_desc" VARCHAR(64) NOT NULL,
    "algo_rating_type_id" INTEGER,

    CONSTRAINT "round_type_lu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."calendar" (
    "calendar_id" SERIAL NOT NULL,
    "year" INTEGER,
    "month_numeric" INTEGER,
    "month_alpha_long" VARCHAR(20),
    "month_alpha_short" VARCHAR(10),
    "day_of_month" INTEGER,
    "day_of_week_numeric" INTEGER,
    "day_of_week_alpha_long" VARCHAR(20),
    "day_of_week_alpha_short" VARCHAR(10),
    "day_of_year" INTEGER,
    "week_of_year" INTEGER,
    "quarter" INTEGER,
    "date" TIMESTAMP(3),

    CONSTRAINT "calendar_pkey" PRIMARY KEY ("calendar_id")
);

-- CreateTable
CREATE TABLE "dw"."time" (
    "time_id" SERIAL NOT NULL,
    "minute" INTEGER,
    "hour_24" INTEGER,

    CONSTRAINT "time_pkey" PRIMARY KEY ("time_id")
);

-- CreateTable
CREATE TABLE "dw"."update_log" (
    "log_id" SERIAL NOT NULL,
    "calendar_id" INTEGER,
    "timestamp" TIMESTAMP(3),
    "log_type_id" INTEGER NOT NULL,

    CONSTRAINT "update_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "dw"."contest" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(128),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" VARCHAR(1),
    "group_id" INTEGER,

    CONSTRAINT "contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."round" (
    "id" INTEGER NOT NULL,
    "contest_id" INTEGER,
    "name" VARCHAR(128),
    "status" VARCHAR(1),
    "calendar_id" INTEGER,
    "time_id" INTEGER,
    "failed" INTEGER DEFAULT 0,
    "round_type_id" INTEGER,
    "invitational" INTEGER DEFAULT 0,
    "notes" TEXT,
    "round_type_desc" VARCHAR(64),
    "short_name" VARCHAR(64),
    "forum_id" INTEGER,
    "rated_ind" INTEGER DEFAULT 1,
    "rating_order" INTEGER,

    CONSTRAINT "round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."problem" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(128),
    "status_id" INTEGER,
    "problem_text" TEXT,
    "problem_type_id" INTEGER,
    "proposed_difficulty_id" INTEGER,
    "proposed_division_id" INTEGER,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."component" (
    "id" INTEGER NOT NULL,
    "problem_id" INTEGER,
    "result_type_id" INTEGER,
    "method_name" VARCHAR(128),
    "class_name" VARCHAR(128),
    "default_solution" TEXT,
    "component_type_id" INTEGER,
    "component_text" TEXT,
    "status_id" INTEGER,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."round_component" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,
    "submit_order" INTEGER,
    "division_id" INTEGER,
    "difficulty_id" INTEGER,
    "points" DECIMAL(10,2),
    "open_order" INTEGER,

    CONSTRAINT "round_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."problem_category_xref" (
    "id" SERIAL NOT NULL,
    "problem_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "problem_category_xref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."long_problem_submission" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,
    "submission_number" INTEGER NOT NULL,
    "final_points" DECIMAL(14,2),
    "status_id" INTEGER,
    "submission_text" TEXT,
    "open_time" TIMESTAMP(3),
    "submit_time" TIMESTAMP(3),
    "submission_points" DECIMAL(14,2),
    "status_desc" VARCHAR(64),
    "last_submission" INTEGER DEFAULT 0,
    "language_id" INTEGER,
    "example" INTEGER DEFAULT 0,

    CONSTRAINT "long_problem_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."system_test_case" (
    "id" SERIAL NOT NULL,
    "component_id" INTEGER NOT NULL,
    "test_case_id" INTEGER NOT NULL,
    "args" TEXT,
    "expected_result" TEXT,
    "status" INTEGER,
    "modify_date" TIMESTAMP(3),
    "example_flag" INTEGER DEFAULT 0,
    "system_flag" INTEGER DEFAULT 0,

    CONSTRAINT "system_test_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."long_system_test_result" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,
    "test_case_id" INTEGER NOT NULL,
    "submission_number" INTEGER NOT NULL,
    "example" INTEGER DEFAULT 0,
    "test_action" VARCHAR(32),
    "fatal_errors" BYTEA,
    "received_value" TEXT,
    "score" DECIMAL(14,2),
    "processing_time" INTEGER,
    "fatal" INTEGER DEFAULT 0,
    "timestamp" TIMESTAMP(3),
    "viewable" INTEGER DEFAULT 0,
    "message" TEXT,

    CONSTRAINT "long_system_test_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."long_comp_result" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "placed" INTEGER,
    "point_total" DECIMAL(14,2),
    "system_point_total" DECIMAL(14,2),
    "num_submissions" INTEGER DEFAULT 0,
    "attended" VARCHAR(1),
    "old_rating" INTEGER,
    "new_rating" INTEGER,
    "old_vol" INTEGER,
    "new_vol" INTEGER,
    "rated" INTEGER DEFAULT 0,
    "advanced" VARCHAR(1),
    "old_rating_id" INTEGER,
    "new_rating_id" INTEGER,
    "provisional_placed" INTEGER,
    "num_ratings" INTEGER DEFAULT 0,

    CONSTRAINT "long_comp_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."algo_rating" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "vol" INTEGER NOT NULL DEFAULT 0,
    "num_ratings" INTEGER NOT NULL DEFAULT 0,
    "algo_rating_type_id" INTEGER NOT NULL,
    "highest_rating" INTEGER,
    "lowest_rating" INTEGER,
    "first_rated_round_id" INTEGER,
    "last_rated_round_id" INTEGER,
    "num_competitions" INTEGER DEFAULT 0,
    "round_id" INTEGER,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "algo_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."algo_rating_history" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "round_id" INTEGER NOT NULL,
    "algo_rating_type_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "vol" INTEGER NOT NULL DEFAULT 0,
    "num_ratings" INTEGER NOT NULL DEFAULT 0,
    "num_competitions" INTEGER DEFAULT 0,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "algo_rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."coder_rank" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "coder_rank_type_id" INTEGER NOT NULL,
    "algo_rating_type_id" INTEGER NOT NULL,
    "percentile" DECIMAL(7,4),
    "rank" INTEGER,
    "rank_no_tie" INTEGER,

    CONSTRAINT "coder_rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."coder_rank_history" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "round_id" INTEGER NOT NULL,
    "coder_rank_type_id" INTEGER NOT NULL,
    "algo_rating_type_id" INTEGER NOT NULL,
    "percentile" DECIMAL(7,4),
    "rank" INTEGER,
    "rank_no_tie" INTEGER,

    CONSTRAINT "coder_rank_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."country_coder_rank" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "country_code" VARCHAR(10) NOT NULL,
    "coder_rank_type_id" INTEGER NOT NULL,
    "algo_rating_type_id" INTEGER NOT NULL,
    "percentile" DECIMAL(7,4),
    "rank" INTEGER,
    "rank_no_tie" INTEGER,

    CONSTRAINT "country_coder_rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."state_coder_rank" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "state_code" VARCHAR(10) NOT NULL,
    "coder_rank_type_id" INTEGER NOT NULL,
    "algo_rating_type_id" INTEGER NOT NULL,
    "percentile" DECIMAL(7,4),
    "rank" INTEGER,
    "rank_no_tie" INTEGER,

    CONSTRAINT "state_coder_rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."school_coder_rank" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "coder_rank_type_id" INTEGER NOT NULL,
    "algo_rating_type_id" INTEGER NOT NULL,
    "percentile" DECIMAL(7,4),
    "rank" INTEGER,
    "rank_no_tie" INTEGER,

    CONSTRAINT "school_coder_rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."streak" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "streak_type_id" INTEGER NOT NULL,
    "start_round_id" INTEGER,
    "end_round_id" INTEGER,
    "length" INTEGER,
    "is_active" INTEGER DEFAULT 0,

    CONSTRAINT "streak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."user" (
    "id" INTEGER NOT NULL,
    "handle" VARCHAR(50),
    "first_name" VARCHAR(64),
    "last_name" VARCHAR(64),
    "middle_name" VARCHAR(64),
    "email" VARCHAR(100),
    "status" VARCHAR(1),
    "activation_code" VARCHAR(32),
    "member_since" TIMESTAMP(3),
    "last_site_hit_date" TIMESTAMP(3),
    "reg_source" VARCHAR(50),
    "utm_source" VARCHAR(50),
    "utm_medium" VARCHAR(50),
    "utm_campaign" VARCHAR(50),
    "create_date" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."coder" (
    "id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "state_code" VARCHAR(10),
    "country_code" VARCHAR(10),
    "comp_country_code" VARCHAR(10),
    "address1" VARCHAR(254),
    "address2" VARCHAR(254),
    "city" VARCHAR(64),
    "zip" VARCHAR(16),
    "quote" TEXT,
    "language_id" INTEGER,
    "coder_type_id" INTEGER,

    CONSTRAINT "coder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."state" (
    "state_code" VARCHAR(10) NOT NULL,
    "state_name" VARCHAR(64) NOT NULL,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "state_pkey" PRIMARY KEY ("state_code")
);

-- CreateTable
CREATE TABLE "dw"."country" (
    "country_code" VARCHAR(10) NOT NULL,
    "country_name" VARCHAR(64) NOT NULL,
    "participating" INTEGER DEFAULT 0,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "country_pkey" PRIMARY KEY ("country_code")
);

-- CreateTable
CREATE TABLE "dw"."skill_type_lu" (
    "skill_type_id" INTEGER NOT NULL,
    "skill_type_desc" VARCHAR(64) NOT NULL,
    "skill_type_order" INTEGER,
    "status" VARCHAR(1),
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "skill_type_lu_pkey" PRIMARY KEY ("skill_type_id")
);

-- CreateTable
CREATE TABLE "dw"."skill" (
    "skill_id" INTEGER NOT NULL,
    "skill_type_id" INTEGER NOT NULL,
    "skill_desc" VARCHAR(64) NOT NULL,
    "status" VARCHAR(1),
    "skill_order" INTEGER,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "skill_pkey" PRIMARY KEY ("skill_id")
);

-- CreateTable
CREATE TABLE "dw"."coder_skill_xref" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "skill_type_id" INTEGER,
    "ranking" INTEGER,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "coder_skill_xref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."path" (
    "path_id" INTEGER NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "path_pkey" PRIMARY KEY ("path_id")
);

-- CreateTable
CREATE TABLE "dw"."image" (
    "image_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "image_type_id" INTEGER NOT NULL,
    "path_id" INTEGER,
    "link" VARCHAR(255),
    "height" INTEGER,
    "width" INTEGER,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "image_pkey" PRIMARY KEY ("image_id")
);

-- CreateTable
CREATE TABLE "dw"."coder_image_xref" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "image_id" INTEGER NOT NULL,
    "display_flag" INTEGER DEFAULT 1,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "coder_image_xref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."school" (
    "school_id" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "short_name" VARCHAR(64),
    "sort_letter" VARCHAR(1),
    "city" VARCHAR(64),
    "state_code" VARCHAR(10),
    "country_code" VARCHAR(10),
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "school_pkey" PRIMARY KEY ("school_id")
);

-- CreateTable
CREATE TABLE "dw"."current_school" (
    "id" SERIAL NOT NULL,
    "coder_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "gpa" DECIMAL(5,2),
    "gpa_scale" DECIMAL(5,2),
    "viewable" INTEGER DEFAULT 1,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "current_school_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."achievement_type_lu" (
    "achievement_type_id" INTEGER NOT NULL,
    "achievement_type_desc" VARCHAR(64) NOT NULL,

    CONSTRAINT "achievement_type_lu_pkey" PRIMARY KEY ("achievement_type_id")
);

-- CreateTable
CREATE TABLE "dw"."user_achievement" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "achievement_type_id" INTEGER NOT NULL,
    "achievement_date" TIMESTAMP(3),
    "description" VARCHAR(255),
    "achievement_type_desc" VARCHAR(64),

    CONSTRAINT "user_achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."team" (
    "team_id" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "team_type" INTEGER,
    "school_id" INTEGER,
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "team_pkey" PRIMARY KEY ("team_id")
);

-- CreateTable
CREATE TABLE "dw"."team_coder_xref" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "coder_id" INTEGER NOT NULL,

    CONSTRAINT "team_coder_xref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dw"."event_type_lu" (
    "event_type_id" INTEGER NOT NULL,
    "event_type_desc" VARCHAR(64) NOT NULL,

    CONSTRAINT "event_type_lu_pkey" PRIMARY KEY ("event_type_id")
);

-- CreateTable
CREATE TABLE "dw"."event" (
    "event_id" INTEGER NOT NULL,
    "event_type_id" INTEGER NOT NULL,
    "event_type_desc" VARCHAR(64),
    "event_desc" VARCHAR(255),
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "dw"."event_registration" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "eligible_ind" INTEGER,
    "notes" TEXT,
    "create_date" TIMESTAMP(3),
    "modify_date" TIMESTAMP(3),

    CONSTRAINT "event_registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "round_type_lu_algo_rating_type_id_idx" ON "dw"."round_type_lu"("algo_rating_type_id");

-- CreateIndex
CREATE INDEX "calendar_date_idx" ON "dw"."calendar"("date");

-- CreateIndex
CREATE INDEX "calendar_year_month_numeric_day_of_month_idx" ON "dw"."calendar"("year", "month_numeric", "day_of_month");

-- CreateIndex
CREATE INDEX "time_hour_24_minute_idx" ON "dw"."time"("hour_24", "minute");

-- CreateIndex
CREATE INDEX "update_log_log_type_id_idx" ON "dw"."update_log"("log_type_id");

-- CreateIndex
CREATE INDEX "update_log_timestamp_idx" ON "dw"."update_log"("timestamp");

-- CreateIndex
CREATE INDEX "contest_start_date_idx" ON "dw"."contest"("start_date");

-- CreateIndex
CREATE INDEX "round_contest_id_idx" ON "dw"."round"("contest_id");

-- CreateIndex
CREATE INDEX "round_round_type_id_idx" ON "dw"."round"("round_type_id");

-- CreateIndex
CREATE INDEX "round_calendar_id_idx" ON "dw"."round"("calendar_id");

-- CreateIndex
CREATE INDEX "round_time_id_idx" ON "dw"."round"("time_id");

-- CreateIndex
CREATE INDEX "round_rating_order_idx" ON "dw"."round"("rating_order");

-- CreateIndex
CREATE INDEX "problem_status_id_idx" ON "dw"."problem"("status_id");

-- CreateIndex
CREATE INDEX "component_problem_id_idx" ON "dw"."component"("problem_id");

-- CreateIndex
CREATE INDEX "round_component_round_id_idx" ON "dw"."round_component"("round_id");

-- CreateIndex
CREATE INDEX "round_component_component_id_idx" ON "dw"."round_component"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "round_component_round_id_component_id_division_id_key" ON "dw"."round_component"("round_id", "component_id", "division_id");

-- CreateIndex
CREATE INDEX "problem_category_xref_problem_id_idx" ON "dw"."problem_category_xref"("problem_id");

-- CreateIndex
CREATE INDEX "problem_category_xref_category_id_idx" ON "dw"."problem_category_xref"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "problem_category_xref_problem_id_category_id_key" ON "dw"."problem_category_xref"("problem_id", "category_id");

-- CreateIndex
CREATE INDEX "long_problem_submission_round_id_idx" ON "dw"."long_problem_submission"("round_id");

-- CreateIndex
CREATE INDEX "long_problem_submission_coder_id_idx" ON "dw"."long_problem_submission"("coder_id");

-- CreateIndex
CREATE UNIQUE INDEX "long_problem_submission_round_id_coder_id_component_id_subm_key" ON "dw"."long_problem_submission"("round_id", "coder_id", "component_id", "submission_number", "example");

-- CreateIndex
CREATE INDEX "system_test_case_component_id_idx" ON "dw"."system_test_case"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_test_case_component_id_test_case_id_key" ON "dw"."system_test_case"("component_id", "test_case_id");

-- CreateIndex
CREATE INDEX "long_system_test_result_round_id_idx" ON "dw"."long_system_test_result"("round_id");

-- CreateIndex
CREATE INDEX "long_system_test_result_coder_id_idx" ON "dw"."long_system_test_result"("coder_id");

-- CreateIndex
CREATE UNIQUE INDEX "long_system_test_result_round_id_coder_id_component_id_test_key" ON "dw"."long_system_test_result"("round_id", "coder_id", "component_id", "test_case_id", "submission_number", "example");

-- CreateIndex
CREATE INDEX "long_comp_result_round_id_idx" ON "dw"."long_comp_result"("round_id");

-- CreateIndex
CREATE INDEX "long_comp_result_coder_id_idx" ON "dw"."long_comp_result"("coder_id");

-- CreateIndex
CREATE UNIQUE INDEX "long_comp_result_round_id_coder_id_key" ON "dw"."long_comp_result"("round_id", "coder_id");

-- CreateIndex
CREATE INDEX "algo_rating_coder_id_idx" ON "dw"."algo_rating"("coder_id");

-- CreateIndex
CREATE INDEX "algo_rating_algo_rating_type_id_idx" ON "dw"."algo_rating"("algo_rating_type_id");

-- CreateIndex
CREATE INDEX "algo_rating_rating_idx" ON "dw"."algo_rating"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "algo_rating_coder_id_algo_rating_type_id_key" ON "dw"."algo_rating"("coder_id", "algo_rating_type_id");

-- CreateIndex
CREATE INDEX "algo_rating_history_coder_id_idx" ON "dw"."algo_rating_history"("coder_id");

-- CreateIndex
CREATE INDEX "algo_rating_history_round_id_idx" ON "dw"."algo_rating_history"("round_id");

-- CreateIndex
CREATE INDEX "algo_rating_history_algo_rating_type_id_idx" ON "dw"."algo_rating_history"("algo_rating_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "algo_rating_history_coder_id_round_id_algo_rating_type_id_key" ON "dw"."algo_rating_history"("coder_id", "round_id", "algo_rating_type_id");

-- CreateIndex
CREATE INDEX "coder_rank_coder_id_idx" ON "dw"."coder_rank"("coder_id");

-- CreateIndex
CREATE INDEX "coder_rank_rank_idx" ON "dw"."coder_rank"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "coder_rank_coder_id_coder_rank_type_id_algo_rating_type_id_key" ON "dw"."coder_rank"("coder_id", "coder_rank_type_id", "algo_rating_type_id");

-- CreateIndex
CREATE INDEX "coder_rank_history_coder_id_idx" ON "dw"."coder_rank_history"("coder_id");

-- CreateIndex
CREATE INDEX "coder_rank_history_round_id_idx" ON "dw"."coder_rank_history"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "coder_rank_history_coder_id_round_id_coder_rank_type_id_alg_key" ON "dw"."coder_rank_history"("coder_id", "round_id", "coder_rank_type_id", "algo_rating_type_id");

-- CreateIndex
CREATE INDEX "country_coder_rank_country_code_idx" ON "dw"."country_coder_rank"("country_code");

-- CreateIndex
CREATE INDEX "country_coder_rank_coder_rank_type_id_idx" ON "dw"."country_coder_rank"("coder_rank_type_id");

-- CreateIndex
CREATE INDEX "country_coder_rank_rank_idx" ON "dw"."country_coder_rank"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "country_coder_rank_coder_id_country_code_coder_rank_type_id_key" ON "dw"."country_coder_rank"("coder_id", "country_code", "coder_rank_type_id", "algo_rating_type_id");

-- CreateIndex
CREATE INDEX "state_coder_rank_state_code_idx" ON "dw"."state_coder_rank"("state_code");

-- CreateIndex
CREATE INDEX "state_coder_rank_coder_rank_type_id_idx" ON "dw"."state_coder_rank"("coder_rank_type_id");

-- CreateIndex
CREATE INDEX "state_coder_rank_rank_idx" ON "dw"."state_coder_rank"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "state_coder_rank_coder_id_state_code_coder_rank_type_id_alg_key" ON "dw"."state_coder_rank"("coder_id", "state_code", "coder_rank_type_id", "algo_rating_type_id");

-- CreateIndex
CREATE INDEX "school_coder_rank_school_id_idx" ON "dw"."school_coder_rank"("school_id");

-- CreateIndex
CREATE INDEX "school_coder_rank_coder_rank_type_id_idx" ON "dw"."school_coder_rank"("coder_rank_type_id");

-- CreateIndex
CREATE INDEX "school_coder_rank_rank_idx" ON "dw"."school_coder_rank"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "school_coder_rank_coder_id_school_id_coder_rank_type_id_alg_key" ON "dw"."school_coder_rank"("coder_id", "school_id", "coder_rank_type_id", "algo_rating_type_id");

-- CreateIndex
CREATE INDEX "streak_coder_id_idx" ON "dw"."streak"("coder_id");

-- CreateIndex
CREATE INDEX "streak_streak_type_id_idx" ON "dw"."streak"("streak_type_id");

-- CreateIndex
CREATE INDEX "user_status_idx" ON "dw"."user"("status");

-- CreateIndex
CREATE UNIQUE INDEX "coder_user_id_key" ON "dw"."coder"("user_id");

-- CreateIndex
CREATE INDEX "coder_user_id_idx" ON "dw"."coder"("user_id");

-- CreateIndex
CREATE INDEX "coder_state_code_idx" ON "dw"."coder"("state_code");

-- CreateIndex
CREATE INDEX "coder_country_code_idx" ON "dw"."coder"("country_code");

-- CreateIndex
CREATE INDEX "skill_skill_type_id_idx" ON "dw"."skill"("skill_type_id");

-- CreateIndex
CREATE INDEX "coder_skill_xref_coder_id_idx" ON "dw"."coder_skill_xref"("coder_id");

-- CreateIndex
CREATE INDEX "coder_skill_xref_skill_id_idx" ON "dw"."coder_skill_xref"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "coder_skill_xref_coder_id_skill_id_key" ON "dw"."coder_skill_xref"("coder_id", "skill_id");

-- CreateIndex
CREATE INDEX "image_image_type_id_idx" ON "dw"."image"("image_type_id");

-- CreateIndex
CREATE INDEX "image_path_id_idx" ON "dw"."image"("path_id");

-- CreateIndex
CREATE INDEX "coder_image_xref_coder_id_idx" ON "dw"."coder_image_xref"("coder_id");

-- CreateIndex
CREATE INDEX "coder_image_xref_image_id_idx" ON "dw"."coder_image_xref"("image_id");

-- CreateIndex
CREATE UNIQUE INDEX "coder_image_xref_coder_id_image_id_key" ON "dw"."coder_image_xref"("coder_id", "image_id");

-- CreateIndex
CREATE INDEX "school_state_code_idx" ON "dw"."school"("state_code");

-- CreateIndex
CREATE INDEX "school_country_code_idx" ON "dw"."school"("country_code");

-- CreateIndex
CREATE UNIQUE INDEX "current_school_coder_id_key" ON "dw"."current_school"("coder_id");

-- CreateIndex
CREATE INDEX "current_school_school_id_idx" ON "dw"."current_school"("school_id");

-- CreateIndex
CREATE INDEX "user_achievement_user_id_idx" ON "dw"."user_achievement"("user_id");

-- CreateIndex
CREATE INDEX "user_achievement_achievement_type_id_idx" ON "dw"."user_achievement"("achievement_type_id");

-- CreateIndex
CREATE INDEX "team_school_id_idx" ON "dw"."team"("school_id");

-- CreateIndex
CREATE INDEX "team_coder_xref_team_id_idx" ON "dw"."team_coder_xref"("team_id");

-- CreateIndex
CREATE INDEX "team_coder_xref_coder_id_idx" ON "dw"."team_coder_xref"("coder_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_coder_xref_team_id_coder_id_key" ON "dw"."team_coder_xref"("team_id", "coder_id");

-- CreateIndex
CREATE INDEX "event_event_type_id_idx" ON "dw"."event"("event_type_id");

-- CreateIndex
CREATE INDEX "event_registration_event_id_idx" ON "dw"."event_registration"("event_id");

-- CreateIndex
CREATE INDEX "event_registration_user_id_idx" ON "dw"."event_registration"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_registration_event_id_user_id_key" ON "dw"."event_registration"("event_id", "user_id");

-- AddForeignKey
ALTER TABLE "dw"."update_log" ADD CONSTRAINT "update_log_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "dw"."calendar"("calendar_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."round" ADD CONSTRAINT "round_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "dw"."contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."round" ADD CONSTRAINT "round_round_type_id_fkey" FOREIGN KEY ("round_type_id") REFERENCES "dw"."round_type_lu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."round" ADD CONSTRAINT "round_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "dw"."calendar"("calendar_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."round" ADD CONSTRAINT "round_time_id_fkey" FOREIGN KEY ("time_id") REFERENCES "dw"."time"("time_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."component" ADD CONSTRAINT "component_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "dw"."problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."round_component" ADD CONSTRAINT "round_component_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "dw"."round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."round_component" ADD CONSTRAINT "round_component_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "dw"."component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."problem_category_xref" ADD CONSTRAINT "problem_category_xref_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "dw"."problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."long_problem_submission" ADD CONSTRAINT "long_problem_submission_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "dw"."round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."system_test_case" ADD CONSTRAINT "system_test_case_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "dw"."component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."long_system_test_result" ADD CONSTRAINT "long_system_test_result_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "dw"."round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."long_system_test_result" ADD CONSTRAINT "long_system_test_result_component_id_test_case_id_fkey" FOREIGN KEY ("component_id", "test_case_id") REFERENCES "dw"."system_test_case"("component_id", "test_case_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."long_comp_result" ADD CONSTRAINT "long_comp_result_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "dw"."round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."algo_rating" ADD CONSTRAINT "algo_rating_algo_rating_type_id_fkey" FOREIGN KEY ("algo_rating_type_id") REFERENCES "dw"."algo_rating_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."algo_rating" ADD CONSTRAINT "algo_rating_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "dw"."round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."algo_rating" ADD CONSTRAINT "algo_rating_first_rated_round_id_fkey" FOREIGN KEY ("first_rated_round_id") REFERENCES "dw"."round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."algo_rating" ADD CONSTRAINT "algo_rating_last_rated_round_id_fkey" FOREIGN KEY ("last_rated_round_id") REFERENCES "dw"."round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."algo_rating_history" ADD CONSTRAINT "algo_rating_history_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "dw"."round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."algo_rating_history" ADD CONSTRAINT "algo_rating_history_algo_rating_type_id_fkey" FOREIGN KEY ("algo_rating_type_id") REFERENCES "dw"."algo_rating_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder_rank" ADD CONSTRAINT "coder_rank_coder_rank_type_id_fkey" FOREIGN KEY ("coder_rank_type_id") REFERENCES "dw"."coder_rank_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder_rank" ADD CONSTRAINT "coder_rank_algo_rating_type_id_fkey" FOREIGN KEY ("algo_rating_type_id") REFERENCES "dw"."algo_rating_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder_rank_history" ADD CONSTRAINT "coder_rank_history_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "dw"."round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder_rank_history" ADD CONSTRAINT "coder_rank_history_coder_rank_type_id_fkey" FOREIGN KEY ("coder_rank_type_id") REFERENCES "dw"."coder_rank_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder_rank_history" ADD CONSTRAINT "coder_rank_history_algo_rating_type_id_fkey" FOREIGN KEY ("algo_rating_type_id") REFERENCES "dw"."algo_rating_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."country_coder_rank" ADD CONSTRAINT "country_coder_rank_coder_rank_type_id_fkey" FOREIGN KEY ("coder_rank_type_id") REFERENCES "dw"."coder_rank_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."country_coder_rank" ADD CONSTRAINT "country_coder_rank_algo_rating_type_id_fkey" FOREIGN KEY ("algo_rating_type_id") REFERENCES "dw"."algo_rating_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."state_coder_rank" ADD CONSTRAINT "state_coder_rank_coder_rank_type_id_fkey" FOREIGN KEY ("coder_rank_type_id") REFERENCES "dw"."coder_rank_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."state_coder_rank" ADD CONSTRAINT "state_coder_rank_algo_rating_type_id_fkey" FOREIGN KEY ("algo_rating_type_id") REFERENCES "dw"."algo_rating_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."school_coder_rank" ADD CONSTRAINT "school_coder_rank_coder_rank_type_id_fkey" FOREIGN KEY ("coder_rank_type_id") REFERENCES "dw"."coder_rank_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."school_coder_rank" ADD CONSTRAINT "school_coder_rank_algo_rating_type_id_fkey" FOREIGN KEY ("algo_rating_type_id") REFERENCES "dw"."algo_rating_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder" ADD CONSTRAINT "coder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "dw"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder" ADD CONSTRAINT "coder_state_code_fkey" FOREIGN KEY ("state_code") REFERENCES "dw"."state"("state_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder" ADD CONSTRAINT "coder_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "dw"."country"("country_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder" ADD CONSTRAINT "coder_comp_country_code_fkey" FOREIGN KEY ("comp_country_code") REFERENCES "dw"."country"("country_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."skill" ADD CONSTRAINT "skill_skill_type_id_fkey" FOREIGN KEY ("skill_type_id") REFERENCES "dw"."skill_type_lu"("skill_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder_skill_xref" ADD CONSTRAINT "coder_skill_xref_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "dw"."coder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder_skill_xref" ADD CONSTRAINT "coder_skill_xref_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "dw"."skill"("skill_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."image" ADD CONSTRAINT "image_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "dw"."path"("path_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder_image_xref" ADD CONSTRAINT "coder_image_xref_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "dw"."coder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."coder_image_xref" ADD CONSTRAINT "coder_image_xref_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "dw"."image"("image_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."school" ADD CONSTRAINT "school_state_code_fkey" FOREIGN KEY ("state_code") REFERENCES "dw"."state"("state_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."school" ADD CONSTRAINT "school_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "dw"."country"("country_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."current_school" ADD CONSTRAINT "current_school_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "dw"."coder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."current_school" ADD CONSTRAINT "current_school_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "dw"."school"("school_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."user_achievement" ADD CONSTRAINT "user_achievement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "dw"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."user_achievement" ADD CONSTRAINT "user_achievement_achievement_type_id_fkey" FOREIGN KEY ("achievement_type_id") REFERENCES "dw"."achievement_type_lu"("achievement_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."team" ADD CONSTRAINT "team_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "dw"."school"("school_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."team_coder_xref" ADD CONSTRAINT "team_coder_xref_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "dw"."team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."team_coder_xref" ADD CONSTRAINT "team_coder_xref_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "dw"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."event" ADD CONSTRAINT "event_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "dw"."event_type_lu"("event_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."event_registration" ADD CONSTRAINT "event_registration_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "dw"."event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."event_registration" ADD CONSTRAINT "event_registration_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "dw"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

