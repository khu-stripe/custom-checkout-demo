const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id");

function formatCurrency(amount, currency) {
  try {
    return (amount / 100).toLocaleString("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    });
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

if (sessionId) {
  const storedName = sessionStorage.getItem("checkout_name") || "";
  const statusUrl = `/session-status?session_id=${sessionId}` + (storedName ? `&customer_name=${encodeURIComponent(storedName)}` : "");
  fetch(statusUrl)
    .then((r) => r.json())
    .then((data) => {
      if (data.error) {
        document.getElementById("subtitle").textContent =
          "Could not load session details.";
        return;
      }

      const isComplete = data.status === "complete";

      document.getElementById("title").textContent = isComplete
        ? "Welcome aboard"
        : "Session open";

      document.getElementById("subtitle").textContent = isComplete
        ? "Your Mindvalley Membership subscription is now active."
        : "The checkout session is still open. Payment may be pending.";

      if (!isComplete) {
        const icon = document.getElementById("status-icon");
        icon.classList.remove("success");
        icon.classList.add("pending");
      }

      const details = document.getElementById("details");
      details.style.display = "block";

      let rows = [];

      if (data.customerEmail) {
        rows.push(["Email", data.customerEmail]);
      }

      if (data.currency && data.amountTotal != null) {
        rows.push([
          "Amount",
          `<span class="detail-value currency">${formatCurrency(data.amountTotal, data.currency)}</span>`,
        ]);
      }

      if (
        data.presentmentDetails &&
        data.presentmentDetails.presentment_currency &&
        data.presentmentDetails.presentment_currency !== data.currency
      ) {
        const pc = data.presentmentDetails.presentment_currency;
        const pa = data.presentmentDetails.presentment_amount;
        if (pa != null) {
          rows.push([
            "Customer paid",
            `<span class="detail-value currency">${formatCurrency(pa, pc)}</span>`,
          ]);
        }
      }

      if (data.subscriptionId) {
        rows.push(["Subscription", data.subscriptionId]);
        rows.push([
          "Status",
          `<span class="detail-value active">${data.subscriptionStatus || "active"}</span>`,
        ]);
      } else {
        rows.push([
          "Payment",
          `<span class="detail-value active">${data.paymentStatus || data.status}</span>`,
        ]);
      }

      details.innerHTML = rows
        .map(
          ([label, value]) =>
            `<div class="detail-row"><span class="detail-label">${label}</span>${
              value.startsWith("<")
                ? value
                : `<span class="detail-value">${value}</span>`
            }</div>`
        )
        .join("");
    })
    .catch(() => {
      document.getElementById("subtitle").textContent =
        "Subscription created successfully.";
    });
} else {
  document.getElementById("subtitle").textContent =
    "Your subscription is now active.";
}
