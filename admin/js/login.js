import { getSession, getCurrentUser, signIn } from "./auth-service.js";

const form = document.getElementById("login-form");
const emailInput = document.getElementById("login-email");
const passwordInput = document.getElementById("login-password");
const button = document.getElementById("login-submit");
const status = document.getElementById("login-status");
let busy = true;

function setBusy(value, label = "Sign In") {
  busy = value;
  button.disabled = value;
  button.textContent = label;
  button.setAttribute("aria-busy", String(value));
}

function showError(error) {
  status.classList.add("is-error");
  status.textContent = error?.code === "AUTH_CONFIGURATION"
    ? "Sign-in is not configured. Set the Project URL and public key in admin/js/supabase-client.js."
    : "Unable to sign in. Check your email and password and try again. If this continues, check your connection.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const email = emailInput.value.trim();
  if (!email || !passwordInput.value) {
    status.classList.add("is-error");
    status.textContent = "Enter your email and password.";
    (!email ? emailInput : passwordInput).focus();
    return;
  }
  setBusy(true, "Signing in...");
  status.classList.remove("is-error");
  status.textContent = "Signing in...";
  try {
    await signIn(email, passwordInput.value);
    window.location.replace("index.html");
  } catch (error) {
    showError(error);
    setBusy(false);
  } finally {
    passwordInput.value = "";
  }
});

async function initialize() {
  setBusy(true, "Checking session...");
  try {
    const session = await getSession();
    if (session && await getCurrentUser()) {
      window.location.replace("index.html");
      return;
    }
  } catch (error) {
    showError(error);
  }
  document.body.hidden = false;
  setBusy(false);
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) void initialize();
});
void initialize();
