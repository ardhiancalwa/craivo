async function inspectForm() {
  const qrUrl = "https://api.sandbox.midtrans.com/v2/qris/0e1c9905-834a-43d8-baea-c82704f2962b/qr-code";
  const res = await fetch("https://simulator.sandbox.midtrans.com/qris/payment", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "qrCodeUrl=" + encodeURIComponent(qrUrl)
  });
  const html = await res.text();
  const formStart = html.indexOf("<form");
  const formEnd = html.indexOf("</form>");
  console.log("FORM HTML:\n", html.slice(formStart, formEnd + 7));
}
inspectForm().catch(console.error);

