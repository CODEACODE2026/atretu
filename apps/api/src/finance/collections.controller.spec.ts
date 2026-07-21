import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException, RequestMethod } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import {
  CollectionActionType,
  CollectionChannel,
  RoleCode,
  UserStatus,
} from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { CollectionsController } from "./collections.controller.js";
import {
  CollectionAgingBucket,
  CollectionFiltersDto,
  CollectionInvoiceParamsDto,
  CollectionOperationalStatus,
  CreateCollectionActionDto,
  ListCollectionCasesDto,
} from "./dto/collections.dto.js";

const USER: AuthUser = {
  id: "user-1",
  name: "Secretaria",
  email: "secretaria@test",
  status: UserStatus.ACTIVE,
  roles: [RoleCode.SECRETARIA],
};
const GUARDS_METADATA_KEY = "__guards__";
const METHOD_METADATA_KEY = "method";
const PATH_METADATA_KEY = "path";

async function testControllerRoutesGuardsAndRoles() {
  const controller = newController();
  const classGuards = Reflect.getMetadata(
    GUARDS_METADATA_KEY,
    CollectionsController,
  ) as unknown[];

  assert.deepEqual(classGuards, [AuthGuard, RolesGuard]);
  assertRoute("getSummary", "finance/collections/summary");
  assertRoute("listCases", "finance/collections/cases");
  assertRoute("getCaseByInvoiceId", "finance/collections/cases/:invoiceId");
  assertRoute("listActions", "finance/collections/cases/:invoiceId/actions");
  assertRoute(
    "createAction",
    "finance/collections/cases/:invoiceId/actions",
    RequestMethod.POST,
  );
  assertRoute("listFollowUps", "finance/collections/follow-ups");

  for (const method of [
    "getSummary",
    "listCases",
    "getCaseByInvoiceId",
    "listActions",
    "createAction",
    "listFollowUps",
  ] as const) {
    assert.deepEqual(
      Reflect.getMetadata("roles", CollectionsController.prototype[method]),
      [RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA],
    );
  }

  assert.ok(controller);
}

async function testCreateActionEndpointCallsServiceWithAuthenticatedUser() {
  const service = new FakeCollectionsService();
  const controller = newController(service);
  const params = {
    invoiceId: "44444444-4444-4444-8444-444444444444",
  };
  const body = plainToInstance(CreateCollectionActionDto, {
    actionType: CollectionActionType.CONTACT_MADE,
    channel: CollectionChannel.WHATSAPP,
    contactedName: "Responsavel",
    contactedDocumentMasked: "***123",
    note: "Contato realizado.",
  });
  const promiseBody = plainToInstance(CreateCollectionActionDto, {
    actionType: CollectionActionType.PROMISE_TO_PAY,
    channel: CollectionChannel.WHATSAPP,
    note: "Promessa registrada.",
    promisedAmountCents: 15_000,
    promiseDueDate: "2026-07-25",
  });
  const followUpBody = plainToInstance(CreateCollectionActionDto, {
    actionType: CollectionActionType.FOLLOW_UP_SCHEDULED,
    note: "Retorno agendado.",
    nextFollowUpAt: "2026-07-22T14:00:00.000Z",
  });

  const result = await controller.createAction(params, body, USER);
  await controller.createAction(params, promiseBody, USER);
  await controller.createAction(params, followUpBody, USER);

  assert.equal(result, service.createdAction);
  assert.deepEqual(
    service.calls.map((call) => ({
      method: call.method,
      invoiceId: call.invoiceId,
      body: call.body,
      user: call.user,
    })),
    [
      { method: "createAction", invoiceId: params.invoiceId, body, user: USER },
      {
        method: "createAction",
        invoiceId: params.invoiceId,
        body: promiseBody,
        user: USER,
      },
      {
        method: "createAction",
        invoiceId: params.invoiceId,
        body: followUpBody,
        user: USER,
      },
    ],
  );
}

async function testSummaryEndpointCallsService() {
  const service = new FakeCollectionsService();
  const controller = newController(service);
  const query = plainToInstance(CollectionFiltersDto, {
    institutionId: "11111111-1111-4111-8111-111111111111",
    operationalStatus: CollectionOperationalStatus.PROMISE_BROKEN,
  });

  const result = await controller.getSummary(query, USER);

  assert.equal(result, service.summary);
  assert.deepEqual(service.calls[0], {
    method: "getSummary",
    filters: query,
    user: USER,
  });
}

async function testListCasesEndpointPassesFiltersAndPagination() {
  const service = new FakeCollectionsService();
  const controller = newController(service);
  const query = plainToInstance(ListCollectionCasesDto, {
    institutionId: "11111111-1111-4111-8111-111111111111",
    academicYearId: "22222222-2222-4222-8222-222222222222",
    studentId: "33333333-3333-4333-8333-333333333333",
    search: " Ana ",
    dueDateFrom: "2026-07-01",
    dueDateTo: "2026-07-31",
    agingBucket: CollectionAgingBucket.DAYS_31_60,
    operationalStatus: CollectionOperationalStatus.CONTACTED,
    actionType: CollectionActionType.CONTACT_MADE,
    followUpFrom: "2026-07-21",
    followUpTo: "2026-07-22",
    page: 2,
    limit: 5,
  });

  const result = await controller.listCases(query, USER);

  assert.equal(result, service.cases);
  assert.deepEqual(service.calls[0], {
    method: "listCases",
    filters: query,
    pagination: query,
    user: USER,
  });
}

async function testDetailActionsAndFollowUpsEndpointsCallService() {
  const service = new FakeCollectionsService();
  const controller = newController(service);
  const params = {
    invoiceId: "44444444-4444-4444-8444-444444444444",
  };
  const filters = plainToInstance(CollectionFiltersDto, {
    followUpFrom: "2026-07-21",
  });

  assert.equal(await controller.getCaseByInvoiceId(params, USER), service.detail);
  assert.equal(await controller.listActions(params, USER), service.actions);
  assert.equal(await controller.listFollowUps(filters, USER), service.followUps);
  assert.deepEqual(service.calls, [
    {
      method: "getCaseByInvoiceId",
      invoiceId: params.invoiceId,
      user: USER,
    },
    { method: "listActions", invoiceId: params.invoiceId, user: USER },
    { method: "listFollowUps", filters, user: USER },
  ]);
}

async function testDtoValidationRejectsInvalidParamsFiltersEnumsAndPagination() {
  assertValidationErrors(CollectionInvoiceParamsDto, { invoiceId: "not-uuid" });
  assertValidationErrors(ListCollectionCasesDto, { page: 0 });
  assertValidationErrors(ListCollectionCasesDto, { limit: 101 });
  assertValidationErrors(CollectionFiltersDto, { dueDateFrom: "not-date" });
  assertValidationErrors(CollectionFiltersDto, { agingBucket: "DAYS_0_7" });
  assertValidationErrors(CollectionFiltersDto, { operationalStatus: "OPEN" });
  assertValidationErrors(CollectionFiltersDto, { actionType: "CALL_BACK" });
  assertValidationErrors(CreateCollectionActionDto, { note: "Sem tipo." });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
    note: "   ",
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
    note: "x".repeat(1001),
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: "CALL_BACK",
    note: "Enum invalido.",
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.CONTACT_MADE,
    channel: "SMS",
    note: "Canal invalido.",
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
    note: "Valor invalido.",
    promisedAmountCents: 0,
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
    note: "Valor invalido.",
    promisedAmountCents: -1,
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
    note: "Valor invalido.",
    promisedAmountCents: 10.5,
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
    note: "Data invalida.",
    promiseDueDate: "not-date",
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
    note: "Campo bloqueado.",
    source: "SYSTEM",
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
    note: "Campo bloqueado.",
    createdByUserId: "user-2",
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
    note: "Campo bloqueado.",
    invoiceId: "44444444-4444-4444-8444-444444444444",
  });
  assertValidationErrors(CreateCollectionActionDto, {
    actionType: CollectionActionType.INTERNAL_NOTE,
    note: "Campo bloqueado.",
    unexpected: "x",
  });

  assert.equal(
    validateSync(
      plainToInstance(CollectionFiltersDto, {
        operationalStatus: CollectionOperationalStatus.PARTIAL_PAYMENT_REVIEW,
        actionType: CollectionActionType.CONTACT_ATTEMPT,
      }),
    ).length,
    0,
  );
  assert.equal(
    validateSync(
      plainToInstance(CreateCollectionActionDto, {
        actionType: CollectionActionType.CONTACT_MADE,
        channel: CollectionChannel.PHONE,
        note: "Contato realizado.",
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    ).length,
    0,
  );
}

async function testServiceErrorsPropagateForNotFoundAndAccessDenied() {
  const service = new FakeCollectionsService();
  const controller = newController(service);
  const params = {
    invoiceId: "44444444-4444-4444-8444-444444444444",
  };
  service.detailError = new NotFoundException("Fatura nao encontrada");
  service.actionsError = new ForbiddenException("Acesso negado");

  await assert.rejects(
    () => controller.getCaseByInvoiceId(params, USER),
    /Fatura nao encontrada/,
  );
  await assert.rejects(() => controller.listActions(params, USER), /Acesso negado/);
}

function newController(service = new FakeCollectionsService()) {
  return new CollectionsController(service as never);
}

function assertRoute(
  method: keyof CollectionsController,
  path: string,
  requestMethod = RequestMethod.GET,
) {
  assert.equal(
    Reflect.getMetadata(PATH_METADATA_KEY, CollectionsController.prototype[method]),
    path,
  );
  assert.equal(
    Reflect.getMetadata(METHOD_METADATA_KEY, CollectionsController.prototype[method]),
    requestMethod,
  );
}

function assertValidationErrors<T extends object>(
  dto: new () => T,
  value: Record<string, unknown>,
) {
  const errors = validateSync(plainToInstance(dto, value), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  assert.ok(errors.length > 0, `${dto.name} should reject ${JSON.stringify(value)}`);
}

class FakeCollectionsService {
  summary = {
    totalOverdueCents: 100_000,
    invoiceCount: 2,
    studentCount: 1,
    averageOverdueAmountCents: 50_000,
    agingBuckets: {
      DAYS_1_30: 1,
      DAYS_31_60: 1,
      DAYS_61_90: 0,
      DAYS_90_PLUS: 0,
    },
    promisesActiveCount: 0,
    promisesBrokenCount: 1,
    followUpsTodayCount: 0,
    partialPaymentReviewCount: 0,
  };
  cases = {
    data: [{ invoiceId: "invoice-1" }],
    pagination: { page: 2, limit: 5, total: 1, totalPages: 1 },
  };
  detail = { invoiceId: "invoice-1" };
  actions = { data: [{ id: "collection-action-1" }] };
  createdAction = { id: "collection-action-created" };
  followUps = { data: [{ invoiceId: "invoice-1" }] };
  detailError: Error | null = null;
  actionsError: Error | null = null;
  calls: Array<Record<string, unknown>> = [];

  async getSummary(filters: CollectionFiltersDto, user: AuthUser) {
    this.calls.push({ method: "getSummary", filters, user });
    return this.summary;
  }

  async listCases(
    filters: CollectionFiltersDto,
    pagination: ListCollectionCasesDto,
    user: AuthUser,
  ) {
    this.calls.push({ method: "listCases", filters, pagination, user });
    return this.cases;
  }

  async getCaseByInvoiceId(invoiceId: string, user: AuthUser) {
    this.calls.push({ method: "getCaseByInvoiceId", invoiceId, user });
    if (this.detailError) {
      throw this.detailError;
    }
    return this.detail;
  }

  async listActions(invoiceId: string, user: AuthUser) {
    this.calls.push({ method: "listActions", invoiceId, user });
    if (this.actionsError) {
      throw this.actionsError;
    }
    return this.actions;
  }

  async createAction(
    invoiceId: string,
    body: CreateCollectionActionDto,
    user: AuthUser,
  ) {
    this.calls.push({ method: "createAction", invoiceId, body, user });
    return this.createdAction;
  }

  async listFollowUps(filters: CollectionFiltersDto, user: AuthUser) {
    this.calls.push({ method: "listFollowUps", filters, user });
    return this.followUps;
  }
}

await testControllerRoutesGuardsAndRoles();
await testCreateActionEndpointCallsServiceWithAuthenticatedUser();
await testSummaryEndpointCallsService();
await testListCasesEndpointPassesFiltersAndPagination();
await testDetailActionsAndFollowUpsEndpointsCallService();
await testDtoValidationRejectsInvalidParamsFiltersEnumsAndPagination();
await testServiceErrorsPropagateForNotFoundAndAccessDenied();
