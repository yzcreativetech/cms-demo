import { getSession, getCurrentUser, onAuthStateChange, signOut } from "./auth-service.js";

const button = document.getElementById("logout-button");
const status = document.getElementById("editor-status");
let redirecting = false;

function redirectToLogin() {
  document.body.hidden = true;
  if (!redirecting) {
    redirecting = true;
    window.location.replace("login.html");
  }
}

async function checkSession() {
  try {
    const session = await getSession();
    if (!session || !await getCurrentUser()) {
      redirectToLogin();
      return;
    }
    if (!redirecting) document.body.hidden = false;
  } catch {
    redirectToLogin();
  }
}

button.addEventListener("click", async () => {
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = "Signing out...";
  button.setAttribute("aria-busy", "true");
  status.classList.remove("is-error");
  status.textContent = "";
  try {
    await signOut();
    redirectToLogin();
  } catch {
    status.classList.add("is-error");
    status.textContent = "Unable to sign out. Check your connection and try again.";
    status.scrollIntoView({ block: "nearest" });
  } finally {
    button.disabled = false;
    button.textContent = "Logout";
    button.setAttribute("aria-busy", "false");
  }
});

async function initialize() {
  try {
    // Keep the callback synchronous: auth calls inside it can deadlock.
    await onAuthStateChange((_event, session) => {
      if (!session) redirectToLogin();
    });
    await checkSession();
  } catch {
    redirectToLogin();
  }
}

// Recheck pages restored from the back/forward cache and returning tabs.
window.addEventListener("pagehide", () => { document.body.hidden = true; });
window.addEventListener("pageshow", (event) => {
  if (event.persisted) void checkSession();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void checkSession();
});
void initialize();
