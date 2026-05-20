require("dotenv").config();
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-03-25.dahlia",
});

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/config", (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

app.post("/create-checkout-session", async (req, res) => {
  const { countryCode } = req.body;
  const origin = req.headers.origin || "http://localhost:4242";

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: "elements",
      mode: "subscription",
      line_items: [
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
      ],
      automatic_tax: { enabled: true },
      adaptive_pricing: { enabled: true },
      tax_id_collection: { enabled: true },
      return_url: `${origin}/return.html?session_id={CHECKOUT_SESSION_ID}`,
    });

    res.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error("Checkout Session creation failed:", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.get("/session-status", async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription"],
    });
    res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      currency: session.currency,
      amountTotal: session.amount_total,
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
