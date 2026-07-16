import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppConfigService } from "./app-config.service.js";

export const API_ENV_FILE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.env",
);

export function shouldIgnoreApiEnvFile(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "production";
}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: API_ENV_FILE_PATH,
      ignoreEnvFile: shouldIgnoreApiEnvFile(),
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
