import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

// In-memory store — reset bila server restart
// Untuk persistent, guna Vercel KV atau Supabase nanti
const claimed = new Set();

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { walletAddress } = req.body;

    // Validate
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address diperlukan.' });
    }

    // Check already claimed
    if (claimed.has(walletAddress)) {
      return res.status(400).json({ error: 'Wallet ini dah claim. Satu wallet satu claim je.' });
    }

    // Validate Solana address
    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(walletAddress);
    } catch {
      return res.status(400).json({ error: 'Wallet address tidak sah.' });
    }

    // Load treasury keypair dari env
    const privateKeyEnv = process.env.TREASURY_PRIVATE_KEY;
    if (!privateKeyEnv) {
      console.error('TREASURY_PRIVATE_KEY not set');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    let treasury;
    try {
      const keyArray = JSON.parse(privateKeyEnv);
      treasury = Keypair.fromSecretKey(Uint8Array.from(keyArray));
    } catch {
      console.error('Invalid keypair format');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    // Connect devnet
    const connection = new Connection(
      'https://api.devnet.solana.com',
      'confirmed'
    );

    // Check treasury balance
    const balance = await connection.getBalance(treasury.publicKey);
    const required = 0.05 * LAMPORTS_PER_SOL + 5000; // 0.05 SOL + fee

    if (balance < required) {
      return res.status(503).json({ error: 'Faucet kehabisan SOL. Hubungi admin Nexum.' });
    }

    // Build transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasury.publicKey,
        toPubkey: recipientPubkey,
        lamports: Math.floor(0.05 * LAMPORTS_PER_SOL),
      })
    );

    // Send
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [treasury],
      { commitment: 'confirmed' }
    );

    // Mark as claimed
    claimed.add(walletAddress);

    console.log(`Sent 0.05 SOL to ${walletAddress} | tx: ${signature}`);

    return res.status(200).json({
      success: true,
      signature,
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });

  } catch (err) {
    console.error('Faucet error:', err);
    return res.status(500).json({ error: 'Transaksi gagal. Cuba lagi.' });
  }
}
