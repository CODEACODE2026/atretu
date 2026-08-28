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
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../users/users.service.js";
import { BusAssignmentsService } from "./bus-assignments.service.js";
import {
  AssignBusDto,
  ListBusAssignmentsDto,
  ReleaseBusDto,
  SwitchBusDto,
} from "./dto/bus-assignments.dto.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OperationalPermission } from "../auth/operational-permissions.js";

@UseGuards(AuthGuard, OperationalPermissionGuard)
@Controller()
export class BusAssignmentsController {
  constructor(
    @Inject(BusAssignmentsService)
    private readonly busAssignments: BusAssignmentsService,
  ) {}

  @Get("buses/:id/assignments")
  @OperationalPermission("baseRecords.view", "reports.view")
  listBusAssignments(
    @Param("id") id: string,
    @Query() query: ListBusAssignmentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.busAssignments.listBusAssignments(id, query, user);
  }

  @Get("enrollments/:enrollmentId/bus-assignment")
  @OperationalPermission("students.view")
  getCurrentAssignment(
    @Param("enrollmentId") enrollmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.busAssignments.getCurrentAssignment(enrollmentId, user);
  }

  @Post("enrollments/:enrollmentId/bus-assignment")
  @OperationalPermission("students.update")
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
      user,
    );
  }

  @Post("enrollments/:enrollmentId/bus-assignment/release")
  @OperationalPermission("students.update")
  releaseBus(
    @Param("enrollmentId") enrollmentId: string,
    @Body() body: ReleaseBusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.busAssignments.releaseBus(enrollmentId, user.id, body.note, user);
  }

  @Post("enrollments/:enrollmentId/bus-assignment/switch")
  @OperationalPermission("students.update")
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
      user,
    );
  }

  @Get("enrollments/:enrollmentId/bus-assignment-events")
  @OperationalPermission("students.view")
  listEnrollmentEvents(
    @Param("enrollmentId") enrollmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.busAssignments.listEnrollmentEvents(enrollmentId, user);
  }
}
