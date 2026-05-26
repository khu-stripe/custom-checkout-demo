# Custom Checkout Demo

A subscription checkout page with three integration modes that users can toggle in Phase 1:

1. **Custom Checkout (Elements)** -- Compose individual Stripe Elements (Payment Element, Express Checkout, Currency Selector, Tax ID) for maximum control over layout
2. **Elements + Customer Lookup** -- Same as Elements, but looks up existing Stripe customers by email and attaches them mid-checkout via `runServerUpdate`, prefilling the name field. The email field is disabled after a customer is attached. Saved payment methods are not displayed.
3. **Checkout Form + Customer Lookup** -- End-to-end checkout in a single Stripe iframe with email and name inputs above the form. Looks up existing customers by email, attaches them mid-checkout, and prefills the name. The email field is disabled after attachment. Saved payment methods are not displayed.

All three modes use the same product (Luminary Membership, $299/mo subscription) with adaptive pricing, automatic tax, and tax ID collection. Both lookup modes share the same popup confirmation flow and reuse the `/lookup-customer` and `/update-checkout-customer` endpoints. Sessions are created with `saved_payment_method_options.allow_redisplay_filters: []` to prevent saved payment methods from appearing in the checkout UI.

**Live demo**: https://checkout-demo-silk.vercel.app

## Stripe APIs

| API | Method | Purpose |
|---|---|---|
| [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create) | `POST /v1/checkout/sessions` | Create a session with `ui_mode: "custom"` (Elements) or `ui_mode: "form"` (Checkout Form) |
| [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/update) | `POST /v1/checkout/sessions/:id` | Update the session customer mid-checkout (used by Customer Lookup mode) |
| [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/retrieve) | `GET /v1/checkout/sessions/:id` | Retrieve session status after payment, with `expand: ["subscription"]` |
| [Customers](https://docs.stripe.com/api/customers/list) | `GET /v1/customers` | List customers by email for lookup |

### Integration Mode: Custom Checkout (Elements)

Session created with `ui_mode: "custom"` (clover API version).

| Element | Method | Purpose |
|---|---|---|
| [Payment Element](https://docs.stripe.com/js/custom_checkout/payment_element) | `checkout.createPaymentElement()` | Card and alternative payment method inputs |
| [Express Checkout Element](https://docs.stripe.com/js/custom_checkout/express_checkout_element) | `checkout.createExpressCheckoutElement()` | Apple Pay and Google Pay buttons |
| [Currency Selector Element](https://docs.stripe.com/js/custom_checkout/currency_selector_element) | `checkout.createCurrencySelectorElement()` | Customer currency switching with adaptive pricing |
| [Tax ID Element](https://docs.stripe.com/js/custom_checkout/tax_id_element) | `checkout.createTaxIdElement()` | Business tax ID input |

### Integration Mode: Elements + Customer Lookup

Uses the same Elements setup as above, plus client-side email lookup on blur. When an existing Stripe Customer is found, a confirmation popup appears. On confirmation, `actions.runServerUpdate()` calls the server to attach the customer to the checkout session. The customer's name is prefilled automatically if available. The email field is disabled after attachment to prevent changes. See [Update the customer during checkout](https://docs.stripe.com/payments/checkout/update-customer).

### Integration Mode: Checkout Form + Customer Lookup

Session created with `ui_mode: "form"` and API version `2026-04-22.preview; custom_checkout_payment_form_preview=v1`.

The Checkout Form renders a complete checkout experience in a single iframe, handling payment details, billing address, tax ID, express wallets, and confirmation. An email input and a full name input sit above the form. On email blur, the same customer lookup and popup flow is triggered. After a customer is attached, the email field is disabled and the name is prefilled. See [Checkout Form docs](https://docs.stripe.com/payments/checkout/how-checkout-works?payment-ui=checkout-form) and [Update the customer during checkout](https://docs.stripe.com/payments/checkout/update-customer).

## Project structure

```
.
├── api/
│   ├── config.js                       GET  /config
│   ├── create-checkout-session.js      POST /create-checkout-session (Elements)
│   ├── create-checkout-form-session.js POST /create-checkout-form-session (Form)
│   ├── lookup-customer.js             POST /lookup-customer
│   ├── update-checkout-customer.js    POST /update-checkout-customer
│   └── session-status.js               GET  /session-status
├── public/
│   ├── index.html                      Checkout page
│   └── return.html                     Post-payment confirmation page
├── server.js                           Express server for local development
├── vercel.json                         Vercel routing + outputDirectory config
└── package.json
```

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your Stripe test keys
3. `npm install`
4. `node server.js`
5. Open http://localhost:4242

## Deployment

Deployed on Vercel as serverless functions. The `api/` directory contains the serverless endpoints and `vercel.json` rewrites the paths to their respective functions. Static files are served from the project root.

Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` as environment variables in the Vercel dashboard.
