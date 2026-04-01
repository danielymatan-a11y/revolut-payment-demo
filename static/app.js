//The code follows the following logic:
// 1. wait for DOM to load
// 2. grab DOM elements
// 3. define state  variables 
// 4. defin helper functions
// 5. define main async/pyment functions 
// 6. attach event listenes at the end 

// Wait until the HTML document is fully loaded before running the script
window.addEventListener('DOMContentLoaded', () => {

  // Get references to UI elements from the Document Object Model (DOM)
  const statusEl = document.getElementById('status'); // where we display payment status messages
  const amountEl = document.getElementById('amount'); // input field for user amount
  const loadButton = document.getElementById('load-widget-btn'); // button to start payment
  const payAgainButton = document.getElementById('pay-again-btn'); // button to retry or create new payment
  const targetEl = document.getElementById('revolut-pay'); // container where Revolut widget will be mounted

  // Variables to keep track of runtime state
  let revolutPayInstance = null; // stores the Revolut Pay SDK instance (to avoid reloading it)
  let currentOrderId = null; // stores the current order ID from backend
  let pollInterval = null; // stores polling interval ID (used for checking payment status)

  // Stops polling if it's running
  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval); // stop interval
      pollInterval = null; // reset variable
    }
  }

  // Resets UI before starting a new payment flow
  function resetCheckoutUI() {
    stopPolling(); // stop any ongoing polling
    currentOrderId = null; // clear order ID
    targetEl.innerHTML = ''; // remove previous widget from DOM
    statusEl.textContent = ''; // clear status text
    if (payAgainButton) {
      payAgainButton.style.display = 'none'; // hide retry button
      payAgainButton.textContent = ''; // clear button text
    }
  }

  // Displays "Try again" or "Make another payment" button based on result
  function showActionButton(type) {
    if (!payAgainButton) return;

    if (type === 'success') {
      payAgainButton.textContent = 'Make another payment';
    } else {
      payAgainButton.textContent = 'Try again';
    }

    payAgainButton.style.display = 'inline-block'; // show button
  }

  // Cleans user input (ensures only numbers and one decimal point)
  function sanitizeAmountInput(value) {
    let cleaned = value.replace(',', '.'); // convert comma to dot
    cleaned = cleaned.replace(/[^0-9.]/g, ''); // remove non-numeric characters

    // Ensure only one decimal point exists
    const firstDotIndex = cleaned.indexOf('.');
    if (firstDotIndex !== -1) {
      const beforeDot = cleaned.slice(0, firstDotIndex + 1);
      const afterDot = cleaned.slice(firstDotIndex + 1).replace(/\./g, '');
      cleaned = beforeDot + afterDot;
    }

    return cleaned;
  }

  // Converts user input to minor units (e.g., pounds → pence)
  function getAmountMinor() {
    const rawValue = amountEl.value.trim().replace(',', '.'); // normalize input
    const amountMajor = parseFloat(rawValue); // convert to number

    // Validate input
    if (!rawValue || Number.isNaN(amountMajor) || amountMajor <= 0) {
      throw new Error('Please enter a valid positive amount, for example 10.02');
    }

    return Math.round(amountMajor * 100); // convert to minor units
  }

  // Builds line items required by Revolut API
  function buildLineItems(amountMinor) {
    return [
      {
        name: 'Demo payment',
        totalAmount: String(amountMinor), // total in minor units (string format required)
        unitPriceAmount: String(amountMinor),
        quantity: {
          value: 1,
          unit: 'PIECES'
        },
        type: 'SERVICE',
        description: 'Test payment created from demo checkout'
      }
    ];
  }

  // Renders order summary UI for the user
  function renderOrderSummary(items, totalAmount) {
    const summaryEl = document.getElementById('order-summary');
    if (!summaryEl) return;

    // Create HTML rows for each item
    const rows = items.map(item => {
      const qty = item.quantity?.value ?? 1;
      const total = Number(item.totalAmount) / 100; // convert back to major units

      return `
        <div style="margin-bottom: 8px;">
          <strong>${item.name}</strong><br>
          Quantity: ${qty}<br>
          Total: £${total.toFixed(2)}
        </div>
      `;
    }).join('');

    // Insert into DOM
    summaryEl.innerHTML = `
      <h3>Order Summary</h3>
      ${rows}
      <p><strong>Grand Total: £${(totalAmount / 100).toFixed(2)}</strong></p>
    `;
  }

  // Sanitize input as user types
  amountEl.addEventListener('input', () => {
    amountEl.value = sanitizeAmountInput(amountEl.value);
  });

  // Prevent invalid keys like "e", "+", "-"
  amountEl.addEventListener('keydown', (event) => {
    if (['-', '+', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
    }
  });

  // Poll backend every 3 seconds to check payment status
  function startPolling() {
    stopPolling(); // ensure no duplicate polling

    pollInterval = setInterval(async () => {
      if (!currentOrderId) return;

      try {
        const response = await fetch(`/order-status/${currentOrderId}`); // call backend
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch order status');
        }

        const status = data.status;
        const paymentState = data.payment_state;
        const declineReason = data.decline_reason;

        console.log('Order status response:', data);

        // Success states
        if (status === 'completed' || paymentState === 'completed' || status === 'authorised') {
          statusEl.textContent =
            '✅ Payment completed successfully. Click "Make another payment" to create a new order.';
          stopPolling();
          showActionButton('success');

        // Failure states
        } else if (paymentState === 'declined' || status === 'failed') {
          statusEl.textContent =
            `❌ Payment failed${declineReason ? `: ${declineReason}` : ''}. Click "Try again" to create a new payment attempt.`;
          stopPolling();
          showActionButton('failed');

        // Cancel state
        } else if (status === 'cancelled') {
          statusEl.textContent =
            '⚠️ Payment cancelled. Click "Try again" to start a new payment.';
          stopPolling();
          showActionButton('cancelled');

        // Still pending
        } else {
          statusEl.textContent = `Waiting for payment... Current status: ${paymentState || status}`;
        }

      } catch (err) {
        console.error('Polling error:', err);
        statusEl.textContent = `❌ Error while checking payment status: ${err.message}`;
        stopPolling();
        showActionButton('failed');
      }
    }, 3000); // run every 3 seconds
  }

  // Initialize Revolut SDK (only once)
  async function getRevolutPayInstance() {
    if (typeof RevolutCheckout === 'undefined') {
      throw new Error('RevolutCheckout SDK is not loaded');
    }

    if (!revolutPayInstance) {
      const { revolutPay } = await RevolutCheckout.payments({
        publicToken: window.REVOLUT_PUBLIC_KEY, // public key from backend/env
        locale: 'en',
        mode: 'sandbox' // using sandbox environment
      });

      revolutPayInstance = revolutPay;
    }

    return revolutPayInstance;
  }

  // Main function that mounts the payment widget
  async function mountPaymentWidget() {
    try {
      resetCheckoutUI(); // reset UI before starting

      const amountMinor = getAmountMinor(); // get validated amount
      const lineItems = buildLineItems(amountMinor); // build items
      renderOrderSummary(lineItems, amountMinor); // show summary

      statusEl.textContent = 'Loading Revolut Pay...';

      const revolutPay = await getRevolutPayInstance(); // initialize SDK

      // Clean previous widget if exists
      if (typeof revolutPay.destroy === 'function') {
        try {
          revolutPay.destroy();
        } catch (error) {
          console.warn('Previous widget destroy skipped:', error);
        }
      }

      // Mount widget into DOM
      revolutPay.mount(targetEl, {
        currency: 'GBP',
        totalAmount: amountMinor,
        lineItems,

        // Called by Revolut when user starts payment
        createOrder: async () => {
          console.log('Sending amountMinor to backend:', amountMinor);

          const response = await fetch('/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amountMinor })
          });

          const data = await response.json();
          console.log('Create-order response:', data);

          if (!response.ok) {
            const backendMessage =
              data?.revolut_response?.message ||
              data?.error ||
              'Failed to create order';

            throw new Error(backendMessage);
          }

          if (!data.token || !data.order_id) {
            throw new Error('Order was created but token or order_id is missing');
          }

          currentOrderId = data.order_id; // store order ID
          statusEl.textContent = `🧾 Order created: ${data.order_id}. Waiting for payment...`;
          startPolling(); // start polling status

          return { publicId: data.token }; // return token to Revolut widget
        },

        // Called when payment is submitted
        onSuccess() {
          statusEl.textContent = '⏳ Payment submitted. Confirming final status...';
          startPolling();
        },

        // Called when error occurs
        onError(error) {
          console.error('Revolut Pay error:', error);
          statusEl.textContent =
            '❌ Payment failed. Click "Try again" to create a new payment attempt.';
          stopPolling();
          showActionButton('failed');
        },

        // Called when user cancels payment
        onCancel() {
          statusEl.textContent =
            '⚠️ Payment cancelled. Click "Try again" to start a new payment.';
          stopPolling();
          showActionButton('cancelled');
        }
      });

      statusEl.textContent = 'Revolut Pay loaded. Click the button to continue.';

    } catch (err) {
      console.error('Widget error:', err);
      statusEl.textContent = `❌ ${err.message}`;
      showActionButton('failed');
    }
  }

  // Button click → load widget
  loadButton.addEventListener('click', async () => {
    await mountPaymentWidget();
  });

  // Retry / new payment button
  payAgainButton.addEventListener('click', async () => {
    await mountPaymentWidget();
  });
});