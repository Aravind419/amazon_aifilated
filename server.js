const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

const Product = require("./models/Product");
const AdminUser = require("./models/AdminUser");

const app = express();

// Basic security and performance middlewares
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan("dev"));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret-session",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage for local uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || ".jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

// Views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Mongo connection
const mongoUri =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/amazon-affiliate-links";
mongoose
  .connect(mongoUri, { autoIndex: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Seed admin if not exists
async function ensureAdminSeed() {
  const email = "dineshrajan-amazon@gmail.com";
  const plainPassword = "affilatedlinks";
  const exists = await AdminUser.findOne({ email }).lean();
  if (!exists) {
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    await AdminUser.create({ email, passwordHash });
    console.log("Seeded default admin user");
  }
}
ensureAdminSeed().catch((e) => console.error("Failed admin seed", e));

// Auth middlewares
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect("/login");
}

// Routes
app.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const filter = q
      ? {
          $or: [
            { title: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
          ],
        }
      : {};
    const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
    res.render("index", { products, q });
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to load products");
  }
});

// Realtime search API
app.get("/api/products", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const filter = q
      ? {
          $or: [
            { title: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
          ],
        }
      : {};
    const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ products });
  } catch (e) {
    console.error(e);
    res.status(500).json({ products: [] });
  }
});

app.get("/admin", requireAuth, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.render("admin", { products });
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to load admin panel");
  }
});

app.post(
  "/admin/products",
  requireAuth,
  upload.single("imageFile"),
  async (req, res) => {
    try {
      const { title, imageUrl, affiliateUrl, price, description } = req.body;
      if (!title || (!imageUrl && !req.file) || !affiliateUrl) {
        return res.status(400).send("Missing required fields");
      }

      const finalImageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : imageUrl;

      await Product.create({
        title,
        imageUrl: finalImageUrl,
        affiliateUrl,
        price: price ? Number(price) : undefined,
        description,
      });

      res.redirect("/admin");
    } catch (error) {
      console.error(error);
      res.status(500).send("Failed to add product");
    }
  }
);

app.delete("/admin/products/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete product" });
  }
});

// Auth routes
app.get("/login", (req, res) => {
  if (req.session && req.session.userId) return res.redirect("/admin");
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await AdminUser.findOne({ email }).exec();
    if (!user)
      return res.status(401).render("login", { error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(401).render("login", { error: "Invalid credentials" });
    req.session.userId = user._id.toString();
    res.redirect("/admin");
  } catch (e) {
    console.error(e);
    res.status(500).render("login", { error: "Something went wrong" });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
