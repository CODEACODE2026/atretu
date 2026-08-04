CREATE TABLE "user_institutions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_institutions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_institutions_user_id_institution_id_key" ON "user_institutions"("user_id", "institution_id");
CREATE INDEX "user_institutions_user_id_idx" ON "user_institutions"("user_id");
CREATE INDEX "user_institutions_institution_id_idx" ON "user_institutions"("institution_id");

ALTER TABLE "user_institutions" ADD CONSTRAINT "user_institutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_institutions" ADD CONSTRAINT "user_institutions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
