// This file does two things:
// 1. Serves vite+ssg content
// 2. Redirects to earth on any 404s
// Use it for development so you can have just a single entrypoint. Run it with `node local-dev.js`
// NOTE: there might be a better way. See https://github.com/brillout/vite-plugin-ssr/discussions/1012#discussioncomment-6401058

// This file isn't processed by Vite, see https://github.com/brillout/vite-plugin-ssr/issues/562
//  - Consequently, the server needs be manually restarted when changing this file

import express from "express";
import { renderPage } from "vite-plugin-ssr/server";
const httpProxy = require("http-proxy");

const PORT = 8080;
startServer().then(() =>
    console.log(`Server running at http://localhost:${PORT}`)
);

const earthProxy = httpProxy.createProxyServer();
const EARTH = "http://localhost:4568";

async function startServer() {
  const app = express();

  // Vite integration
  // We instantiate Vite's development server and integrate its middleware to our server.
  const vite = await import("vite");
  const viteDevMiddleware = (
      await vite.createServer({
        configFile: "./vite.config.ts",
        server: { middlewareMode: true },
      })
  ).middlewares;
  app.use(viteDevMiddleware);

  // Vite-plugin-ssr middleware. It should always be our last middleware (because it's a
  // catch-all middleware superseding any middleware placed after it).
  app.all("*", async (req, res, next) => {
    const pageContextInit = {
      urlOriginal: req.originalUrl,
    };
    const pageContext = await renderPage(pageContextInit);
    const { httpResponse } = pageContext;
    if (!httpResponse) return next();
    const { body, statusCode, contentType, earlyHints } = httpResponse;

    // our earth redirect. possibly this should be another middleware
    if (statusCode === 404) {
      earthProxy.web(req, res, { target: EARTH });
      return;
    }

    if (res.writeEarlyHints)
      res.writeEarlyHints({
        link: earlyHints.map((e) => e.earlyHintLink),
      });
    res.status(statusCode).type(contentType).send(body);
  });

  app.listen(PORT, "0.0.0.0");
}
