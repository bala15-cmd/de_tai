
"use strict";

const $ = (selector) => document.querySelector(selector);

function notify(message, isError = false) {
  const container = $("#toastContainer");
  const toast = document.createElement("div");

  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}

async function request(path, body) {
  const response = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || "Có lỗi xảy ra.");
  }

  return data;
}

function showPanel(panel) {
  $("#loginPanel").classList.toggle("hidden", panel !== "login");
  $("#registerPanel").classList.toggle("hidden", panel !== "register");
}

$("#showRegister").addEventListener("click", () => showPanel("register"));
$("#showLogin").addEventListener("click", () => showPanel("login"));

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("#loginSubmit");
  button.disabled = true;
  button.textContent = "Đang đăng nhập...";

  try {
    await request("/login", {
      email: $("#loginEmail").value.trim(),
      password: $("#loginPassword").value
    });

    notify("Đăng nhập thành công!");

    setTimeout(() => {
      window.location.href = "/";
    }, 300);
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Đăng nhập";
  }
});

$("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("#registerName").value.trim();
  const email = $("#registerEmail").value.trim();
  const phone = $("#registerPhone").value.trim();
  const password = $("#registerPassword").value;
  const confirmPassword = $("#registerConfirmPassword").value;

  if (password.length < 8) {
    notify("Mật khẩu phải có ít nhất 8 ký tự.", true);
    return;
  }

  if (password !== confirmPassword) {
    notify("Mật khẩu xác nhận không khớp.", true);
    return;
  }

  const button = $("#registerSubmit");
  button.disabled = true;
  button.textContent = "Đang tạo tài khoản...";

  try {
    await request("/register", { name, email, phone, password });

    notify("Đăng ký thành công! Bạn có thể đăng nhập.");
    $("#registerForm").reset();
    $("#loginEmail").value = email;
    showPanel("login");
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Tạo tài khoản";
  }
});

async function checkSession() {
  try {
    const response = await fetch("/api/me", {
      credentials: "same-origin"
    });

    if (!response.ok) return;

    const data = await response.json();
    if (data.user || data.id) {
      window.location.replace("/");
    }
  } catch (error) {
    console.warn("Chưa thể kiểm tra phiên đăng nhập.", error);
  }
}

checkSession();

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  // ===============================
  // ĐĂNG NHẬP
  // ===============================
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document
        .getElementById("loginEmail")
        .value.trim();

      const password = document
        .getElementById("loginPassword")
        .value;

      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "same-origin",
          body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) {
          alert(result.message || "Đăng nhập thất bại!");
          return;
        }

        const user = result.user || result;

        if (user.role === "admin") {
          window.location.href = "/admin";
        } else {
          window.location.href = "/";
        }
      } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        alert("Không thể kết nối máy chủ. Vui lòng thử lại!");
      }
    });
  }

  // ===============================
  // ĐĂNG KÝ TÀI KHOẢN
  // ===============================
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = document
        .getElementById("registerName")
        .value.trim();

      const email = document
        .getElementById("registerEmail")
        .value.trim();

      const password = document
        .getElementById("registerPassword")
        .value;

      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "same-origin",
          body: JSON.stringify({ name, email, password })
        });

        const result = await response.json();

        if (!response.ok) {
          alert(result.message || "Đăng ký thất bại!");
          return;
        }

        alert("Đăng ký thành công! Vui lòng đăng nhập.");
        registerForm.reset();

        // Nếu trang có nút chuyển sang đăng nhập,
        // bạn có thể gọi nút đó tại đây.
      } catch (error) {
        console.error("Lỗi đăng ký:", error);
        alert("Không thể kết nối máy chủ. Vui lòng thử lại!");
      }
    });
  }
});
