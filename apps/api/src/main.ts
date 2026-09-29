import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Wide open (undefined -> allow any origin) if CORS_ALLOWED_ORIGINS isn't
  // set, which is fine for local dev and for as long as `api` stays
  // internal-only behind web's nginx proxy. Once `api` gets its own public
  // domain (needed for the mobile app, which can't use that same-origin
  // proxy trick), set this explicitly to the web app's origin(s) —
  // comma-separated. Native mobile HTTP clients aren't CORS-restricted at
  // all (that's a browser-only mechanism), so they're unaffected either way
  // — this only ever gates browser-based callers.
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",").map((o) => o.trim());
  app.enableCors({ origin: allowedOrigins ?? true });

  const config = new DocumentBuilder()
    .setTitle("saas-erp API")
    .setDescription("Multi-tenant ERP platform API. See docs/architecture/ARCHITECTURE.md.")
    .setVersion("0.1")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`saas-erp API listening on :${port} (Swagger at /docs)`);
}

bootstrap();
