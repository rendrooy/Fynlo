import cors from "cors";
import express from "express";

import { serverConfig } from "./config";
import { errorMiddleware } from "./middleware/error.middleware";
import routes from "./routes";

const app: express.Express = express();

app.disable("x-powered-by");
app.set("trust proxy", serverConfig.trustProxy);
app.use(cors({ credentials: true, origin: serverConfig.corsOrigins }));
app.use(
  express.json({
    // A year of statements can reach 5,000 rows at about 300 bytes each.
    limit: "2mb",
  }),
);

app.use("/v1", routes);

app.use((_request, response) => {
  response.status(404).json({ message: "Route not found", status: 404 });
});

app.use(errorMiddleware);

export default app;
