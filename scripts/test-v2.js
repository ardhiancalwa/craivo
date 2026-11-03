async function testV2() {
  const v2Url = "https://merchants-app.sbx.midtrans.com/v4/qris/gopay/A120261103173025ospKOtQawFID/qr-code";
  const sim = await fetch("https://simulator.sandbox.midtrans.com/qris/payment", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "qrCodeUrl=" + encodeURIComponent(v2Url)
  });
  console.log("Sim with v2 URL status:", sim.status);
  const text = await sim.text();
  console.log(text.slice(text.indexOf('class="content-body"'), text.indexOf('class="content-body"') + 500));
}
testV2().catch(console.error);

