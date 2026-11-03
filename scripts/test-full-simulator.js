async function testFullSimulatorFlow() {
  const serverKey = "SB-Mid-server-xe5aO3OjbdphSt8YkiHwOaUD";
  const authHeader = "Basic " + Buffer.from(serverKey + ":").toString("base64");
  const orderId = "SELA-TEST-" + Date.now();

  console.log("Step 1: Charging QRIS on Midtrans Sandbox...");
  const chargeRes = await fetch("https://api.sandbox.midtrans.com/v2/charge", {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      payment_type: "qris",
      transaction_details: {
        order_id: orderId,
        gross_amount: 10000
      },
      qris: {
        acquirer: "gopay"
      }
    })
  });

  const chargeData = await chargeRes.json();
  console.log("Charge response:", chargeData.status_code, chargeData.status_message);
  console.log("Transaction ID:", chargeData.transaction_id);
  console.log("Actions:", JSON.stringify(chargeData.actions));
  console.log("QR String:", chargeData.qr_string);

  const qrUrl = chargeData.actions.find(a => a.name === "generate-qr-code").url;
  console.log("\nStep 2: Submitting qrCodeUrl to simulator...", qrUrl);

  const simStep1 = await fetch("https://simulator.sandbox.midtrans.com/qris/payment", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "qrCodeUrl=" + encodeURIComponent(qrUrl)
  });

  const htmlStep1 = await simStep1.text();
  console.log("Simulator Step 1 status:", simStep1.status);

  // Extract referenceId, qrString, and form action from htmlStep1
  const refIdMatch = htmlStep1.match(/name="referenceId"\s+type="hidden"\s+value="([^"]+)"/i);
  const qrStringMatch = htmlStep1.match(/name="qrString"\s+type="hidden"\s+value="([^"]+)"/i);
  const formActionMatch = htmlStep1.match(/<form[^>]*action="([^"]+)"[^>]*>/i);

  console.log("Extracted Reference ID:", refIdMatch ? refIdMatch[1] : "NONE");
  console.log("Extracted QR String:", qrStringMatch ? qrStringMatch[1].slice(0, 30) + "..." : "NONE");
  console.log("Extracted Form Action:", formActionMatch ? formActionMatch[1] : "NONE");

  if (formActionMatch && refIdMatch && qrStringMatch) {
    const actionUrl = formActionMatch[1].startsWith("http")
      ? formActionMatch[1]
      : "https://simulator.sandbox.midtrans.com/qris/" + formActionMatch[1];
    
    console.log("\nStep 3: Submitting payment to action URL:", actionUrl);
    
    // Test with issuer gopay
    const payParams = new URLSearchParams();
    payParams.append("referenceId", refIdMatch[1]);
    payParams.append("qrString", qrStringMatch[1]);
    payParams.append("issuer", "gopay");

    const simStep2 = await fetch(actionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payParams.toString()
    });

    console.log("Simulator Step 2 status:", simStep2.status);
    const htmlStep2 = await simStep2.text();
    
    // Look for success or failure text in htmlStep2
    console.log("\nSimulator Step 2 response snippet:");
    const bodyIdx = htmlStep2.indexOf('class="content-body"');
    if (bodyIdx !== -1) {
      console.log(htmlStep2.slice(bodyIdx, bodyIdx + 1200));
    } else {
      console.log(htmlStep2.slice(0, 1000));
    }

    // Step 4: Check transaction status in Midtrans Core API!
    console.log("\nStep 4: Checking transaction status in Midtrans Core API...");
    const statusRes = await fetch("https://api.sandbox.midtrans.com/v2/" + orderId + "/status", {
      headers: { "Authorization": authHeader }
    });
    const statusData = await statusRes.json();
    console.log("Status API result:", statusData.transaction_status, statusData.status_message);
  }
}

testFullSimulatorFlow().catch(console.error);

