from flask import Flask, request, jsonify, render_template
import requests
import os
from dotenv import load_dotenv


# -----------------------
# App setup and config
# -----------------------
load_dotenv()
app = Flask(__name__)

API_BASE = "https://sandbox-merchant.revolut.com"
API_VERSION = "2025-12-04"
SECRET_KEY = os.getenv("REVOLUT_SANDBOX_SECRET_KEY")
PUBLIC_KEY = os.getenv("REVOLUT_SANDBOX_PUBLIC_KEY")
WEBHOOK_PUBLIC_URL = "https://transit-wolf-agricultural-avatar.trycloudflare.com/webhook"


# -----------------------
# Shared temporary state
# -----------------------
order_status_store = {}


# -----------------------
# Frontend route
# -----------------------
@app.route("/")
def home():
    return render_template("index.html", public_key=PUBLIC_KEY)


# -----------------------
# Order routes
# -----------------------
@app.route("/create-order", methods=["POST"])
def create_order():
    try:
        data = request.get_json(silent=True) or {}
        print("Incoming create-order data:", data)

        amount = int(data.get("amount", 0))

        if amount <= 0:
            return jsonify({"error": "Invalid amount"}), 400

        url = f"{API_BASE}/api/orders"

        payload = {
            "amount": amount,
            "currency": "GBP",
            "line_items": [
                {
                    "name": "Demo payment",
                    "type": "service",
                    "quantity": {
                        "value": 1,
                        "unit": "item"
                    },
                    "unit_price_amount": amount,
                    "total_amount": amount,
                    "description": "Test payment created from demo checkout"
                }
            ]
        }

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Revolut-Api-Version": API_VERSION,
            "Authorization": f"Bearer {SECRET_KEY}"
        }

        response = requests.post(url, headers=headers, json=payload, timeout=20)

        print("Revolut status:", response.status_code)
        print("Revolut raw body:", response.text)

        revolut_data = response.json()

        if response.status_code not in (200, 201):
            return jsonify({
                "error": "Revolut order creation failed",
                "revolut_status": response.status_code,
                "revolut_response": revolut_data
            }), response.status_code

        order_id = revolut_data.get("id")
        order_state = revolut_data.get("state", "pending")

        if order_id:
            order_status_store[order_id] = order_state

        return jsonify({
            "order_id": order_id,
            "token": revolut_data.get("token")
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/order-status/<order_id>", methods=["GET"])
def order_status(order_id):
    try:
        url = f"{API_BASE}/api/orders/{order_id}"
        headers = {
            "Accept": "application/json",
            "Revolut-Api-Version": API_VERSION,
            "Authorization": f"Bearer {SECRET_KEY}"
        }

        response = requests.get(url, headers=headers, timeout=20)
        revolut_data = response.json()

        print("Retrieve order status:", response.status_code, revolut_data)

        if response.status_code != 200:
            return jsonify({
                "error": "Failed to fetch order status",
                "revolut_status": response.status_code,
                "revolut_response": revolut_data
            }), 502

        status = revolut_data.get("state", "unknown")

        payments = revolut_data.get("payments", []) or []
        latest_payment = payments[0] if payments else {}

        payment_state = latest_payment.get("state")
        decline_reason = latest_payment.get("decline_reason")

        return jsonify({
            "order_id": order_id,
            "status": status,
            "payment_state": payment_state,
            "decline_reason": decline_reason,
            "line_items": revolut_data.get("line_items", [])
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------
# Webhook routes
# -----------------------
@app.route("/webhook", methods=["POST"])
def webhook():
    try:
        payload = request.get_json(silent=True) or {}
        print("Webhook payload:", payload)

        event = payload.get("event")
        data = payload.get("data", {}) or {}

        order_id = data.get("id") or payload.get("order_id")

        if order_id:
            if event == "ORDER_COMPLETED":
                order_status_store[order_id] = "completed"
            elif event == "ORDER_AUTHORISED":
                order_status_store[order_id] = "authorised"
            elif event in ("ORDER_PAYMENT_FAILED", "ORDER_PAYMENT_DECLINED", "ORDER_FAILED"):
                order_status_store[order_id] = "failed"
            elif event == "ORDER_CANCELLED":
                order_status_store[order_id] = "cancelled"

        return jsonify({"received": True}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/webhook-url", methods=["GET"])
def webhook_url():
    return jsonify({
        "webhook_url": WEBHOOK_PUBLIC_URL
    }), 200


@app.route("/register-webhook", methods=["POST"])
def register_webhook():
    try:
        url = f"{API_BASE}/api/webhooks"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Revolut-Api-Version": API_VERSION,
            "Authorization": f"Bearer {SECRET_KEY}"
        }

        payload = {
            "url": WEBHOOK_PUBLIC_URL,
            "events": [
                "ORDER_COMPLETED",
                "ORDER_PAYMENT_FAILED",
                "ORDER_PAYMENT_DECLINED",
                "ORDER_CANCELLED",
                "ORDER_FAILED",
                "ORDER_AUTHORISED"
            ]
        }

        response = requests.post(url, headers=headers, json=payload, timeout=20)
        return jsonify(response.json()), response.status_code

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------
# App runner
# -----------------------
if __name__ == "__main__":
    app.run(debug=True)