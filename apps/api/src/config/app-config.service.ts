import { Injectable } from "@nestjs/common";
import { loadEnvConfig, type EnvConfig } from "./env.js";

@Injectable()
export class AppConfigService {
  private readonly config: EnvConfig = loadEnvConfig();

  get values(): EnvConfig {
    return this.config;
  }
}
