import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import * as cookieParser from 'cookie-parser';
import helmet from "helmet";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    frameguard: false,  // Disables the `X-Frame-Options` header.
  }));
  app.useGlobalPipes(new ValidationPipe());

  app.enableCors({
    origin: `${process.env.FRONTEND_URL}`,
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
