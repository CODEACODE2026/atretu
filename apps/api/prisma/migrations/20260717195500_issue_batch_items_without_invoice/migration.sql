ALTER TABLE "bank_slip_issue_batch_items"
  ADD COLUMN "student_id" UUID,
  ADD COLUMN "enrollment_id" UUID;

UPDATE "bank_slip_issue_batch_items" item
SET
  "student_id" = invoice."student_id",
  "enrollment_id" = invoice."enrollment_id"
FROM "invoices" invoice
WHERE item."invoice_id" = invoice."id";

ALTER TABLE "bank_slip_issue_batch_items"
  ALTER COLUMN "invoice_id" DROP NOT NULL;

ALTER TABLE "bank_slip_issue_batch_items"
  ADD CONSTRAINT "bank_slip_issue_batch_items_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_slip_issue_batch_items"
  ADD CONSTRAINT "bank_slip_issue_batch_items_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "bank_slip_issue_batch_items_student_id_idx" ON "bank_slip_issue_batch_items"("student_id");
CREATE INDEX "bank_slip_issue_batch_items_enrollment_id_idx" ON "bank_slip_issue_batch_items"("enrollment_id");
