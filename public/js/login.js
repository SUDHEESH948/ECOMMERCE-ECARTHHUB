const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginMessage = document.getElementById("login-message");
const signupMessage = document.getElementById("signup-message");
const signupLink = document.getElementById("signup-link");
const loginLink = document.getElementById("login-link");
const loginBox = document.getElementById("login-box");
const signupBox = document.getElementById("signup-box");

// Toggle forms
signupLink.addEventListener("click", (e) => {
  e.preventDefault();
  loginBox.style.display = "none";
  signupBox.style.display = "block";
  loginMessage.textContent = "";
  signupMessage.textContent = "";
});
loginLink.addEventListener("click", (e) => {
  e.preventDefault();
  signupBox.style.display = "none";
  loginBox.style.display = "block";
  loginMessage.textContent = "";
  signupMessage.textContent = "";
});

// Validations
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validatePassword(password) {
  // Minimum 8 chars, letters + numbers + symbols
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(
    password,
  );
}

// Login submit
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMessage.textContent = "";

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!email || !password) {
    loginMessage.textContent = "Please fill all fields!";
    loginMessage.style.color = "red";
    return;
  }
  if (!validateEmail(email)) {
    loginMessage.textContent = "Invalid email format!";
    loginMessage.style.color = "red";
    return;
  }

  try {
    const res = await fetch("/user/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const result = await res.json();
    loginMessage.textContent = result.message;
    loginMessage.style.color = result.success ? "green" : "red";
    if (result.success) loginForm.reset();
  } catch (err) {
    loginMessage.textContent = "Server error. Try again!";
    loginMessage.style.color = "red";
  }
});

// Signup submit
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupMessage.textContent = "";

  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value.trim();

  if (!name || !email || !password) {
    signupMessage.textContent = "Please fill all fields!";
    signupMessage.style.color = "red";
    return;
  }
  if (!validateEmail(email)) {
    signupMessage.textContent = "Invalid email format!";
    signupMessage.style.color = "red";
    return;
  }
  if (!validatePassword(password)) {
    signupMessage.textContent =
      "Password must be at least 8 chars, include letters, numbers & symbols!";
    signupMessage.style.color = "red";
    return;
  }

  try {
    const res = await fetch("/user/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const result = await res.json();
    signupMessage.textContent = result.message;
    signupMessage.style.color = result.success ? "green" : "red";

    if (result.success) {
      signupForm.reset();
      signupBox.style.display = "none";
      loginBox.style.display = "block";
    }
  } catch (err) {
    signupMessage.textContent = "Server error. Try again!";
    signupMessage.style.color = "red";
  }
});
