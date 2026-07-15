import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  InvalidateStudentCardDto,
  IssueStudentCardDto,
  ListStudentCardsDto,
  StudentCardPdfDto,
  StudentCardPreviewDto,
} from "./dto/student-cards.dto.js";
import { StudentCardPdfService } from "./student-card-pdf.service.js";
import { StudentCardsService } from "./student-cards.service.js";

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class StudentCardsController {
  constructor(
    @Inject(StudentCardsService)
    private readonly studentCards: StudentCardsService,
    @Inject(StudentCardPdfService)
    private readonly studentCardPdf: StudentCardPdfService,
  ) {}

  @Get("student-cards")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listStudentCards(@Query() query: ListStudentCardsDto) {
    return this.studentCards.listStudentCards(query);
  }

  @Get("students/:studentId/cards")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listStudentCardsForStudent(@Param("studentId") studentId: string) {
    return this.studentCards.listStudentCardsForStudent(studentId);
  }

  @Get("student-cards/:cardId/pdf")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  async getStudentCardPdf(
    @Param("cardId") cardId: string,
    @Query() query: StudentCardPdfDto,
    @Res() response: Response,
  ) {
    const disposition = query.disposition ?? "inline";
    if (disposition !== "inline" && disposition !== "attachment") {
      throw new BadRequestException("Disposicao do PDF invalida");
    }
    const pdf = await this.studentCardPdf.generate(cardId, disposition);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Length", String(pdf.sizeBytes));
    response.setHeader(
      "Content-Disposition",
      `${pdf.disposition}; filename=\"${pdf.filename}\"`,
    );
    response.setHeader("Cache-Control", "no-store, private");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.send(pdf.bytes);
  }

  @Get("students/:studentId/card-preview")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  previewStudentCard(
    @Param("studentId") studentId: string,
    @Query() query: StudentCardPreviewDto,
  ) {
    return this.studentCards.previewStudentCard(studentId, query);
  }

  @Post("students/:studentId/cards")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  issueStudentCard(
    @Param("studentId") studentId: string,
    @Body() body: IssueStudentCardDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentCards.issueStudentCard(studentId, body, user.id);
  }

  @Post("students/:studentId/cards/:cardId/invalidate")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  invalidateStudentCard(
    @Param("studentId") studentId: string,
    @Param("cardId") cardId: string,
    @Body() body: InvalidateStudentCardDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentCards.invalidateStudentCard(
      studentId,
      cardId,
      body,
      user.id,
    );
  }
}
