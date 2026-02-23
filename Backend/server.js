/** @format */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const morgan = require("morgan");
const winston = require("winston");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Database connection

mongoose
  .connect(
    process.env.MONGO_URI || "mongodb://localhost:27017/your-database-name",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// WinstonLogger setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  ],
});

app.use(
  morgan(
    ":method :url :status :response-time ms - :res ms - res[content-length]",
  ),
);
