export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: 'Wallet address diperlukan.' });

    const rpcUrl = process.env.HELIUS_RPC_URL;
    if (!rpcUrl) return res.status(500).json({ error: 'Server config error.' });

    const rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'requestAirdrop',
        params: [walletAddress, 50000000]
      })
    });

    const data = await rpcRes.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    return res.status(200).json({
      success: true,
      signature: data.result
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Gagal: ' + err.message });
  }
}
