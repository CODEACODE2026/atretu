import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException
        ? this.getMessage(exception)
        : "Erro interno do servidor";

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
}
