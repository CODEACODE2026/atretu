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
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
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
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  getSummary(@Query() query: CollectionFiltersDto, @CurrentUser() user: AuthUser) {
    return this.collections.getSummary(query, user);
  }

  @Get("finance/collections/cases")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listCases(@Query() query: ListCollectionCasesDto, @CurrentUser() user: AuthUser) {
    return this.collections.listCases(query, query, user);
  }

  @Get("finance/collections/cases/:invoiceId")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  getCaseByInvoiceId(
    @Param() params: CollectionInvoiceParamsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.getCaseByInvoiceId(params.invoiceId, user);
  }

  @Get("finance/collections/cases/:invoiceId/actions")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listActions(
    @Param() params: CollectionInvoiceParamsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.listActions(params.invoiceId, user);
  }

  @Post("finance/collections/cases/:invoiceId/actions")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
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
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listFollowUps(
    @Query() query: CollectionFiltersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.listFollowUps(query, user);
  }
}
