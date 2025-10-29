# ECOMMERCE-ECARTHHUB
Full-featured e-commerce web application built using Node.js, Express, MongoDB, and Handlebars (HBS)
# 🛒 E-Commerce ECARThub

> A secure, full-stack e-commerce platform built using **Node.js**, **Express**, **MongoDB**, and **Handlebars (HBS)** with modular architecture for users, sellers— featuring real-time analytics, authentication, and integrated cybersecurity protection.

---

## 🚀 Features

### 👤 User Module
- Signup/Login with JWT & Session Authentication  
- Product browsing, filtering, and searching  
- Add to Cart, Buy Now, and Payment Flow  
- Order tracking, edit/cancel orders  
- Forgot Password & Reset via Email  
- Profile and Settings management  

### 🛍️ Seller Module
- Seller login & registration  
- Add/Edit/Delete products  
- Manage stock and orders  
- View performance metrics  
- Forgot/Reset password page  



## 🧱 Security Enhancements

ECARThub integrates cybersecurity measures similar to a **web application firewall** to protect against modern web attacks.

### 🔰 Firewall & Middleware Protection
- `helmet` for HTTP header security  
- `cors` for origin-based access control  
- `hpp` to prevent HTTP parameter pollution  
- `express-rate-limit` for request throttling  
- `xss-clean` for input sanitization against XSS  
- `express-mongo-sanitize` for NoSQL injection defense  

### 🚫 Brute-Force & DDoS Mitigation
- Login endpoints protected with **per-route rate-limiting**
- Temporary lockout after failed login attempts  
- IP-based throttling and request logging  

### 🧬 Data & Payload Validation
- Input validation using **Joi** and `validator`  
- Payload size limiting (10kb max)  
- Malicious data scanning before saving to MongoDB  

### ⚡ Injection & Exploit Prevention
- Blocks **SQL/NoSQL/XML injection attempts**  
- Sanitized requests and safe query construction  
- Automatic rejection of suspicious payloads  

### 💉 XSS & CSRF Protection
- **xss-clean** strips malicious scripts  
- **CSRF tokens** on form-based submissions  
- Handlebars templates use escaped output by default  

### 🛡️ Logging & Monitoring
- Integrated with **winston** for logging
- Audit trails for failed login attempts and suspicious activity  
- Potential integration with intrusion detection or SIEM tools  

---

## ⚙️ Tech Stack

| Component | Technology |
|------------|-------------|
| Backend | Node.js, Express |
| Frontend | Handlebars (HBS), HTML, CSS, JS |
| Database | MongoDB (Mongoose) |
| Authentication | JWT, bcrypt, express-session |
| Real-Time | Socket.IO |
---

