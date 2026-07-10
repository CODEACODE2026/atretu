ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'STUDENT_CREATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'PERSON_UPDATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'GUARDIAN_UPDATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'ENROLLMENT_CREATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'ENROLLMENT_UPDATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'ACADEMIC_YEAR_CREATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'ACADEMIC_YEAR_UPDATED';
ALTER TYPE "AdministrativeAuditEventType" ADD VALUE 'ACADEMIC_YEAR_CURRENT_CHANGED';

CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE');

CREATE TABLE "people" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "full_name" VARCHAR(160) NOT NULL,
  "normalized_name" VARCHAR(160) NOT NULL,
  "cpf" VARCHAR(11) NOT NULL,
  "rg" VARCHAR(30),
  "birth_date" DATE NOT NULL,
  "phone" VARCHAR(30),
  "email" VARCHAR(180),
  "address_street" VARCHAR(180) NOT NULL,
  "address_number" VARCHAR(30) NOT NULL,
  "address_neighborhood" VARCHAR(120) NOT NULL,
  "address_city" VARCHAR(120) NOT NULL,
  "address_zip_code" VARCHAR(20),
  "address_state" VARCHAR(2),
  "address_complement" VARCHAR(120),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "students" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "person_id" UUID NOT NULL,
  "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
  "joined_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_guardians" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "full_name" VARCHAR(160) NOT NULL,
  "cpf" VARCHAR(11),
  "rg" VARCHAR(30),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_years" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "year" INTEGER NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enrollments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "shift_id" UUID NOT NULL,
  "course" VARCHAR(140) NOT NULL,
  "grade" VARCHAR(40) NOT NULL,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "people_cpf_key" ON "people"("cpf");
CREATE INDEX "people_normalized_name_idx" ON "people"("normalized_name");
CREATE INDEX "people_created_at_idx" ON "people"("created_at");

CREATE UNIQUE INDEX "students_person_id_key" ON "students"("person_id");
CREATE INDEX "students_status_created_at_idx" ON "students"("status", "created_at");
CREATE INDEX "students_joined_at_idx" ON "students"("joined_at");

CREATE UNIQUE INDEX "student_guardians_student_id_key" ON "student_guardians"("student_id");
CREATE INDEX "student_guardians_cpf_idx" ON "student_guardians"("cpf");

CREATE UNIQUE INDEX "academic_years_year_key" ON "academic_years"("year");
CREATE UNIQUE INDEX "academic_years_one_current_key" ON "academic_years"("is_current") WHERE "is_current" = true;
CREATE INDEX "academic_years_is_current_idx" ON "academic_years"("is_current");
CREATE INDEX "academic_years_created_at_idx" ON "academic_years"("created_at");

CREATE UNIQUE INDEX "enrollments_student_id_academic_year_id_key" ON "enrollments"("student_id", "academic_year_id");
CREATE INDEX "enrollments_academic_year_id_status_idx" ON "enrollments"("academic_year_id", "status");
CREATE INDEX "enrollments_institution_id_idx" ON "enrollments"("institution_id");
CREATE INDEX "enrollments_shift_id_idx" ON "enrollments"("shift_id");
CREATE INDEX "enrollments_created_at_idx" ON "enrollments"("created_at");

ALTER TABLE "students"
  ADD CONSTRAINT "students_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_guardians"
  ADD CONSTRAINT "student_guardians_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
