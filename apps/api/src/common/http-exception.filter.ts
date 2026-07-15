import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const multerError = this.getMulterError(exception);
    const status = multerError
      ? multerError.status
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = multerError
      ? multerError.message
      : exception instanceof HttpException
        ? this.getMessage(exception)
        : "Erro interno do servidor";

    if (!(exception instanceof HttpException) && !multerError) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
    });
  }

  private getMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === "string") {
      return response;
    }

    if (
      response &&
      typeof response === "object" &&
      "message" in response &&
      typeof response.message === "string"
    ) {
      return response.message;
    }

    return exception.message;
  }

  private getMulterError(exception: unknown) {
    if (!exception || typeof exception !== "object" || !("code" in exception)) {
      return null;
    }
    const code = String((exception as { code?: unknown }).code);
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: "Arquivo excede o tamanho maximo permitido",
      LIMIT_FILE_COUNT: "Quantidade de arquivos excedida",
      LIMIT_FIELD_COUNT: "Quantidade de campos excedida",
      LIMIT_PART_COUNT: "Multipart possui partes demais",
      LIMIT_FIELD_KEY: "Nome de campo multipart invalido",
      LIMIT_FIELD_VALUE: "Campo multipart excede o tamanho permitido",
      LIMIT_UNEXPECTED_FILE: "Campo de arquivo inesperado",
    };
    const message = messages[code];
    if (!message) {
      return null;
    }
    return {
      status:
        code === "LIMIT_FILE_SIZE"
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.BAD_REQUEST,
      message,
    };
  }
}
