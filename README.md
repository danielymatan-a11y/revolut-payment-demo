# Revolut Pay Integration Demo

## Overview

This project demonstrates a full integration of the **Revolut Pay Web Widget** using the **sandbox environment**.

It simulates a simple checkout flow where a user can enter a payment amount, initiate a payment, and track the payment status in real time.

The implementation includes both frontend and backend components, reflecting a realistic merchant integration scenario.

---

## Features

* Revolut Pay widget embedded in the frontend
* Backend order creation using Revolut Merchant API
* Real-time payment status tracking (polling)
* Support for different payment outcomes:

  * Successful payments
  * Failed payments
  * Cancelled payments
  * Authentication flows (3DS)
* Dynamic amount input (user-defined payment amount)
* Line items passed through the widget configuration
* Error handling displayed directly on the page
* Ability to retry or create a new payment

---

## Tech Stack

* **Backend:** Flask (Python)
* **Frontend:** HTML, Vanilla JavaScript
* **API Integration:** Revolut Merchant API (Sandbox)
* **Communication:** REST API (fetch)

---

## Project Structure

```
revolut-pay-integration-demo/
├── app.py                  # Flask backend (order creation, status, webhooks)
├── requirements.txt        # Python dependencies
├── templates/
│   └── index.html          # Frontend UI
├── static/
│   └── app.js              # Frontend logic (widget, polling, UI updates)
```

---

## How It Works

### 1. User Input

The user enters a payment amount in the UI.

### 2. Widget Initialization

When clicking "Start payment":

* The Revolut Pay widget is mounted
* Line items are generated based on the entered amount

### 3. Order Creation

The frontend calls the backend `/create-order` endpoint, which:

* Creates an order via Revolut Merchant API
* Returns a `token` and `order_id`

### 4. Payment Flow

* The widget handles payment interaction (including authentication if required)
* A popup window may open for payment authorization

### 5. Status Tracking

* The frontend polls `/order-status/<order_id>`
* The UI updates based on:

  * pending
  * authorised
  * captured (completed)
  * failed
  * cancelled
---

## Webhooks vs Polling

This implementation uses **polling** to track payment status instead of relying on webhooks.

This allows the application to run fully locally without requiring a public URL. This approach ensures the demo is easy to run without additional infrastructure.

A webhook endpoint is included in the backend for completeness, but it is **not required** to run or test the application.

Tools like ngrok or Cloudflare tunnels are only needed if you want to test webhook delivery from Revolut. 

---

## Revolut Sandbox Setup

To run this project, you need a Revolut Merchant Sandbox account.

1. Sign up at: https://sandbox-business.revolut.com
2. Create a Sandbox merchant account
   Further information can be found at https://developer.revolut.com/docs/guides/accept-payments/get-started/apply-for-a-merchant-account
3. Generate API keys:
   - Secret key
   - Public key

4. Add them to your `.env` file:

REVOLUT_SANDBOX_SECRET_KEY=your_secret_key
REVOLUT_SANDBOX_PUBLIC_KEY=your_public_key

## Demo Payment Setup Instructions

### 1. Clone the project

```bash
git clone <your-repo-url>
cd revolut-pay-integration-demo
```

### 2. Create a virtual environment

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows**
python -m venv .venv
.venv\Scripts\activate

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the root directory:

```
REVOLUT_SANDBOX_SECRET_KEY=your_secret_key
REVOLUT_SANDBOX_PUBLIC_KEY=your_public_key
```

You can obtain these from the Revolut Sandbox Business account.

---

### 5. Run the application

```bash
python app.py
```

Then open:

```
http://localhost:5000
```

---

## Testing the Integration

You can test different payment scenarios using Revolut’s sandbox environment:

* Successful payment
* Failed payment
* Cancelled payment
* Authentication challenge (3DS)

The UI will reflect each scenario accordingly.

---

## Notes

* This project uses the **sandbox environment only**
* No real payments are processed
* Line items are included as structured order data and passed to the widget
* The widget handles payment interaction, while the backend manages order lifecycle

---

## Key Learnings during the project

While building the integration, I encountered several challenges that helped me better understand payment systems end-to-end.

I initially faced issues with request validation and payload structure, particularly around handling amounts in minor units and aligning frontend and backend schemas for line items.

One key learning was the importance of tracing requests across layers. By adding structured logging, I was able to identify whether issues originated from the frontend, backend, or the API itself.

I also explored A2A-specific error scenarios using Revolut’s testing flows, which gave me insight into how different payment states and decline reasons are triggered and handled.

Additionally, I improved the user experience by clarifying the “Pay Again” flow, ensuring users understand when a new order is created versus retrying a failed payment.

Overall, the process helped me develop a much clearer mental model of how payment orchestration works across UI, backend services, and external APIs.


---

## Possible Improvements

* Replace polling with webhook-driven updates (Requires a public webhook URL e.g. Cloudflare tunnel for free public URLs)
* Add multi-item cart support
* Improve UI/UX design

---

## Author

Matan Joel Daniely

---

## License

This project is for demonstration and educational purposes.
