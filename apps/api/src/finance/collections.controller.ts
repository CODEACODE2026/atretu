import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OperationalPermission } from "../auth/operational-permissions.js";
import {
  OperationalRateLimit,
  OperationalRateLimitGuard,
  RATE_LIMITS,
} from "../security/operational-rate-limit.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { CollectionsService } from "./collections.service.js";
import {
  CollectionFiltersDto,
  CollectionInvoiceParamsDto,
  CreateCollectionActionDto,
  ListCollectionCasesDto,
} from "./dto/collections.dto.js";

@UseGuards(AuthGuard)
@Controller()
export class CollectionsController {
  constructor(
    @Inject(CollectionsService) private readonly collections: CollectionsService,
  ) {}

  @Get("finance/collections/summary")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("collections.view")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  getSummary(@Query() query: CollectionFiltersDto, @CurrentUser() user: AuthUser) {
    return this.collections.getSummary(query, user);
  }

  @Get("finance/collections/cases")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("collections.view")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  listCases(@Query() query: ListCollectionCasesDto, @CurrentUser() user: AuthUser) {
    return this.collections.listCases(query, query, user);
  }

  @Get("finance/collections/cases/:invoiceId")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("collections.view")
  getCaseByInvoiceId(
    @Param() params: CollectionInvoiceParamsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.getCaseByInvoiceId(params.invoiceId, user);
  }

  @Get("finance/collections/cases/:invoiceId/actions")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("collections.view")
  listActions(
    @Param() params: CollectionInvoiceParamsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.listActions(params.invoiceId, user);
  }

  @Post("finance/collections/cases/:invoiceId/actions")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("collections.manage")
  createAction(
    @Param() params: CollectionInvoiceParamsDto,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: CreateCollectionActionDto,
      }),
    )
    body: CreateCollectionActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.createAction(params.invoiceId, body, user);
  }

  @Get("finance/collections/follow-ups")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("collections.view")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  listFollowUps(
    @Query() query: CollectionFiltersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.listFollowUps(query, user);
  }
}
