const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const Cart = require("../models/Cart"); // your cart schema
const Product = require("../models/Product"); // your product schema
const { isAuthenticated } = require("../middleware/auth");
const Order = require("../models/Order");
const Profile = require("../models/profile");


router.get("/", async (req, res) => {
  try {
    const products = await Product.find().lean(); // fetch all products

    res.render("user/user", { 
      title: "User Home",
      products // pass products to template
    }); // path: views/user/user.hbs
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).send("Server Error");
  }
});

// --- Login Page ---
router.get("/login", (req, res) => {
  res.render("user/login", { title: "Login" });
});

// --- Handle Login ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.render("user/login", {
        error: "User not found",
        title: "Login",
      });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.render("user/login", {
        error: "Invalid password",
        title: "Login",
      });

    // Save user in session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
    };

    // ✅ Redirect to dashboard page (user.hbs)
    res.redirect("/user");
  } catch (err) {
    console.error(err);
    res.render("user/login", { error: "Something went wrong", title: "Login" });
  }
});
router.get("/user", isAuthenticated, async (req, res) => {
  try {
    // Fetch all products
    const products = await Product.find().lean();

    res.render("user/user", {
      title: "User Home",
      name: req.session.user.name,
      user: req.session.user,
      products,
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).send("Server Error");
  }
});

// --- Signup Page ---
router.get("/signup", (req, res) => {
  res.render("user/signup", { title: "Signup" });
});

// --- Handle Signup ---
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.render("user/signup", {
        error: "Email already exists",
        title: "Signup",
      });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.render("user/login", {
      signupSuccess: "Signup successful! You can now login.",
      title: "Login",
    });
  } catch (err) {
    console.error(err);
    res.render("user/signup", {
      error: "Something went wrong",
      title: "Signup",
    });
  }
});
// --- Logout ---
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.clearCookie("connect.sid");
    res.redirect("/login"); // ✅ matches your mounted route
  });
});


// --- Add product to cart ---
router.post("/cart/add/:productId", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const productId = req.params.productId;

  try {
    // Validate product exists
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).send("Product not found");

    // Check if product is already in cart
    let cartItem = await Cart.findOne({ user: userId, product: productId });

    if (cartItem) {
      cartItem.quantity += 1;
      await cartItem.save();
    } else {
      cartItem = new Cart({
        user: userId,
        product: productId,
        quantity: 1,
      });
      await cartItem.save();
    }

    // Redirect to cart page
    res.redirect("/cart");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding product to cart");
  }
});

router.get("/cart", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const cartItems = await Cart.find({ user: userId })
      .populate("product")
      .lean();

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    res.render("user/cart", {
      title: "Your Cart",
      cartItems,
      totalAmount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading cart");
  }
});
router.post("/cart/update/:cartId", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const cartId = req.params.cartId;
    const { action } = req.body;

    const cartItem = await Cart.findOne({ _id: cartId, user: userId }).populate('product');
    if (!cartItem) return res.status(404).json({ error: 'Cart item not found' });

    if (action === 'increase') cartItem.quantity += 1;
    if (action === 'decrease' && cartItem.quantity > 1) cartItem.quantity -= 1;

    await cartItem.save();

    // Recalculate total
    const cartItems = await Cart.find({ user: userId }).populate('product');
    const totalAmount = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const productTotal = cartItem.product.price * cartItem.quantity;

    res.json({ quantity: cartItem.quantity, totalAmount, productTotal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating cart' });
  }
});
// --- Remove item from cart ---
router.post("/cart/remove/:cartId", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const cartId = req.params.cartId;

    // Delete the cart item if it belongs to the logged-in user
    await Cart.deleteOne({ _id: cartId, user: userId });

    // Redirect back to cart page
    res.redirect("/cart");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error removing item from cart");
  }
});


// --- Map order status to progress percentage ---
function getProgress(status) {
  switch (status) {
    case "Ordered": return 0;
    case "Accepted": return 25;
    case "Shipped": return 50;
    case "Near Hub": return 75;
    case "Delivered": return 100;
    case "Cancelled": return 0;
    default: return 0;
  }
}

// --- Human-readable label ---
function getStatusLabel(status) {
  return status; // For now, same as status
}

// --- Orders Page ---
router.get("/orders", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("products.product")
      .lean();

    const formattedOrders = orders.map(order => {
      const progress = getProgress(order.status);
      return {
        _id: order._id,
        status: order.status,
        statusLabel: getStatusLabel(order.status),
        totalAmount: order.totalAmount,
        createdAt: order.createdAt.toLocaleString(),
        shippingAddress: order.shippingAddress || "",
        paymentMethod: order.paymentMethod || "",
        products: order.products.map(p => ({
          productId: p.product._id,
          name: p.product.name,
          description: p.product.description,
          image: p.product.image || "/placeholder.png",
          price: p.product.price,
          quantity: p.quantity,
        })),
        progress,
        canCancel: order.status === "Ordered",
      };
    });

    res.render("user/orders", { title: "Orders", orders: formattedOrders });
  } catch (err) {
    console.error(err);
    res.send("Error loading orders");
  }
});

// --- Cancel Order Route ---
router.post("/orders/cancel/:id", isAuthenticated, async (req, res) => {
  const orderId = req.params.id;
  const userId = req.session.user.id;

  try {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return res.status(404).send("Order not found");

    order.status = "Cancelled";
    await order.save();

    res.status(200).send("Order cancelled");
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to cancel order");
  }
});




router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).lean(); // convert to plain object
    const profile = await Profile.findOne({ user: user._id }).lean(); // convert to plain object

    res.render("user/profile", {
      title: "My Profile",
      user,
      profile,
    });
  } catch (err) {
    console.error(err);
    res.send("Error loading profile");
  }
});

// --- Handle Address & Profile Update ---
router.post("/profile/edit/address", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;

  // Destructure fields from request body
  const { street, city, state, zip, country, phone, email } = req.body;

  try {
    // Check if profile already exists
    let profile = await Profile.findOne({ user: userId });

    if (profile) {
      // Update existing profile
      profile.address.street = street;
      profile.address.city = city;
      profile.address.state = state;
      profile.address.zip = zip;
      profile.address.country = country;
      profile.phone = phone;
      profile.email = email;

      await profile.save();
    } else {
      // Create new profile
      profile = new Profile({
        user: userId,
        address: { street, city, state, zip, country },
        phone,
        email,
      });
      await profile.save();
    }

    // Update session if needed (optional)
    req.session.profile = profile;

    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.send("Error updating profile/address");
  }
});

// --- View Cart ---
router.get("/cart", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const successMessage = req.query.success ? "Order placed successfully!" : null;

  try {
    const cartItems = await Cart.find({ user: userId })
      .populate("product")
      .lean();

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    res.render("user/cart", {
      title: "Your Cart",
      cartItems,
      totalAmount,
      successMessage,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading cart");
  }
});


// GET Buy Now → Payment Page
router.get("/buy-now/:productId", isAuthenticated, async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.session.user.id; // logged-in user ID

    // Fetch product
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).send("Product not found");

    // Fetch user profile
    const profileData = await Profile.findOne({ user: userId }).lean() || {};

    // Combine address object into a single string
    const shippingAddress = profileData.address
      ? `${profileData.address.street}, ${profileData.address.city}, ${profileData.address.state}, ${profileData.address.zip}, ${profileData.address.country}`
      : "";

    // Flash message (optional)
    const message = req.session.message;
    delete req.session.message;

    // Render payment page
    res.render("user/payment", {
      title: "Payment & Shipping",
      product,
      profile: {
        ...profileData,
        address: shippingAddress,
      },
      message
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});
// POST: Complete Order
router.post("/buy-now/:productId/complete", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const productId = req.params.productId;
    const { quantity, shippingAddress, phone, email, paymentMethod } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).send("Product not found");

    const totalAmount = product.price * quantity;

    // Create new order
    const newOrder = new Order({
      user: userId,
      products: [{ product: productId, quantity }],
      totalAmount,
      status: "Ordered",
      shippingAddress,
      phone,
      email,
      paymentMethod
    });

    await newOrder.save();

    // Flash success message
    req.session.message = "Order placed successfully!";

    // Redirect back to oder page (or order-success page)
   res.redirect("/orders");
  } catch (err) {
    console.error(err);
    req.session.message = "Failed to place order. Try again!";
    res.redirect(`/buy-now/${req.params.productId}`);
  }
});


// GET Payment Page
router.get("/buy-now/:productId/payment", isAuthenticated, async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.session.user.id;

    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).send("Product not found");

    // Get user profile to auto-fill shipping info
    const profile = await Profile.findOne({ user: userId }).lean() || {};

    res.render("user/payment", {
      title: "Payment & Shipping",
      product,
      profile
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// GET: Search page
router.get("/search", isAuthenticated, async (req, res) => {
  try {
    res.render("user/search", {
      title: "Search Products",
      products: [], // initially empty
      query: ""
    });
  } catch (err) {
    console.error(err);
    res.send("Error loading search page");
  }
});// POST: AJAX search
router.post("/search/ajax", isAuthenticated, async (req, res) => {
  const query = req.body.query || "";
  try {
    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } }
      ]
    }).lean();
    
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});// GET /products
router.get("/products", async (req, res) => {
  try {
    const { search, min, max, brand } = req.query;

    let filter = {};

    // ---------- SEARCH ----------
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    // ---------- PRICE RANGE ----------
    if (min || max) {
      filter.price = {};
      if (min) filter.price.$gte = parseInt(min);
      if (max) filter.price.$lte = parseInt(max);
    }

    // ---------- BRAND FILTER (multi-select) ----------
    let selectedBrands = [];
    if (brand) {
      selectedBrands = Array.isArray(brand) ? brand : [brand];
      filter.brand = { $in: selectedBrands };
    }

    // ---------- FETCH PRODUCTS ----------
    const products = await Product.find(filter).lean();

    // ---------- FETCH UNIQUE BRANDS ----------
    const brandsData = await Product.distinct("brand");

    // ---------- RENDER PAGE ----------
    res.render("user/products", {
      products,
      brands: brandsData,
      search,
      min,
      max,
      selectedBrands     // <-- IMPORTANT for checkbox + Top Brands
    });

  } catch (error) {
    console.log("Error loading products:", error);
    res.status(500).send("Something went wrong");
  }
});


module.exports = router;
