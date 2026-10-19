
"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const fmtMoney = (n) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);

const fmtDate = (value) => {
  if (!value) return "—";
  const p = String(value).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : value;
};

const safe = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;",
  '"': "&quot;", "'": "&#39;"
})[c]);

function toast(message, error = false) {
  const box = $("#toastContainer");
  const item = document.createElement("div");
  item.className = `toast${error ? " error" : ""}`;
  item.textContent = message;
  box.appendChild(item);
  setTimeout(() => item.remove(), 3500);
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || "Yêu cầu thất bại.");
  }

  return data;
}

function statusLabel(status) {
  const map = {
    pending: ["Chờ xác nhận", "status-pending"],
    confirmed: ["Đã xác nhận", "status-confirmed"],
    completed: ["Hoàn thành", "status-completed"],
    cancelled: ["Đã hủy", "status-cancelled"],
    rejected: ["Bị từ chối", "status-rejected"]
  };

  const item = map[String(status || "").toLowerCase()] ||
    [status || "Không rõ", "status-pending"];

  return `<span class="status ${item[1]}">${safe(item[0])}</span>`;
}

function showAdminSection(name) {
  $$("[data-admin-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== name);
  });

  $$("[data-admin-section]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminSection === name);
  });

  const labels = {
    overview: "Tổng quan",
    fields: "Quản lý sân",
    bookings: "Lịch đặt sân",
    users: "Người dùng",
    revenue: "Doanh thu"
  };

  $("#adminBreadcrumb").textContent = labels[name] || "Tổng quan";

  const loaders = {
    overview: loadOverview,
    fields: loadFields,
    bookings: loadBookings,
    users: loadUsers,
    revenue: loadRevenue
  };

  loaders[name]?.().catch((error) => toast(error.message, true));
}

async function loadOverview() {
  const data = await api("/admin/summary");
  const summary = data.summary || data;

  $("#statFields").textContent = summary.total_fields ?? summary.fields ?? 0;
  $("#statBookings").textContent = summary.total_bookings ?? summary.bookings ?? 0;
  $("#statUsers").textContent = summary.total_users ?? summary.users ?? 0;
  $("#statRevenue").textContent = fmtMoney(summary.total_revenue ?? summary.revenue ?? 0);

  const bookingsData = await api("/admin/bookings");
  const bookings = Array.isArray(bookingsData)
    ? bookingsData
    : bookingsData.bookings || [];

  $("#recentAdminBookings").innerHTML = bookings.slice(0, 8).map((b) => `
    <tr>
      <td>${safe(b.user_name || b.name || b.email || `#${b.user_id}`)}</td>
      <td>${safe(b.field_name || `Sân #${b.field_id}`)}</td>
      <td>${fmtDate(b.booking_date)}</td>
      <td>${fmtMoney(b.total_price)}</td>
      <td>${statusLabel(b.status)}</td>
      <td>${bookingActions(b)}</td>
    </tr>
  `).join("") || `<tr><td colspan="6">Chưa có lịch đặt sân.</td></tr>`;
}

function bookingActions(b) {
  const status = String(b.status || "").toLowerCase();

  if (status === "pending") {
    return `
      <button class="btn btn-sm btn-primary" data-booking-status="${Number(b.id)}" data-status="confirmed">Xác nhận</button>
      <button class="btn btn-sm btn-outline" data-booking-status="${Number(b.id)}" data-status="cancelled">Hủy</button>
    `;
  }

  if (status === "confirmed") {
    return `
      <button class="btn btn-sm btn-primary" data-booking-status="${Number(b.id)}" data-status="completed">Hoàn thành</button>
      <button class="btn btn-sm btn-outline" data-booking-status="${Number(b.id)}" data-status="cancelled">Hủy</button>
    `;
  }

  return "—";
}

async function loadFields() {
  const data = await api("/admin/fields");
  const fields = Array.isArray(data) ? data : data.fields || [];

  $("#adminFieldsBody").innerHTML = fields.map((f) => `
    <tr>
      <td>${Number(f.id)}</td>
      <td>${safe(f.name)}</td>
      <td>${safe(f.field_type)}</td>
      <td>${fmtMoney(f.price_per_hour)}</td>
      <td>${f.is_active ? '<span class="status status-active">Hoạt động</span>' : '<span class="status status-inactive">Tạm ngừng</span>'}</td>
      <td>
        <button class="btn btn-sm btn-outline"
                data-field-status="${Number(f.id)}"
                data-active="${f.is_active ? "0" : "1"}">
          ${f.is_active ? "Tạm ngừng" : "Kích hoạt"}
        </button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6">Chưa có sân bóng.</td></tr>`;
}

async function loadBookings() {
  const data = await api("/admin/bookings");
  const bookings = Array.isArray(data) ? data : data.bookings || [];

  $("#adminBookingsBody").innerHTML = bookings.map((b) => `
    <tr>
      <td>${safe(b.user_name || b.name || b.email || `#${b.user_id}`)}</td>
      <td>${safe(b.field_name || `Sân #${b.field_id}`)}</td>
      <td>${fmtDate(b.booking_date)}</td>
      <td>${safe(String(b.start_time || "").slice(0, 5))}–${safe(String(b.end_time || "").slice(0, 5))}</td>
      <td>${fmtMoney(b.total_price)}</td>
      <td>${statusLabel(b.status)}</td>
      <td>${bookingActions(b)}</td>
    </tr>
  `).join("") || `<tr><td colspan="7">Chưa có lịch đặt.</td></tr>`;
}

async function loadUsers() {
  const data = await api("/admin/users");
  const users = Array.isArray(data) ? data : data.users || [];

  $("#adminUsersBody").innerHTML = users.map((u) => `
    <tr>
      <td>${safe(u.name)}</td>
      <td>${safe(u.email)}</td>
      <td>${safe(u.phone || "—")}</td>
      <td>${safe(u.role)}</td>
      <td>${u.is_active ? '<span class="status status-active">Hoạt động</span>' : '<span class="status status-inactive">Đã khóa</span>'}</td>
      <td>
        ${u.role === "admin" ? "—" : `
          <button class="btn btn-sm btn-outline"
                  data-user-status="${Number(u.id)}"
                  data-active="${u.is_active ? "0" : "1"}">
            ${u.is_active ? "Khóa tài khoản" : "Mở khóa"}
          </button>
        `}
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6">Chưa có người dùng.</td></tr>`;
}

async function loadRevenue() {
  const data = await api("/admin/revenue");
  const rows = Array.isArray(data) ? data : data.months || data.revenue || [];
  const total = data.total_revenue ?? data.total ?? 0;

  $("#revenueTotal").textContent = fmtMoney(total);

  $("#revenueBody").innerHTML = rows.map((item) => `
    <tr>
      <td>${safe(item.month || item.period || "—")}</td>
      <td>${Number(item.booking_count ?? item.total_bookings ?? 0)}</td>
      <td>${fmtMoney(item.revenue ?? item.total_revenue ?? 0)}</td>
    </tr>
  `).join("") || `<tr><td colspan="3">Chưa có dữ liệu doanh thu.</td></tr>`;
}

$("#showAddField").addEventListener("click", () => {
  $("#addFieldForm").classList.toggle("hidden");
});

$("#cancelAddField").addEventListener("click", () => {
  $("#addFieldForm").reset();
  $("#addFieldForm").classList.add("hidden");
});

$("#addFieldForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: $("#fieldName").value.trim(),
    field_type: $("#fieldType").value,
    price_per_hour: Number($("#fieldPrice").value),
    location: $("#fieldLocation").value.trim(),
    image_url: $("#fieldImage").value.trim(),
    description: $("#fieldDescription").value.trim()
  };

  try {
    await api("/admin/fields", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    toast("Đã thêm sân bóng.");
    $("#addFieldForm").reset();
    $("#addFieldForm").classList.add("hidden");
    await loadFields();
    await loadOverview();
  } catch (error) {
    toast(error.message, true);
  }
});

document.addEventListener("click", async (event) => {
  const sectionButton = event.target.closest("[data-admin-section]");
  if (sectionButton) {
    showAdminSection(sectionButton.dataset.adminSection);
    return;
  }

  const bookingButton = event.target.closest("[data-booking-status]");
  if (bookingButton) {
    try {
      await api(`/admin/bookings/${bookingButton.dataset.bookingStatus}`, {
        method: "PATCH",
        body: JSON.stringify({ status: bookingButton.dataset.status })
      });

      toast("Đã cập nhật lịch đặt.");
      await loadBookings();
      await loadOverview();
    } catch (error) {
      toast(error.message, true);
    }
    return;
  }

  const fieldButton = event.target.closest("[data-field-status]");
  if (fieldButton) {
    try {
      await api(`/admin/fields/${fieldButton.dataset.fieldStatus}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: fieldButton.dataset.active === "1" })
      });

      toast("Đã cập nhật trạng thái sân.");
      await loadFields();
      await loadOverview();
    } catch (error) {
      toast(error.message, true);
    }
    return;
  }

  const userButton = event.target.closest("[data-user-status]");
  if (userButton) {
    try {
      await api(`/admin/users/${userButton.dataset.userStatus}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: userButton.dataset.active === "1" })
      });

      toast("Đã cập nhật tài khoản.");
      await loadUsers();
      await loadOverview();
    } catch (error) {
      toast(error.message, true);
    }
  }
});

$("#adminRefresh").addEventListener("click", () => {
  showAdminSection(
    $$("[data-admin-panel]").find((p) => !p.classList.contains("hidden"))
      ?.dataset.adminPanel || "overview"
  );
});

$("#adminLogout").addEventListener("click", async () => {
  try {
    await api("/logout", { method: "POST" });
    window.location.href = "/login";
  } catch (error) {
    toast(error.message, true);
  }
});

async function initAdmin() {
  try {
    const response = await api("/me");
    const user = response.user || response;

    if (user.role !== "admin") {
      window.location.replace("/");
      return;
    }

    await loadOverview();
  } catch (error) {
    window.location.replace("/login");
  }
}

initAdmin();
