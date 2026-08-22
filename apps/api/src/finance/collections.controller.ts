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
import { OPERATIONAL_ADMIN_ROLES, Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { CollectionsService } from "./collections.service.js";
import {
  CollectionFiltersDto,
  CollectionInvoiceParamsDto,
  CreateCollectionActionDto,
  ListCollectionCasesDto,
} from "./dto/collections.dto.js";

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class CollectionsController {
  constructor(
    @Inject(CollectionsService) private readonly collections: CollectionsService,
  ) {}

  @Get("finance/collections/summary")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  getSummary(@Query() query: CollectionFiltersDto, @CurrentUser() user: AuthUser) {
    return this.collections.getSummary(query, user);
  }

  @Get("finance/collections/cases")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  listCases(@Query() query: ListCollectionCasesDto, @CurrentUser() user: AuthUser) {
    return this.collections.listCases(query, query, user);
  }

  @Get("finance/collections/cases/:invoiceId")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  getCaseByInvoiceId(
    @Param() params: CollectionInvoiceParamsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.getCaseByInvoiceId(params.invoiceId, user);
  }

  @Get("finance/collections/cases/:invoiceId/actions")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  listActions(
    @Param() params: CollectionInvoiceParamsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.listActions(params.invoiceId, user);
  }

  @Post("finance/collections/cases/:invoiceId/actions")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
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
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  listFollowUps(
    @Query() query: CollectionFiltersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.listFollowUps(query, user);
  }
}
