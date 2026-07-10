import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { BusAssignmentsService } from "./bus-assignments.service.js";
import {
  AssignBusDto,
  ListBusAssignmentsDto,
  ReleaseBusDto,
  SwitchBusDto,
} from "./dto/bus-assignments.dto.js";

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
@Controller()
export class BusAssignmentsController {
  constructor(
    @Inject(BusAssignmentsService)
    private readonly busAssignments: BusAssignmentsService,
  ) {}

  @Get("buses/:id/assignments")
  listBusAssignments(
    @Param("id") id: string,
    @Query() query: ListBusAssignmentsDto,
  ) {
    return this.busAssignments.listBusAssignments(id, query);
  }

  @Get("enrollments/:enrollmentId/bus-assignment")
  getCurrentAssignment(@Param("enrollmentId") enrollmentId: string) {
    return this.busAssignments.getCurrentAssignment(enrollmentId);
  }

  @Post("enrollments/:enrollmentId/bus-assignment")
  assignBus(
    @Param("enrollmentId") enrollmentId: string,
    @Body() body: AssignBusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.busAssignments.assignBus(
      enrollmentId,
      body.busId,
      user.id,
      body.note,
    );
  }

  @Post("enrollments/:enrollmentId/bus-assignment/release")
  releaseBus(
    @Param("enrollmentId") enrollmentId: string,
    @Body() body: ReleaseBusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.busAssignments.releaseBus(enrollmentId, user.id, body.note);
  }

  @Post("enrollments/:enrollmentId/bus-assignment/switch")
  switchBus(
    @Param("enrollmentId") enrollmentId: string,
    @Body() body: SwitchBusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.busAssignments.switchBus(
      enrollmentId,
      body.newBusId,
      user.id,
      body.note,
    );
  }

  @Get("enrollments/:enrollmentId/bus-assignment-events")
  listEnrollmentEvents(@Param("enrollmentId") enrollmentId: string) {
    return this.busAssignments.listEnrollmentEvents(enrollmentId);
  }
}
