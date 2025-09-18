#!/usr/bin/env node

const { createRequestHandler } = require("@remix-run/node");
const path = require("path");
const express = require("express");

const app = express();

// Serve static files from build/client
app.use(express.static(path.join(__dirname, "build", "client"), {
  immutable: true,
  maxAge: "1y",
}));

// Handle Remix requests
app.all("*", createRequestHandler({
  build: require("./build/server/index.js"),
}));

const port = process.env.PORT || 5173;
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  console.log(`🚀 Server ready at http://${host}:${port}`);
});