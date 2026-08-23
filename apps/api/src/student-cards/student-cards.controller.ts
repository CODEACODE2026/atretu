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
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OperationalPermission } from "../auth/operational-permissions.js";
import type { AuthUser } from "../users/users.service.js";
import {
  InvalidateStudentCardDto,
  ListPendingStudentCardsDto,
  IssueStudentCardDto,
  ListStudentCardsDto,
  PrintStudentCardsBatchDto,
  StudentCardPdfDto,
  StudentCardPreviewDto,
} from "./dto/student-cards.dto.js";
import { StudentCardPdfService } from "./student-card-pdf.service.js";
import { StudentCardsService } from "./student-cards.service.js";

@UseGuards(AuthGuard, OperationalPermissionGuard)
@Controller()
export class StudentCardsController {
  constructor(
    @Inject(StudentCardsService)
    private readonly studentCards: StudentCardsService,
    @Inject(StudentCardPdfService)
    private readonly studentCardPdf: StudentCardPdfService,
  ) {}

  @Get("student-cards")
  @OperationalPermission("studentCards.view", "reports.view")
  listStudentCards(
    @Query() query: ListStudentCardsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentCards.listStudentCards(query, user);
  }

  @Get("students/:studentId/cards")
  @OperationalPermission("studentCards.view")
  listStudentCardsForStudent(
    @Param("studentId") studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentCards.listStudentCardsForStudent(studentId, user);
  }

  @Get("student-cards/pending")
  @OperationalPermission("studentCards.view", "reports.view")
  listPendingStudentCards(
    @Query() query: ListPendingStudentCardsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentCards.listPendingStudentCards(query, user);
  }

  @Get("student-cards/:cardId/pdf")
  @OperationalPermission("studentCards.view")
  async getStudentCardPdf(
    @Param("cardId") cardId: string,
    @Query() query: StudentCardPdfDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const disposition = query.disposition ?? "inline";
    if (disposition !== "inline" && disposition !== "attachment") {
      throw new BadRequestException("Disposicao do PDF invalida");
    }
    const pdf = await this.studentCardPdf.generate(cardId, disposition, user);
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

  @Post("student-cards/print-batch")
  @OperationalPermission("studentCards.issue")
  async printStudentCardsBatch(
    @Body() body: PrintStudentCardsBatchDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const pdf = await this.studentCardPdf.generateBatch(body, user);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Length", String(pdf.sizeBytes));
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdf.filename}"`,
    );
    response.setHeader("Cache-Control", "no-store, private");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.send(pdf.bytes);
  }

  @Get("students/:studentId/card-preview")
  @OperationalPermission("studentCards.view")
  previewStudentCard(
    @Param("studentId") studentId: string,
    @Query() query: StudentCardPreviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentCards.previewStudentCard(studentId, query, user);
  }

  @Post("students/:studentId/cards")
  @OperationalPermission("studentCards.issue")
  issueStudentCard(
    @Param("studentId") studentId: string,
    @Body() body: IssueStudentCardDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentCards.issueStudentCard(studentId, body, user.id, user);
  }

  @Post("students/:studentId/cards/:cardId/invalidate")
  @OperationalPermission("studentCards.invalidate")
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
      user,
    );
  }
}
