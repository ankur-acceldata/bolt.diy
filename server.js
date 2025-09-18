#!/usr/bin/env node

import { createRequestHandler } from "@remix-run/node";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Serve static files from build/client
app.use(express.static(join(__dirname, "build", "client"), {
  immutable: true,
  maxAge: "1y",
}));

// Handle Remix requests
const build = await import("./build/server/index.js");
app.all("*", createRequestHandler({
  build: build,
}));

const port = process.env.PORT || 5173;
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  console.log(`🚀 Server ready at http://${host}:${port}`);
});