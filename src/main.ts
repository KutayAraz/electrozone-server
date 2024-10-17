import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import * as cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from "./common/errors/global-exception-filter";
import * as session from "express-session";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // app.use(
  //   session({
  //     secret: process.env.SESSION_SECRET,
  //     resave: false,
  //     saveUninitialized: true, // Changed to true
  //     cookie: { 
  //       maxAge: 3600000, // 1 hour
  //       httpOnly: true,
  //       secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
  //       sameSite: 'strict' // Helps prevent CSRF attacks
  //     },
  //     name: 'session_id' // Custom name for the session ID cookie
  //   }),
  // );
  
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
