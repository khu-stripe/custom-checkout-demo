require("dotenv").config();
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/config", (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

const LINE_ITEMS = [
  {
    price_data: {
      currency: "usd",
      product_data: {
        name: "Luminary Membership",
        description:
          "Unlimited access to 100+ personal growth programs, daily meditations, and a global community.",
      },
      unit_amount: 29900,
      recurring: { interval: "month" },
    },
    quantity: 1,
  },
];

app.post("/create-checkout-session", async (req, res) => {
  const origin = req.headers.origin || "http://localhost:4242";

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: "elements",
      mode: "subscription",
      line_items: LINE_ITEMS,
      automatic_tax: { enabled: true },
      adaptive_pricing: { enabled: true },
      tax_id_collection: { enabled: true },
      return_url: `${origin}/return.html?session_id={CHECKOUT_SESSION_ID}`,
    });

    res.json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (err) {
    console.error("Checkout Session creation failed:", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post("/create-checkout-form-session", async (req, res) => {
  const origin = req.headers.origin || "http://localhost:4242";

  try {
    const session = await stripe.checkout.sessions.create(
      {
        ui_mode: "form",
        mode: "subscription",
        line_items: LINE_ITEMS,
        automatic_tax: { enabled: true },
        adaptive_pricing: { enabled: true },
        tax_id_collection: { enabled: true },
        return_url: `${origin}/return.html?session_id={CHECKOUT_SESSION_ID}`,
      },
      {
        apiVersion:
          "2026-04-22.dahlia; custom_checkout_payment_form_preview=v1",
      }
    );

    res.json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (err) {
    console.error("Checkout Form session creation failed:", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post("/lookup-customer", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });

  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return res.json({ found: false });
    }

    const customer = customers.data[0];
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      limit: 10,
    });

    res.json({
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        savedPaymentMethods: paymentMethods.data.length,
      },
    });
  } catch (err) {
    console.error("Customer lookup failed:", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post("/update-checkout-customer", async (req, res) => {
  const { sessionId, customerId } = req.body;
  if (!sessionId || !customerId) {
    return res.status(400).json({ error: "Missing sessionId or customerId" });
  }

  try {
    const session = await stripe.checkout.sessions.update(sessionId, {
      customer: customerId,
    });
    res.json({ ok: true, sessionId: session.id });
  } catch (err) {
    console.error("Update checkout customer failed:", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.get("/session-status", async (req, res) => {
  const { session_id, customer_name } = req.query;
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription"],
    });

    if (session.status === "complete" && session.customer) {
      const name = customer_name || session.customer_details?.name;
      const email = session.customer_details?.email;
      if (name || email) {
        await stripe.customers.update(session.customer, {
          ...(name && { name }),
          ...(email && { email }),
        });
      }
    }

    res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      currency: session.currency,
      amountTotal: session.amount_total,
      customerName: session.customer_details?.name,
      customerEmail: session.customer_details?.email,
      presentmentDetails: session.presentment_details,
      subscriptionId: session.subscription?.id,
      subscriptionStatus: session.subscription?.status,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () =>
  console.log(`Luminary Checkout Demo running at http://localhost:${PORT}`)
);
