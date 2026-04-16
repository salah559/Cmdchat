import express, { type Express } from "express";
import cors from "cors";
import type { IncomingMessage, ServerResponse } from "http";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// pino-http CJS/ESM interop: cast to avoid call signature mismatch in strict TS
const createHttpLogger = pinoHttp as unknown as (opts: {
  logger: typeof logger;
  serializers: {
    req: (req: IncomingMessage & { id?: string }) => object;
    res: (res: ServerResponse) => object;
  };
}) => express.RequestHandler;

app.use(
  createHttpLogger({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: (req.url ?? "").split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
