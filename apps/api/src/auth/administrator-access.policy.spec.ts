import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode, UserStatus } from "@prisma/client";
import { AssociationSettingsController } from "../association-settings/association-settings.controller.js";
import { BaseRecordsController } from "../base-records/base-records.controller.js";
import { BusAssignmentsController } from "../bus-assignments/bus-assignments.controller.js";
import { DocumentsController } from "../documents/documents.controller.js";
import { StudentPhotosController } from "../documents/student-photos.controller.js";
import { BankSlipsController } from "../finance/bank-slips.controller.js";
import { CollectionsController } from "../finance/collections.controller.js";
import { FinancialReportsController } from "../finance/financial-reports.controller.js";
import { InvoicesController } from "../finance/invoices.controller.js";
import { ManualFinancialMovementsController } from "../finance/manual-movements.controller.js";
import { JobsController } from "../jobs/jobs.controller.js";
import { LegacyImportController } from "../legacy-import/legacy-import.controller.js";
import {
  InstitutionalOfficialDocumentsController,
  OfficialDocumentIssuesController,
  OfficialDocumentModelsController,
  OfficialDocumentsController,
} from "../official-documents/official-documents.controller.js";
import { PermissionProfilesController } from "../permission-profiles/permission-profiles.controller.js";
import { StudentCardsController } from "../student-cards/student-cards.controller.js";
import { StudentsController } from "../students/students.controller.js";
import { AdminUsersController } from "../users/admin-users.controller.js";
import { OPERATIONAL_PERMISSIONS_KEY } from "./operational-permissions.js";
import { OPERATIONAL_ADMIN_ROLES, Roles } from "./roles.decorator.js";
import { RolesGuard } from "./roles.guard.js";

const ROLES_METADATA_KEY = "roles";

class OperationalEndpoint {
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  handler() {
    return true;
  }
}

const rolesGuard = new RolesGuard(new Reflector());
const operationalHandler = Object.getOwnPropertyDescriptor(
  OperationalEndpoint.prototype,
  "handler",
)?.value as () => boolean;

for (const role of OPERATIONAL_ADMIN_ROLES) {
  assert.equal(
    rolesGuard.canActivate(executionContext(OperationalEndpoint, operationalHandler, [role])),
    true,
    `${role} must be accepted by fixed operational admin policy without PermissionProfile`,
  );
}

for (const role of [RoleCode.USER, RoleCode.GESTOR]) {
  assert.throws(
    () => rolesGuard.canActivate(executionContext(OperationalEndpoint, operationalHandler, [role])),
    (error) => error instanceof ForbiddenException,
    `${role} must not inherit ADMINISTRATOR operational access`,
  );
}

const administratorOperationalEndpoints = [
  [BaseRecordsController, "createInstitution"],
  [BaseRecordsController, "getInstitution"],
  [BaseRecordsController, "updateInstitution"],
  [BaseRecordsController, "inactivateInstitution"],
  [BaseRecordsController, "reactivateInstitution"],
  [BaseRecordsController, "createShift"],
  [BaseRecordsController, "getShift"],
  [BaseRecordsController, "updateShift"],
  [BaseRecordsController, "inactivateShift"],
  [BaseRecordsController, "reactivateShift"],
  [BaseRecordsController, "createBus"],
  [BaseRecordsController, "getBus"],
  [BaseRecordsController, "updateBus"],
  [BaseRecordsController, "inactivateBus"],
  [BaseRecordsController, "reactivateBus"],
  [BusAssignmentsController, undefined],
  [DocumentsController, undefined],
  [StudentPhotosController, undefined],
  [OfficialDocumentsController, undefined],
  [OfficialDocumentIssuesController, undefined],
  [OfficialDocumentModelsController, undefined],
  [InstitutionalOfficialDocumentsController, undefined],
  [StudentCardsController, "listStudentCards"],
  [InvoicesController, "listInvoices"],
  [InvoicesController, "getInvoice"],
  [InvoicesController, "listStudentInvoices"],
  [InvoicesController, "previewInvoice"],
  [InvoicesController, "createInvoice"],
  [InvoicesController, "cancelInvoice"],
  [BankSlipsController, "issueForInvoice"],
  [BankSlipsController, "getByInvoice"],
  [BankSlipsController, "syncByInvoice"],
  [BankSlipsController, "createIssueBatch"],
  [BankSlipsController, "previewIssueBatch"],
  [BankSlipsController, "listIssueBatches"],
  [BankSlipsController, "getIssueBatch"],
  [BankSlipsController, "listIssueBatchItems"],
  [BankSlipsController, "downloadIssueBatchPdfs"],
  [BankSlipsController, "cancelIssueBatch"],
  [BankSlipsController, "requestCancellation"],
  [BankSlipsController, "getPdf"],
  [CollectionsController, "getSummary"],
  [CollectionsController, "listCases"],
  [CollectionsController, "getCaseByInvoiceId"],
  [CollectionsController, "listActions"],
  [CollectionsController, "createAction"],
  [CollectionsController, "listFollowUps"],
  [FinancialReportsController, "monthly"],
  [ManualFinancialMovementsController, "list"],
  [ManualFinancialMovementsController, "get"],
  [ManualFinancialMovementsController, "create"],
  [ManualFinancialMovementsController, "update"],
  [ManualFinancialMovementsController, "markPaid"],
  [ManualFinancialMovementsController, "cancel"],
  [ManualFinancialMovementsController, "attach"],
  [ManualFinancialMovementsController, "viewAttachment"],
  [ManualFinancialMovementsController, "downloadAttachment"],
  [StudentsController, "listStudentLegacyFinancialHistory"],
] as const;

const studentAuxiliaryReferenceEndpoints = [
  [BaseRecordsController, "listInstitutions"],
  [BaseRecordsController, "listShifts"],
  [BaseRecordsController, "listBuses"],
] as const;

assert.equal(
  rolesGuard.canActivate(
    controllerExecutionContext(
      BaseRecordsController,
      "listInstitutions",
      [RoleCode.ADMINISTRATOR],
    ),
  ),
  true,
  "ADMINISTRATOR must reach an actual operational endpoint without PermissionProfile",
);

for (const item of administratorOperationalEndpoints) {
  assert.deepEqual(
    rolesMetadata(item[0], item[1]),
    [...OPERATIONAL_ADMIN_ROLES],
    `${item[0].name}${item[1] ? `.${item[1]}` : ""} must allow fixed operational admin roles`,
  );
  if (item[1]) {
    assert.equal(
      rolesGuard.canActivate(
        controllerExecutionContext(item[0], item[1], [RoleCode.ADMINISTRATOR]),
      ),
      true,
      `${item[0].name}.${item[1]} must allow ADMINISTRATOR without PermissionProfile or UserInstitution`,
    );
  }
}

for (const item of studentAuxiliaryReferenceEndpoints) {
  assert.deepEqual(
    rolesMetadata(item[0], item[1]),
    [],
    `${item[0].name}.${item[1]} must not require base records admin roles`,
  );
  assert.deepEqual(
    operationalPermissionMetadata(item[0], item[1]),
    ["students.view"],
    `${item[0].name}.${item[1]} must be available as a students.view auxiliary reference`,
  );
}

const superAdminOnlyEndpoints = [
  [LegacyImportController, undefined],
  [JobsController, undefined],
  [AdminUsersController, undefined],
  [PermissionProfilesController, undefined],
  [AssociationSettingsController, undefined],
  [StudentsController, "createAcademicYear"],
  [StudentsController, "setCurrentAcademicYear"],
  [StudentsController, "archiveAcademicYear"],
  [StudentsController, "reactivateAcademicYear"],
  [StudentsController, "deleteAcademicYear"],
  [StudentsController, "updateBoardMembershipRole"],
  [OfficialDocumentsController, "invalidateOfficialDocument"],
  [InstitutionalOfficialDocumentsController, "issueInstitutionalOfficialDocument"],
  [InstitutionalOfficialDocumentsController, "reissueInstitutionalOfficialDocument"],
  [BankSlipsController, "recoverIssuedFromProviderResponse"],
  [BankSlipsController, "syncPaidByDay"],
  [BankSlipsController, "syncOpenIssued"],
  [BankSlipsController, "recoverBankSlipPdfs"],
  [BankSlipsController, "listSyncRuns"],
  [BankSlipsController, "getSyncRun"],
  [BankSlipsController, "listSyncRunItems"],
  [BankSlipsController, "retryFailedIssueBatch"],
] as const;

assert.throws(
  () =>
    rolesGuard.canActivate(
      controllerExecutionContext(JobsController, "status", [RoleCode.ADMINISTRATOR]),
    ),
  (error) => error instanceof ForbiddenException,
  "ADMINISTRATOR must receive 403 on an actual technical endpoint",
);

for (const item of superAdminOnlyEndpoints) {
  assert.deepEqual(
    rolesMetadata(item[0], item[1]),
    [RoleCode.SUPER_ADMIN],
    `${item[0].name}${item[1] ? `.${item[1]}` : ""} must remain SUPER_ADMIN-only`,
  );
  if (item[1]) {
    assert.throws(
      () =>
        rolesGuard.canActivate(
          controllerExecutionContext(item[0], item[1], [RoleCode.ADMINISTRATOR]),
        ),
      (error) => error instanceof ForbiddenException,
      `${item[0].name}.${item[1]} must return 403 for ADMINISTRATOR`,
    );
  }
}

function rolesMetadata(
  controller: Function,
  method?: string,
): RoleCode[] {
  if (!method) {
    return Reflect.getMetadata(ROLES_METADATA_KEY, controller) ?? [];
  }
  const handler = Object.getOwnPropertyDescriptor(
    controller.prototype,
    method,
  )?.value as object;
  return (
    Reflect.getMetadata(
      ROLES_METADATA_KEY,
      handler,
    ) ?? []
  );
}

function operationalPermissionMetadata(
  controller: Function,
  method: string,
): string[] {
  const handler = Object.getOwnPropertyDescriptor(
    controller.prototype,
    method,
  )?.value as object;
  return Reflect.getMetadata(OPERATIONAL_PERMISSIONS_KEY, handler) ?? [];
}

function executionContext(
  controller: Function,
  handler: () => boolean,
  roles: RoleCode[],
) {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          email: "administrator@example.com",
          id: "administrator-1",
          institutionIds: [],
          name: "Administrator",
          permissionProfileId: null,
          roles,
          status: UserStatus.ACTIVE,
        },
      }),
    }),
  } as never;
}

function controllerExecutionContext(
  controller: Function,
  method: string,
  roles: RoleCode[],
) {
  const handler = Object.getOwnPropertyDescriptor(
    controller.prototype,
    method,
  )?.value as () => boolean;
  return executionContext(controller, handler, roles);
}

console.log("Administrator access policy OK");
