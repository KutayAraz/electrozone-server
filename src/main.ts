import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import * as cookieParser from "cookie-parser";
import { GlobalExceptionFilter } from "./common/errors/global-exception-filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Hosting platforms terminate TLS at their proxy and forward plain HTTP.
  // Without this, express-session sees an insecure connection and silently
  // refuses to set the `Secure` session cookie the frontend depends on.
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
