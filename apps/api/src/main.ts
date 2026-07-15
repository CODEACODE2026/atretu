import "reflect-metadata";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { AppConfigService } from "./config/app-config.service.js";
import { createOriginCheckMiddleware } from "./security/origin-check.middleware.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  const config = app.get(AppConfigService).values;

  if (config.trustedProxyHops > 0) {
    app.getHttpAdapter().getInstance().set("trust proxy", config.trustedProxyHops);
  }
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts:
        config.nodeEnv === "production"
          ? { maxAge: 15552000, includeSubDomains: true }
          : false,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, origin?: string | false) => void,
    ) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, origin || false);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-setup-token"],
  });
  app.use(createOriginCheckMiddleware(config.corsOrigins));

  await app.listen(config.apiPort);
}

void bootstrap();
