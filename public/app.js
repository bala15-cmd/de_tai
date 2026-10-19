
"use strict";

const API = "/api";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

const state = {
  user: null,
  fields: [],
  bookings: [],
  notifications: [],
  section: "home",
  bookingField: null
};

const money = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const dateText = (value) => {
  if (!value) return "—";
  const text = String(value).slice(0, 10);
  const parts = text.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return text;
};

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function showToast(message, type = "success") {
  let container = $("#toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      state.user = null;
    }
    throw new Error(data.message || data.error || "Có lỗi xảy ra.");
  }

  return data;
}

function firstLetter(value) {
  return String(value || "U").trim().charAt(0).toUpperCase() || "U";
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value ?? "";
}

function setImageOrInitial(element, name, imageUrl) {
  if (!element) return;

  if (imageUrl) {
    element.innerHTML = "";
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = name || "Ảnh đại diện";
    image.onerror = () => {
      element.textContent = firstLetter(name);
    };
    element.appendChild(image);
  } else {
    element.textContent = firstLetter(name);
  }
}

function updateUserUI() {
  const user = state.user;
  if (!user) return;

  const name = user.name || "Người dùng";
  const role = user.role === "admin" ? "Quản trị viên" : "Khách hàng";

  [
    "#sidebarUserName",
    "#topUserName",
    "#profileDisplayName"
  ].forEach((selector) => setText(selector, name));

  setText("#sidebarUserRole", role);
  setText("#topUserRole", role);
  setText("#profileDisplayEmail", user.email || "");
  setText("#profileRole", role);
  setText("#profileDisplayEmail", user.email || "");

  setImageOrInitial($("#sidebarAvatar"), name, user.avatar_url);
  setImageOrInitial($("#topAvatar"), name, user.avatar_url);
  setImageOrInitial($("#profileAvatar"), name, user.avatar_url);

  if ($("#profileName")) $("#profileName").value = user.name || "";
  if ($("#profileEmail")) $("#profileEmail").value = user.email || "";
  if ($("#profilePhone")) $("#profilePhone").value = user.phone || "";

  const loginButton = $("#loginButton");
  if (loginButton) loginButton.classList.add("hidden");
}

function fieldImage(field) {
  return field.image_url ||
    "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=900&q=80";
}

function fieldTypeName(type) {
  const value = String(type || "").toLowerCase();

  if (value.includes("5")) return "Sân 5 người";
  if (value.includes("7")) return "Sân 7 người";
  if (value.includes("11")) return "Sân 11 người";

  return type || "Sân bóng đá";
}

function fieldCard(field) {
  const id = Number(field.id);
  const image = escapeHTML(fieldImage(field));

  return `
    <article class="field-card">
      <div class="field-image">
        <img src="${image}" alt="${escapeHTML(field.name)}"
             loading="lazy"
             onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=900&q=80'">
        <span class="field-type-badge">${escapeHTML(fieldTypeName(field.field_type))}</span>
      </div>
      <div class="field-card-body">
        <h3 class="field-card-title">${escapeHTML(field.name)}</h3>
        <div class="field-location">📍 ${escapeHTML(field.location || "Chưa cập nhật địa chỉ")}</div>
        <p class="field-description">${escapeHTML(field.description || "Sân bóng sẵn sàng phục vụ bạn.")}</p>
        <div class="field-card-footer">
          <div class="field-price">
            ${money(field.price_per_hour)}
            <small>/ giờ</small>
          </div>
          <button class="btn btn-primary"
                  data-book-field="${id}"
                  ${field.is_active === 0 || field.is_active === false ? "disabled" : ""}>
            Đặt sân
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderFields(fields, targetSelector) {
  const target = $(targetSelector);
  if (!target) return;

  if (!fields.length) {
    target.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚽</div>
        <h3>Chưa tìm thấy sân bóng</h3>
        <p>Thử thay đổi từ khóa hoặc loại sân nhé.</p>
      </div>
    `;
    return;
  }

  target.innerHTML = fields.map(fieldCard).join("");
}

async function loadFields() {
  const data = await api("/fields");
  state.fields = Array.isArray(data) ? data : data.fields || [];

  renderFields(state.fields.slice(0, 6), "#fieldGrid");
  renderFields(state.fields, "#allFieldGrid");

  setText("#totalFields", state.fields.length);
}

function filterFields(keyword, type) {
  const normalized = String(keyword || "").trim().toLowerCase();

  return state.fields.filter((field) => {
    const text = [
      field.name,
      field.location,
      field.description,
      field.field_type
    ].join(" ").toLowerCase();

    const matchesKeyword = !normalized || text.includes(normalized);
    const matchesType = !type ||
      String(field.field_type || "").toLowerCase() === type.toLowerCase();

    return matchesKeyword && matchesType;
  });
}

function setupFieldSearch() {
  $("#searchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const fields = filterFields(
      $("#searchKeyword")?.value,
      $("#searchFieldType")?.value
    );

    renderFields(fields, "#fieldGrid");
  });

  $("#allFieldsSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    renderFields(
      filterFields(
        $("#allFieldsKeyword")?.value,
        $("#allFieldsType")?.value
      ),
      "#allFieldGrid"
    );
  });

  $("#viewAllFieldsBtn")?.addEventListener("click", () => {
    showSection("fields");
  });

  $("#resetSearchBtn")?.addEventListener("click", () => {
    if ($("#searchKeyword")) $("#searchKeyword").value = "";
    if ($("#searchFieldType")) $("#searchFieldType").value = "";
    renderFields(state.fields, "#fieldGrid");
  });
}

function bookingStatus(status) {
  const value = String(status || "").toLowerCase();

  const labels = {
    pending: ["Chờ xác nhận", "status-pending"],
    confirmed: ["Đã xác nhận", "status-confirmed"],
    cancelled: ["Đã hủy", "status-cancelled"],
    rejected: ["Bị từ chối", "status-rejected"],
    completed: ["Hoàn thành", "status-completed"]
  };

  const result = labels[value] || [status || "Không rõ", "status-pending"];

  return `<span class="status ${result[1]}">${escapeHTML(result[0])}</span>`;
}

function renderBookingRows(bookings) {
  const body = $("#bookingTableBody");
  if (!body) return;

  if (!bookings.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-state-icon">📅</div>
            <h3>Bạn chưa có lịch đặt sân</h3>
            <p>Chọn một sân bóng để bắt đầu đặt lịch.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = bookings.map((booking) => `
    <tr>
      <td>
        <div class="table-primary">${escapeHTML(booking.field_name || `Sân #${booking.field_id}`)}</div>
        <div class="table-secondary">${escapeHTML(booking.location || "")}</div>
      </td>
      <td>${dateText(booking.booking_date)}</td>
      <td>${escapeHTML(String(booking.start_time || "").slice(0, 5))} – ${escapeHTML(String(booking.end_time || "").slice(0, 5))}</td>
      <td>${money(booking.total_price)}</td>
      <td>${bookingStatus(booking.status)}</td>
      <td>
        ${["pending", "confirmed"].includes(String(booking.status).toLowerCase())
          ? `<button class="btn btn-sm btn-outline" data-cancel-booking="${Number(booking.id)}">Hủy</button>`
          : "—"}
      </td>
    </tr>
  `).join("");
}

function renderRecentBookings(bookings) {
  const target = $("#recentBookingsList");
  if (!target) return;

  const recent = bookings.slice(0, 4);

  if (!recent.length) {
    target.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h3>Chưa có lịch đặt sân</h3>
        <p>Lịch đặt sân của bạn sẽ xuất hiện tại đây.</p>
      </div>
    `;
    return;
  }

  target.innerHTML = recent.map((booking) => `
    <div class="booking-item">
      <div class="booking-item-icon">⚽</div>
      <div class="booking-item-content">
        <strong>${escapeHTML(booking.field_name || `Sân #${booking.field_id}`)}</strong>
        <p>${dateText(booking.booking_date)} · ${escapeHTML(String(booking.start_time || "").slice(0, 5))}–${escapeHTML(String(booking.end_time || "").slice(0, 5))}</p>
        <p>${bookingStatus(booking.status)}</p>
      </div>
      <div class="booking-item-side">
        <strong>${money(booking.total_price)}</strong>
      </div>
    </div>
  `).join("");
}

async function loadBookings() {
  const data = await api("/bookings/mine");
  state.bookings = Array.isArray(data) ? data : data.bookings || [];

  renderBookingRows(state.bookings);
  renderRecentBookings(state.bookings);

  setText("#myBookingCount", state.bookings.length);
  setText(
    "#myPendingCount",
    state.bookings.filter((item) =>
      String(item.status).toLowerCase() === "pending"
    ).length
  );
}

async function cancelBooking(id) {
  if (!confirm("Bạn có chắc muốn hủy lịch đặt sân này không?")) return;

  try {
    await api(`/bookings/${id}/cancel`, { method: "PATCH" });
    showToast("Đã gửi yêu cầu hủy lịch đặt sân.");
    await loadBookings();
    await loadNotifications();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderNotifications(notifications) {
  const target = $("#notificationList");
  if (!target) return;

  if (!notifications.length) {
    target.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔔</div>
        <h3>Chưa có thông báo</h3>
        <p>Thông báo mới sẽ xuất hiện tại đây.</p>
      </div>
    `;
    return;
  }

  target.innerHTML = notifications.map((item) => `
    <div class="notification-item ${item.is_read ? "" : "unread"}">
      <div class="notification-icon">🔔</div>
      <div class="notification-content">
        <strong>${escapeHTML(item.title || "Thông báo")}</strong>
        <p>${escapeHTML(item.message || "")}</p>
        <time>${dateText(item.created_at)}</time>
      </div>
      ${item.is_read ? "" : `
        <button class="btn btn-sm btn-outline"
                data-read-notification="${Number(item.id)}">Đã đọc</button>
      `}
    </div>
  `).join("");

  const unread = notifications.filter((item) => !item.is_read).length;

  const badge = $("#notificationBadge");
  if (badge) {
    badge.textContent = unread;
    badge.classList.toggle("hidden", unread === 0);
  }

  const dot = $("#topNotificationDot");
  if (dot) dot.classList.toggle("hidden", unread === 0);
}

async function loadNotifications() {
  const data = await api("/notifications");
  state.notifications = Array.isArray(data) ? data : data.notifications || [];
  renderNotifications(state.notifications);
}

async function markNotificationRead(id) {
  try {
    await api(`/notifications/${id}/read`, { method: "PATCH" });
    await loadNotifications();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function showSection(name) {
  state.section = name;

  $$("[data-section]").forEach((section) => {
    section.classList.toggle("hidden", section.dataset.section !== name);
  });

  $$("[data-goto]").forEach((button) => {
    button.classList.toggle("active", button.dataset.goto === name);
  });

  const labels = {
    home: "Tổng quan",
    fields: "Danh sách sân",
    bookings: "Lịch đặt sân",
    notifications: "Thông báo",
    profile: "Hồ sơ cá nhân",
    help: "Trợ giúp"
  };

  setText("#breadcrumbCurrent", labels[name] || "Tổng quan");

  const sidebar = $("#sidebar");
  sidebar?.classList.remove("open");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupNavigation() {
  document.addEventListener("click", (event) => {
    const goto = event.target.closest("[data-goto]");
    if (goto) {
      event.preventDefault();
      showSection(goto.dataset.goto);
      return;
    }

    const bookButton = event.target.closest("[data-book-field]");
    if (bookButton) {
      const field = state.fields.find(
        (item) => Number(item.id) === Number(bookButton.dataset.bookField)
      );

      if (field) openBookingModal(field);
      return;
    }

    const cancelButton = event.target.closest("[data-cancel-booking]");
    if (cancelButton) {
      cancelBooking(cancelButton.dataset.cancelBooking);
      return;
    }

    const readButton = event.target.closest("[data-read-notification]");
    if (readButton) {
      markNotificationRead(readButton.dataset.readNotification);
    }
  });

  $("#mobileMenuBtn")?.addEventListener("click", () => {
    $("#sidebar")?.classList.toggle("open");
  });

  $("#topNotificationBtn")?.addEventListener("click", () => {
    showSection("notifications");
  });

  $("#supportBookBtn")?.addEventListener("click", () => {
    showSection("fields");
  });

  $("#heroBookBtn")?.addEventListener("click", () => {
    showSection("fields");
  });

  $("#refreshNotificationsBtn")?.addEventListener("click", loadNotifications);

  $("#logoutBtn")?.addEventListener("click", async () => {
    try {
      await api("/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#loginButton")?.addEventListener("click", () => {
    window.location.href = "/login";
  });
}

function openBookingModal(field) {
  if (!state.user) {
    window.location.href = "/login";
    return;
  }

  state.bookingField = field;

  setText("#bookingFieldName", field.name);
  setText("#bookingFieldLocation", field.location || "Chưa cập nhật địa chỉ");
  setText("#bookingFieldPrice", `${money(field.price_per_hour)} / giờ`);

  const image = $("#bookingPreviewImage");
  if (image) image.src = fieldImage(field);

  if ($("#bookingFieldId")) $("#bookingFieldId").value = field.id;

  const dateInput = $("#bookingDate");
  if (dateInput) {
    const today = new Date();
    const localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");

    dateInput.min = localDate;
    dateInput.value = localDate;
  }

  if ($("#bookingStart")) $("#bookingStart").value = "08:00";
  if ($("#bookingEnd")) $("#bookingEnd").value = "09:00";
  if ($("#bookingNote")) $("#bookingNote").value = "";

  calculateBookingTotal();

  const modal = $("#bookingModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeBookingModal() {
  const modal = $("#bookingModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  state.bookingField = null;
}

function calculateBookingTotal() {
  const field = state.bookingField;
  if (!field) return;

  const start = $("#bookingStart")?.value;
  const end = $("#bookingEnd")?.value;

  if (!start || !end) {
    setText("#bookingTotal", money(0));
    return;
  }

  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const duration = (endMinutes - startMinutes) / 60;

  if (duration <= 0) {
    setText("#bookingTotal", "Giờ không hợp lệ");
    return;
  }

  setText("#bookingTotal", money(duration * Number(field.price_per_hour)));
}

function setupBookingModal() {
  $("#closeBookingModal")?.addEventListener("click", closeBookingModal);
  $("#cancelBookingModal")?.addEventListener("click", closeBookingModal);

  $("#bookingModal")?.addEventListener("click", (event) => {
    if (event.target.id === "bookingModal") closeBookingModal();
  });

  $("#bookingStart")?.addEventListener("change", calculateBookingTotal);
  $("#bookingEnd")?.addEventListener("change", calculateBookingTotal);

  $("#bookingForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.bookingField) {
      showToast("Vui lòng chọn sân bóng.", "error");
      return;
    }

    const date = $("#bookingDate")?.value;
    const start = $("#bookingStart")?.value;
    const end = $("#bookingEnd")?.value;

    if (!date || !start || !end || end <= start) {
      showToast("Vui lòng kiểm tra ngày và giờ đặt sân.", "error");
      return;
    }

    const button = $("#submitBookingBtn");
    if (button) {
      button.disabled = true;
      button.textContent = "Đang xử lý...";
    }

    try {
      await api("/bookings", {
        method: "POST",
        body: JSON.stringify({
          field_id: Number(state.bookingField.id),
          booking_date: date,
          start_time: start,
          end_time: end,
          note: $("#bookingNote")?.value.trim() || ""
        })
      });

      closeBookingModal();
      showToast("Đặt sân thành công! Vui lòng theo dõi trạng thái lịch đặt.");

      await Promise.all([
        loadBookings(),
        loadNotifications()
      ]);

      showSection("bookings");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Xác nhận đặt sân";
      }
    }
  });
}

function setupBookingFilters() {
  $$("[data-booking-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.bookingFilter;

      $$("[data-booking-filter]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      const bookings = filter === "all"
        ? state.bookings
        : state.bookings.filter((item) =>
            String(item.status).toLowerCase() === filter.toLowerCase()
          );

      renderBookingRows(bookings);
    });
  });
}

function setupProfileForm() {
  $("#profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = $("#profileName")?.value.trim();
    const phone = $("#profilePhone")?.value.trim();

    if (!name) {
      showToast("Vui lòng nhập họ tên.", "error");
      return;
    }

    try {
      const result = await api("/profile", {
        method: "PATCH",
        body: JSON.stringify({ name, phone })
      });

      state.user = result.user || result;
      updateUserUI();
      showToast("Cập nhật hồ sơ thành công.");
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function setupDateAndYear() {
  const now = new Date();

  setText(
    "#todayDate",
    now.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })
  );

  setText("#currentYear", now.getFullYear());
}

async function init() {
  setupDateAndYear();
  setupNavigation();
  setupFieldSearch();
  setupBookingModal();
  setupBookingFilters();
  setupProfileForm();

  try {
    const me = await api("/me");
    state.user = me.user || me;

    updateUserUI();

    if (state.user?.role === "admin") {
      const adminLink = $("#adminLink");
      if (adminLink) adminLink.classList.remove("hidden");
    }

    await Promise.all([
      loadFields(),
      loadBookings(),
      loadNotifications()
    ]);
  } catch (error) {
    console.error("Không thể khởi tạo trang:", error);
    showToast("Không tải được dữ liệu. Hãy kiểm tra server và đăng nhập.", "error");
  }
}

document.addEventListener("DOMContentLoaded", init);
