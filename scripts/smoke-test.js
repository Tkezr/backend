(async () => {
  const BASE = process.env.BASE_URL || 'http://localhost:4000/api';
  console.log('Smoke test target:', BASE);

  try {
    const h = await fetch(`${BASE}/health`);
    console.log('/health', h.status, await h.json());

    const ask = await fetch(`${BASE}/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Give a short legal summary for a sample contract.' }),
    });
    console.log('/ai/ask', ask.status, await ask.json());

    // Get docs
    const docs = await fetch(`${BASE}/pdf/get-docs`);
    console.log('/pdf/get-docs', docs.status, await docs.json());

    console.log('Smoke test completed.');
  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exitCode = 2;
  }
})();
