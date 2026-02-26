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
    process.env.MONGO_URI || "mongodb://localhost:27017/StudentManagementApp  ",
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
  morgan(":method :url :status :res[content-length] - :response-time ms"),
);

// API middleware logger
const apiLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      params: req.params,
      query: req.query,
      body: req.method !== "GET" ? req.body : undefined,
    });
  });
  next();
};

app.use(apiLogger);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    body: req.method !== "GET" ? req.body : undefined,
  });
  res.status(500).json({ error: "Internal Server Error" });
});

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    course: {
      type: String,
      required: true,
    },
    enrollmentDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true },
);

const Student = mongoose.model("Student", studentSchema);

const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true },
);

const Course = mongoose.model("Course", courseSchema);

// Course Routes
app.get("/api/courses", async (req, res) => {
  try {
    const courses = await Course.find().sort({ name: 1 });
    logger.info(`Retrieved ${courses.length} courses successfully`);
    res.json(courses);
  } catch (error) {
    logger.error("Error fetching courses:", error);
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/courses", async (req, res) => {
  try {
    const course = new Course(req.body);
    const savedCourse = await course.save();
    logger.info("Error creating course:", {
      courseId: savedCourse._id,
      name: savedCourse.name,
    });
    res.status(201).json(savedCourse);
  } catch (error) {
    logger.error("Error creating course:", error);
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/courses/:id", async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    logger.info("Course updated successfully:", {
      courseId: course._id,
      name: course.name,
    });
    res.json(course);
  } catch (error) {
    logger.error("Error updating course:", error);
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/courses/:id", async (req, res) => {
  try {
    const enrolledStudents = await Student.countDocuments({
      course: req.params.id,
    });
    if (enrolledStudents > 0) {
      logger.warn("Course is still enrolled by students", {
        courseId: req.params.id,
        enrolledStudents,
      });
      return res
        .status(400)
        .json({ message: "Cannot delete course with enrolled students" });
    }
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      logger.warn("Course not found for deletion", {
        courseId: req.params.id,
      });
      return res.status(404).json({ message: "Course not found" });
    }
    logger.info("Course deleted successfully:", {
      courseId: course._id,
      name: course.name,
    });
    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    logger.error("Error deleting course:", error);
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/students", async (req, res) => {
  try {
    const course = await Course.findById(req.params.Id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json(course);
  } catch (error) {
    logger.error("Error fetching course:", error);
    res.status(500).json({ message: error.message });
  }
});

// Student routes
app.get("/api/students", async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    logger.info(`Retrieved ${students.length} students successfully`);
    res.json(students);
  } catch (error) {
    logger.error("Error fetching students:", error);
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/students", async (req, res) => {
  try {
    const student = new Student(req.body);
    const savedStudent = await student.save();
    logger.info("Student created successfully:", {
      studentId: savedStudent._id,
      name: savedStudent.name,
      course: savedStudent.course,
    });
    res.status(201).json(savedStudent);
  } catch (error) {
    logger.error("Error creating student:", error);
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!student) {
      logger.warn("Student not found for update", {
        studentId: req.params.id,
      });
      return res.status(404).json({ message: "Student not found" });
    }
    logger.info("Student updated successfully:", {
      studentId: student._id,
      name: student.name,
      course: student.course,
    });
    res.json(student);
  } catch (error) {
    logger.error("Error updating student:", error);
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      logger.warn("Student not found for deletion", {
        studentId: req.params.id,
      });
      return res.status(404).json({ message: "Student not found" });
    }
    logger.info("Student deleted successfully:", {
      studentId: student._id,
      name: student.name,
      course: student.course,
    });
    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    logger.error("Error deleting student:", error);
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/students/:id", async (req, res) => {
  try {
    const searchterm = req.query.q;
    logger.info("Searching for students with term:", { searchterm });
    const students = await Student.find({
      $or: [
        { name: { $regex: searchterm, $options: "i" } },
        { course: { $regex: searchterm, $options: "i" } },
        { email: { $regex: searchterm, $options: "i" } },
      ],
    });
    logger.info("Student search complete", {
      searchterm,
      resultsCount: students.length,
    });
    res.json(students);
  } catch (error) {
    logger.error("Error searching for students:", error);
    res.status(500).json({ message: error.message });
  }
});

// Dashboard
app.get(`/api/dashboard/stats`, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    logger.info("Dashboard stats retrieved successfully", { stats });
    res.json(stats);
  } catch (error) {
    logger.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: error.message });
  }
});

// Helper function to get dashboard stats
async function getDashboardStats() {
  const totalStudents = await Student.countDocuments();
  const totalCourses = await Course.countDocuments();
  const activeStudents = await Student.countDocuments({ status: "active" });
  const activeCourses = await Course.countDocuments({ status: "active" });
  const graduates = await Student.countDocuments({ status: "inactive" });
  const courseCounts = await Student.aggregate([
    { $group: { _id: "$course", count: { $sum: 1 } } },
  ]);

  return {
    totalStudents,
    totalCourses,
    activeStudents,
    activeCourses,
    graduates,
    courseCounts,
    successRate:
      totalStudents > 0 ? Math.round((graduates / totalStudents) * 100) : 0,
  };
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date(),
    uptime: process.uptime(),
    envirenment: process.env.NODE_ENV || "development",
  });
});

// Database connection health check
app.get("/health/detailed", async (req, res) => {
  try {
    // Check MongoDB connection
    const dbstatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";

    // System metrics
    const systemInfo = {
      memory: {
        total: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
        used: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
        unit: "MB",
      },
      uptime: {
        seconds: Math.round(process.uptime()),
        formatted: formatUptime(process.uptime()),
      },
      nodeVersion: process.version,
      platform: process.platform,
    };

    // Response Object
    const healthCheck = {
      status: "OK",
      timestamp: new Date(),
      database: {
        status: dbstatus,
        name: "MongoDB",
        version: mongoose.version,
      },
      system: systemInfo,
      envirenment: process.env.NODE_ENV || "development",
    };

    res.status(200).json(healthCheck);
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      timestamp: new Date(),
      message: "Health check failed",
    });
  }
});

app.get("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.json(student);
  } catch (error) {
    logger.error("Error fetching student:", error);
    res.status(500).json({ message: error.message });
  }
});

// Helper to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);
  return parts.join(" ");
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
