const COUNTRY_NAMES = {
  US: "United States (USD)", GB: "United Kingdom (GBP)",
  FR: "France (EUR)", DE: "Germany (EUR)", JP: "Japan (JPY)",
  MY: "Malaysia (MYR)", SG: "Singapore (SGD)", AU: "Australia (AUD)",
  CA: "Canada (CAD)", BR: "Brazil (BRL)", MX: "Mexico (MXN)",
  IN: "India (INR)", KR: "South Korea (KRW)", TH: "Thailand (THB)",
  ID: "Indonesia (IDR)", PH: "Philippines (PHP)", HK: "Hong Kong (HKD)",
  TW: "Taiwan (TWD)", NZ: "New Zealand (NZD)", SE: "Sweden (SEK)",
  NO: "Norway (NOK)", DK: "Denmark (DKK)", CH: "Switzerland (CHF)",
  PL: "Poland (PLN)", CZ: "Czech Republic (CZK)", RO: "Romania (RON)",
  HU: "Hungary (HUF)", AE: "UAE (AED)", SA: "Saudi Arabia (SAR)",
  ZA: "South Africa (ZAR)", CL: "Chile (CLP)", CO: "Colombia (COP)",
  PE: "Peru (PEN)", AR: "Argentina (ARS)",
};

const countrySelect = document.getElementById("country-select");
Object.entries(COUNTRY_NAMES)
  .sort((a, b) => a[1].localeCompare(b[1]))
  .forEach(([code, name]) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = name;
    countrySelect.appendChild(opt);
  });

let stripe, checkout, actions;
let selectedMode = "elements";
let currentSessionId = null;
let customerLookupEnabled = false;
let lookupDebounce = null;
const DEBUG = new URLSearchParams(window.location.search).has("debug");

document.querySelectorAll(".mode-option").forEach((opt) => {
  opt.addEventListener("click", () => {
    document.querySelectorAll(".mode-option").forEach((o) => o.classList.remove("selected"));
    opt.classList.add("selected");
    selectedMode = opt.dataset.mode;
    const label = document.getElementById("powered-by-label");
    const badge = document.getElementById("header-badge");
    if (selectedMode === "form-lookup") {
      label.textContent = "Powered by Stripe Checkout Form + Customer Lookup";
      badge.textContent = "Form + Lookup Demo";
    } else if (selectedMode === "elements-lookup") {
      label.textContent = "Powered by Stripe Elements + Customer Lookup";
      badge.textContent = "Customer Lookup Demo";
    } else {
      label.textContent = "Powered by Stripe Elements + Checkout Sessions";
      badge.textContent = "Custom Checkout Demo";
    }
  });
});

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add("visible");
}

function hideError(id) {
  document.getElementById(id).classList.remove("visible");
}

function showPhase(name) {
  document.querySelectorAll(".phase").forEach((p) => p.classList.remove("active"));
  document.getElementById(`phase-${name}`).classList.add("active");
}

function updateSummary(session) {
  const subtotalEl = document.getElementById("summary-subtotal");
  const taxEl = document.getElementById("summary-tax");
  const taxRow = document.getElementById("summary-tax-row");
  const totalEl = document.getElementById("summary-total");
  const recurringEl = document.getElementById("summary-recurring");
  const payBtnText = document.querySelector("#pay-btn .btn-text");

  if (session.total) {
    subtotalEl.textContent = session.total.subtotal?.amount || "";
    totalEl.textContent = session.total.total?.amount || "";

    if (session.total.taxExclusive?.minorUnitsAmount > 0 ||
        session.total.taxInclusive?.minorUnitsAmount > 0) {
      const taxAmt = session.total.taxExclusive?.amount || session.total.taxInclusive?.amount || "";
      taxEl.textContent = taxAmt;
      taxRow.style.display = "flex";
    }
  }

  if (session.recurring?.dueNext?.total?.amount) {
    recurringEl.textContent = session.recurring.dueNext.total.amount + "/mo";
  }

  if (session.total?.total?.amount) {
    payBtnText.textContent = `Subscribe \u00B7 ${session.total.total.amount}`;
  }
}

const APPEARANCE = {
  theme: "night",
  variables: {
    colorPrimary: "#a78bfa",
    colorBackground: "#1e1037",
    colorText: "#faf7f2",
    colorDanger: "#fca5a5",
    fontFamily: "Outfit, sans-serif",
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
    },
    ".Input:focus": {
      borderColor: "#6c3ce0",
      boxShadow: "0 0 0 3px rgba(108, 60, 224, 0.15)",
    },
    ".Label": {
      fontSize: "0.78rem",
      fontWeight: "500",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#b8a9d4",
    },
    ".Tab": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
    },
    ".Tab--selected": {
      backgroundColor: "rgba(108, 60, 224, 0.15)",
      borderColor: "#6c3ce0",
    },
  },
};

const CUSTOM_FONTS = [
  { cssSrc: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600" },
];

async function initElementsCheckout(publishableKey, enableLookup) {
  customerLookupEnabled = !!enableLookup;
  stripe = Stripe(publishableKey, {
    betas: ["custom_checkout_tax_id_1"],
  });

  const res = await fetch("/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countryCode: countrySelect.value || null }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  currentSessionId = data.sessionId;

  checkout = stripe.initCheckoutElementsSdk({
    clientSecret: data.clientSecret,
    elementsOptions: {
      appearance: APPEARANCE,
      fonts: CUSTOM_FONTS,
    },
    adaptivePricing: { allowed: true },
  });

  const loadResult = await checkout.loadActions();
  actions = loadResult.actions;

  const expressCheckout = checkout.createExpressCheckoutElement({
    buttonType: { applePay: "subscribe", googlePay: "subscribe" },
    paymentMethods: { applePay: "always", googlePay: "always" },
  });
  expressCheckout.mount("#express-checkout-element");
  expressCheckout.on("ready", ({ availablePaymentMethods }) => {
    if (availablePaymentMethods) {
      document.getElementById("or-divider").style.display = "flex";
    }
  });
  expressCheckout.on("confirm", async () => {
    const name = document.getElementById("name-input").value.trim();
    if (name) sessionStorage.setItem("checkout_name", name);
    if (DEBUG) console.log("[debug] express confirm - name stored:", name);
    const { error } = await actions.confirm();
    if (error) showError("error-msg-pay", error.message);
  });

  const currencySelector = checkout.createCurrencySelectorElement();
  currencySelector.mount("#currency-selector-element");

  const paymentElement = checkout.createPaymentElement({
    fields: { billingDetails: "auto" },
  });
  paymentElement.mount("#payment-element");

  const taxIdElement = checkout.createTaxIdElement({ visibility: "always" });
  taxIdElement.mount("#tax-id-element");

  const taxIdContainer = document.getElementById("tax-id-element");
  document.getElementById("business-toggle").addEventListener("change", (e) => {
    taxIdContainer.style.display = e.target.checked ? "block" : "none";
  });

  const session = actions.getSession();
  updateSummary(session);

  checkout.on("change", (updatedSession) => {
    updateSummary(updatedSession);
    document.getElementById("pay-btn").disabled = !updatedSession.canConfirm;
  });

  document.getElementById("pay-btn").disabled = !session.canConfirm;

  const emailInput = document.getElementById("email-input");
  const emailError = document.getElementById("email-error");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateEmail() {
    const val = emailInput.value.trim();
    if (val && !emailRegex.test(val)) {
      emailInput.classList.add("invalid");
      emailError.classList.add("visible");
      return false;
    }
    emailInput.classList.remove("invalid");
    emailError.classList.remove("visible");
    return true;
  }

  emailInput.addEventListener("blur", () => {
    if (!validateEmail()) return;
    const val = emailInput.value.trim();
    if (emailRegex.test(val) && customerLookupEnabled) {
      lookupCustomerByEmail(val);
    }
  });

  emailInput.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (emailInput.classList.contains("invalid")) validateEmail();
    if (emailRegex.test(val)) actions.updateEmail(val);
    hideLookupStatus();
  });

  showPhase("checkout");
}

function hideLookupStatus() {
  const el = document.getElementById("email-lookup-status");
  if (el) {
    el.classList.remove("visible", "found");
    el.textContent = "";
  }
}

function showLookupStatus(msg, isFound) {
  let el = document.getElementById("email-lookup-status");
  if (!el) {
    el = document.createElement("div");
    el.id = "email-lookup-status";
    el.className = "email-lookup-status";
    document.getElementById("email-error").after(el);
  }
  el.textContent = msg;
  el.classList.add("visible");
  el.classList.toggle("found", !!isFound);
}

async function lookupCustomerByEmail(email) {
  showLookupStatus("Looking up account...");

  try {
    const res = await fetch("/lookup-customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!data.found) {
      showLookupStatus("No existing account found. Continuing as guest.");
      return;
    }

    showLookupStatus("Existing account found.", true);
    showCustomerPopup(data.customer);
  } catch (err) {
    if (DEBUG) console.log("[debug] lookup error:", err);
    hideLookupStatus();
  }
}

function showCustomerPopup(customer) {
  document.getElementById("popup-customer-name").textContent = customer.name || "Customer";
  document.getElementById("popup-customer-email").textContent = customer.email;

  const popup = document.getElementById("customer-popup");
  const confirmBtn = document.getElementById("popup-confirm");
  const cancelBtn = document.getElementById("popup-cancel");
  confirmBtn.textContent = "Continue";
  confirmBtn.disabled = false;
  popup.classList.add("visible");

  const cleanup = () => {
    popup.classList.remove("visible");
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  };

  document.getElementById("popup-confirm").addEventListener("click", async () => {
    const btn = document.getElementById("popup-confirm");
    btn.textContent = "Attaching...";
    btn.disabled = true;

    try {
      const result = await actions.runServerUpdate(async () => {
        await fetch("/update-checkout-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            customerId: customer.id,
          }),
        });
      });

      if (result.type === "success") {
        updateSummary(result.session);
        showLookupStatus(`Signed in as ${customer.name || customer.email}.`, true);
        const emailInput = document.getElementById("email-input");
        emailInput.disabled = true;
        emailInput.style.opacity = "0.5";
        if (customer.name) {
          const nameInput = document.getElementById("name-input");
          nameInput.value = customer.name;
          nameInput.classList.remove("invalid");
        }
      }
    } catch (err) {
      if (DEBUG) console.log("[debug] attach customer error:", err);
      showError("error-msg-pay", "Failed to attach customer. Please try again.");
    }

    cleanup();
  });

  document.getElementById("popup-cancel").addEventListener("click", () => {
    cleanup();
    document.getElementById("email-input").focus();
    hideLookupStatus();
  });
}

let formLookupEnabled = false;

async function initCheckoutForm(publishableKey, enableLookup) {
  formLookupEnabled = !!enableLookup;
  stripe = Stripe(publishableKey, {
    betas: ["custom_checkout_payment_form_1"],
  });

  const res = await fetch("/create-checkout-form-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countryCode: countrySelect.value || null }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  currentSessionId = data.sessionId;

  const {rules, ...formAppearance} = APPEARANCE;
  checkout = stripe.initCheckoutFormSdk({
    clientSecret: data.clientSecret,
    appearance: formAppearance,
    fonts: CUSTOM_FONTS,
  });

  const loadResult = await checkout.loadActions();
  if (loadResult.type === "success") {
    actions = loadResult.actions;
    updateFormSummary(actions.getSession());
  }

  checkout.on("change", (updatedSession) => {
    updateFormSummary(updatedSession);
  });

  const form = checkout.createForm();

  form.on("confirm", async (event) => {
    const formName = document.getElementById("form-name-input").value.trim();
    if (formName) sessionStorage.setItem("checkout_name", formName);
    const { error } = await actions.confirm({ formConfirmEvent: event });
    if (error) {
      showError("error-msg-form", error.message);
    }
  });

  form.mount("#checkout-form-container");

  const lookupSection = document.getElementById("form-lookup-section");
  const titleEl = document.getElementById("form-phase-title");
  const descEl = document.getElementById("form-phase-desc");

  if (formLookupEnabled) {
    lookupSection.style.display = "block";
    titleEl.textContent = "Checkout Form + Customer Lookup";
    descEl.textContent = "Enter your email below to check for an existing account with saved payment methods, then complete checkout via the form.";
    setupFormEmailLookup();
  } else {
    lookupSection.style.display = "none";
    titleEl.textContent = "Checkout Form";
    descEl.textContent = "Complete checkout powered by a single Stripe form element with built-in payments, billing, shipping, tax, and express wallets.";
  }

  showPhase("checkout-form");
}

function setupFormEmailLookup() {
  const emailInput = document.getElementById("form-email-input");
  const emailError = document.getElementById("form-email-error");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate() {
    const val = emailInput.value.trim();
    if (val && !emailRegex.test(val)) {
      emailInput.classList.add("invalid");
      emailError.classList.add("visible");
      return false;
    }
    emailInput.classList.remove("invalid");
    emailError.classList.remove("visible");
    return true;
  }

  function hideStatus() {
    const el = document.getElementById("form-email-lookup-status");
    if (el) {
      el.classList.remove("visible", "found");
      el.textContent = "";
    }
  }

  function showStatus(msg, isFound) {
    const el = document.getElementById("form-email-lookup-status");
    if (el) {
      el.textContent = msg;
      el.classList.add("visible");
      el.classList.toggle("found", !!isFound);
    }
  }

  emailInput.addEventListener("input", () => {
    if (emailInput.classList.contains("invalid")) validate();
    hideStatus();
  });

  emailInput.addEventListener("blur", async () => {
    if (!validate()) return;
    const email = emailInput.value.trim();
    if (!emailRegex.test(email)) return;

    showStatus("Looking up account...");

    try {
      const res = await fetch("/lookup-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.found) {
        showStatus("No existing account found. Continue below.");
        return;
      }

      showStatus("Existing account found.", true);
      showFormCustomerPopup(data.customer);
    } catch (err) {
      if (DEBUG) console.log("[debug] form lookup error:", err);
      hideStatus();
    }
  });
}

function showFormCustomerPopup(customer) {
  document.getElementById("popup-customer-name").textContent = customer.name || "Customer";
  document.getElementById("popup-customer-email").textContent = customer.email;

  const popup = document.getElementById("customer-popup");
  const confirmBtn = document.getElementById("popup-confirm");
  const cancelBtn = document.getElementById("popup-cancel");
  confirmBtn.textContent = "Continue";
  confirmBtn.disabled = false;
  popup.classList.add("visible");

  const cleanup = () => {
    popup.classList.remove("visible");
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  };

  document.getElementById("popup-confirm").addEventListener("click", async () => {
    const btn = document.getElementById("popup-confirm");
    btn.textContent = "Attaching...";
    btn.disabled = true;

    try {
      const result = await actions.runServerUpdate(async () => {
        await fetch("/update-checkout-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            customerId: customer.id,
          }),
        });
      });

      if (result.type === "success") {
        updateFormSummary(result.session);
        const statusEl = document.getElementById("form-email-lookup-status");
        if (statusEl) {
          statusEl.textContent = `Signed in as ${customer.name || customer.email}.`;
          statusEl.classList.add("visible", "found");
        }
        const emailInput = document.getElementById("form-email-input");
        emailInput.disabled = true;
        emailInput.style.opacity = "0.5";
        if (customer.name) {
          const nameInput = document.getElementById("form-name-input");
          nameInput.value = customer.name;
        }
      }
    } catch (err) {
      if (DEBUG) console.log("[debug] form attach customer error:", err);
      showError("error-msg-form", "Failed to attach customer. Please try again.");
    }

    cleanup();
  });

  document.getElementById("popup-cancel").addEventListener("click", () => {
    cleanup();
    document.getElementById("form-email-input").focus();
    const statusEl = document.getElementById("form-email-lookup-status");
    if (statusEl) {
      statusEl.classList.remove("visible", "found");
      statusEl.textContent = "";
    }
  });
}

function updateFormSummary(session) {
  const subtotalEl = document.getElementById("form-summary-subtotal");
  const taxEl = document.getElementById("form-summary-tax");
  const taxRow = document.getElementById("form-summary-tax-row");
  const totalEl = document.getElementById("form-summary-total");
  const recurringEl = document.getElementById("form-summary-recurring");

  if (session.total) {
    subtotalEl.textContent = session.total.subtotal?.amount || "";
    totalEl.textContent = session.total.total?.amount || "";

    if (session.total.taxExclusive?.minorUnitsAmount > 0 ||
        session.total.taxInclusive?.minorUnitsAmount > 0) {
      const taxAmt = session.total.taxExclusive?.amount || session.total.taxInclusive?.amount || "";
      taxEl.textContent = taxAmt;
      taxRow.style.display = "flex";
    } else {
      taxRow.style.display = "none";
    }
  }

  if (session.recurring?.dueNext?.total?.amount) {
    recurringEl.textContent = session.recurring.dueNext.total.amount + "/mo";
  }
}

// Phase 1: Start checkout
document.getElementById("start-checkout-btn").addEventListener("click", async () => {
  hideError("error-msg-select");
  const btn = document.getElementById("start-checkout-btn");
  btn.classList.add("loading");
  btn.disabled = true;

  const overlay = document.getElementById("loading-overlay");
  overlay.classList.add("visible");

  try {
    const configRes = await fetch("/config");
    const { publishableKey } = await configRes.json();

    if (selectedMode === "form-lookup") {
      await initCheckoutForm(publishableKey, true);
    } else if (selectedMode === "elements-lookup") {
      await initElementsCheckout(publishableKey, true);
    } else {
      await initElementsCheckout(publishableKey, false);
    }

    overlay.classList.remove("visible");
  } catch (err) {
    overlay.classList.remove("visible");
    showError("error-msg-select", err.message);
    btn.classList.remove("loading");
    btn.disabled = false;
  }
});

// Phase 2: Confirm payment
document.getElementById("pay-btn").addEventListener("click", async () => {
  hideError("error-msg-pay");
  const nameInput = document.getElementById("name-input");
  const cardholderName = nameInput.value.trim();

  if (!cardholderName) {
    nameInput.classList.add("invalid");
    showError("error-msg-pay", "Please enter your full name.");
    return;
  }
  nameInput.classList.remove("invalid");

  const btn = document.getElementById("pay-btn");
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    sessionStorage.setItem("checkout_name", cardholderName);
    if (DEBUG) console.log("[debug] name stored in sessionStorage:", cardholderName);
    const { error } = await actions.confirm();
    if (error) {
      showError("error-msg-pay", error.message);
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  } catch (err) {
    showError("error-msg-pay", err.message || "Payment failed. Please try again.");
    btn.classList.remove("loading");
    btn.disabled = false;
  }
});

// Back buttons
document.getElementById("back-link").addEventListener("click", (e) => {
  e.preventDefault();
  showPhase("select");
  const btn = document.getElementById("start-checkout-btn");
  btn.classList.remove("loading");
  btn.disabled = false;
});

document.getElementById("back-link-form").addEventListener("click", (e) => {
  e.preventDefault();
  showPhase("select");
  const btn = document.getElementById("start-checkout-btn");
  btn.classList.remove("loading");
  btn.disabled = false;
});
