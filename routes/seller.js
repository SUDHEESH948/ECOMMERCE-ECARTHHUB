const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Product = require("../models/Product");
const { ensureSeller } = require("../middleware/sauth"); // middleware to check seller login
const Seller = require("../models/Seller");
const fs = require("fs");
const sharp = require("sharp");
const Order = require("../models/Order");
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
require('dotenv').config();



router.get("/", (req, res) => {
  res.redirect("/seller/login");
});
// Dashboard route
// GET: Seller Dashboard
router.get("/dashboard", ensureSeller, async (req, res) => {
  try {
    const sellerId = req.user._id;

    // Total products
    const totalProducts = await Product.countDocuments({ seller: sellerId });

    // Orders
    const orders = await Order.find({ "products.product": { $exists: true } });

    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === "Ordered").length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Chart data example
    const salesData = {
      labels: orders.map(o => new Date(o.createdAt).toLocaleDateString()),
      values: orders.map(o => o.totalAmount),
    };

    const ordersData = {
      labels: orders.map(o => new Date(o.createdAt).toLocaleDateString()),
      values: orders.map(o => 1), // each order = 1
    };

    res.render("seller/dashboard", {
      seller: req.session.seller,
      totalProducts,
      totalOrders,
      pendingOrders,
      totalRevenue,
      salesData,
      ordersData,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/seller/login");
  }
});

// --- GET: Login & Signup page ---
router.get("/login", (req, res) => {
  res.render("seller/login", { loginError: null, signupError: null });
});

// --- POST: Seller Signup ---
router.post("/signup", async (req, res) => {
  const { name, email, contactNumber, address, password, confirmPassword } =
    req.body;
  try {
    if (password !== confirmPassword) {
      return res.render("seller/login", {
        signupError: "Passwords do not match",
        loginError: null,
      });
    }

    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.render("seller/login", {
        signupError: "Email already exists",
        loginError: null,
      });
    }

    const seller = new Seller({
      name,
      email,
      contactNumber,
      address,
      password,
    });
    await seller.save();

    // After signup, redirect to login
    res.redirect("/seller/login");
  } catch (err) {
    console.error(err);
    res.render("seller/login", {
      signupError: "Something went wrong",
      loginError: null,
    });
  }
});

// --- POST: Seller Login ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const seller = await Seller.findOne({ email });
    if (!seller)
      return res.render("seller/login", {
        loginError: "Invalid email or password",
        signupError: null,
      });

    const isMatch = await seller.matchPassword(password);
    if (!isMatch)
      return res.render("seller/login", {
        loginError: "Invalid email or password",
        signupError: null,
      });

    // Set session
    req.session.seller = {
      id: seller._id,
      name: seller.name,
      email: seller.email,
      contactNumber: seller.contactNumber,
      address: seller.address,
    };

    // Redirect to dashboard
    res.redirect("/seller/dashboard");
  } catch (err) {
    console.error(err);
    res.render("seller/login", {
      loginError: "Something went wrong",
      signupError: null,
    });
  }
});

// --- GET: Logout ---
router.get("/logout", ensureSeller, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.redirect("/seller/dashboard");
    }
    res.clearCookie("connect.sid");
    res.redirect("/seller/login");
  });
});

// GET Add Product Page
router.get("/add-product", ensureSeller, (req, res) => {
  res.render("seller/add-product", { seller: req.user });
});

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST Add Product (Multiple Images + Resize)
router.post(
  "/add-product",
  ensureSeller,
  upload.array("images", 5),
  async (req, res) => {
    try {
      const { name, category, subcategory, price, stock, description } =
        req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).send("At least one image is required");
      }

      const originalFolder = "public/pimage";
      const resizedFolder = "public/rimage";

      if (!fs.existsSync(originalFolder)) fs.mkdirSync(originalFolder);
      if (!fs.existsSync(resizedFolder)) fs.mkdirSync(resizedFolder);

      const images = [];
      const resizedImages = [];

      for (const file of req.files) {
        const uniqueName =
          Date.now() +
          "-" +
          Math.round(Math.random() * 1e9) +
          path.extname(file.originalname);

        fs.writeFileSync(path.join(originalFolder, uniqueName), file.buffer);

        await sharp(file.buffer)
          .resize(286, 180, { fit: "cover" })
          .toFile(path.join(resizedFolder, uniqueName));

        images.push(uniqueName);
        resizedImages.push(uniqueName);
      }

      const newProduct = new Product({
        name,
        category,
        subcategory,
        price,
        stock,
        description,
        images,
        resizedImages,
        seller: req.user._id,
      });

      await newProduct.save();
      req.session.message = {
      type: "success",
      content: "Product added successfully!",
    };
      res.redirect("/seller/products");
    } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
    }
  },
);


// GET: Show seller's products
router.get("/products", ensureSeller, async (req, res) => {
  try {
    console.log("Seller ID:", req.user._id); // debug
    const products = await Product.find({ seller: req.user._id }).lean(); // use .lean() for Handlebars // debug
    res.render("seller/products", { products });
  } catch (err) {
    console.error(err);
    res.send("Server Error");
  }
});

// GET: Edit product page
router.get("/edit-product/:id", ensureSeller, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, seller: req.user._id }).lean();
    if (!product) return res.redirect("/seller/products");
    res.render("seller/editProduct", { product });
  } catch (err) {
    console.error(err);
    res.redirect("/seller/products");
  }
});

// POST: Delete product
router.post("/delete-product/:id", ensureSeller, async (req, res) => {
  try {
    await Product.deleteOne({ _id: req.params.id, seller: req.user._id });
    res.redirect("/seller/products");
  } catch (err) {
    console.error(err);
    res.redirect("/seller/products");
  }
});


// GET: Seller Orders
router.get("/orders", ensureSeller, async (req, res) => {
  try {
    const sellerId = req.user._id;

    const orders = await Order.find({
      "products.product": {
        $in: await Product.find({ seller: sellerId }).distinct("_id")
      }
    })
      .populate("user", "name email")
      .populate("products.product", "name price");

    const message = req.session.message;
    delete req.session.message;

    res.render("seller/orders", { 
      orders: orders.map(o => o.toObject()), 
      message 
    });

  } catch (err) {
    console.error(err);
    res.send("Server Error");
  }
});

// POST: Update Order Status
router.post("/update-order/:id", ensureSeller, async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId).populate("products.product");
    if (!order) {
      req.session.message = { type: "danger", content: "Order not found" };
      return res.redirect("/seller/orders");
    }

    // Check if seller owns at least one product in this order
    const sellerProductIds = order.products.map(p => p.product.seller.toString());
    if (!sellerProductIds.includes(req.user._id.toString())) {
      req.session.message = { type: "danger", content: "You cannot update this order" };
      return res.redirect("/seller/orders");
    }

    // Update status
    order.status = status;
    await order.save();

    req.session.message = { type: "success", content: `Order status updated to ${status}` };
    res.redirect("/seller/orders");
  } catch (err) {
    console.error(err);
    req.session.message = { type: "danger", content: "Failed to update order" };
    res.redirect("/seller/orders");
  }
});

// ---------- MULTER SETUP ----------
const logoStorage = multer.diskStorage({
  destination: function(req, file, cb){
    cb(null, 'public/uploads/');
  },
  filename: function(req, file, cb){
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const sellerUpload = multer({ storage: logoStorage });
// ---------- GET Seller Settings ----------
router.get("/settings", ensureSeller, async (req, res) => {
  try {
    const seller = req.seller; // get seller from middleware
    if (!seller) return res.send("Seller not found");

    res.render("seller/settings", {
      title: "Seller Settings",
      seller: seller.toObject(), // convert Mongoose doc to plain object
      layout: false
    });
  } catch (err) {
    console.error("Error fetching seller settings:", err);
    res.status(500).send("Server Error");
  }
});

// ---------- POST Edit Seller ----------
router.post("/edit", ensureSeller, sellerUpload.single("logo"), async (req, res) => {
  try {
    const seller = req.seller;
    if (!seller) return res.status(404).send("Seller not found");

    const { name, email, contactNumber, address } = req.body;

    // Update seller details
    seller.name = name.trim();
    seller.email = email.trim().toLowerCase();
    seller.contactNumber = contactNumber.trim();
    seller.address = address.trim();

    // Handle logo upload
    if (req.file) {
      // Delete old logo if exists
      if (seller.logo) {
        const oldPath = path.join(__dirname, "..", "public", "uploads", seller.logo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      seller.logo = req.file.filename;
    }

    await seller.save();
    res.redirect("/seller/settings");
  } catch (err) {
    console.error("Error updating seller settings:", err);
    res.status(500).send("Server Error");
  }
});



// --- Create Nodemailer transporter ---
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// --- Render forgot password page ---
router.get('/forgot-password', (req, res) => {
  res.render('seller/forgot-password', { title: 'Forgot Password' });
});

// --- Handle forgot password form ---
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.render('seller/forgot-password', { error: 'Email not found' });
    }

    // Create JWT token for reset (valid 15 mins)
    const token = jwt.sign(
      { sellerId: seller._id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const resetLink = `${process.env.BASE_URL}/seller/reset-password/${token}`;

    // Send email
    await transporter.sendMail({
      from: `"EcartHub" <${process.env.EMAIL_USER}>`,
      to: seller.email,
      subject: 'Password Reset Request',
      html: `
        <p>Hello ${seller.name},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
      `
    });

    res.render('seller/forgot-password', { success: 'Reset link sent to your email.' });
  } catch (err) {
    console.error(err);
    res.render('seller/forgot-password', { error: 'Something went wrong' });
  }
});

// --- Render reset password page ---
router.get('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    res.render('seller/reset-password', { token, title: 'Reset Password' });
  } catch (err) {
    res.send('Invalid or expired token');
  }
});

// --- Handle reset password form ---
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.render('seller/reset-password', { token, error: "Passwords don't match" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const seller = await Seller.findById(payload.sellerId);
    if (!seller) return res.send('Seller not found');

    // Hash new password
    const hashed = await bcrypt.hash(password, 10);
    seller.password = hashed;
    await seller.save();

    res.render('seller/reset-password', { success: 'Password reset successful. You can now login.' });
  } catch (err) {
    console.error(err);
    res.send('Invalid or expired token');
  }
});
module.exports = router;
