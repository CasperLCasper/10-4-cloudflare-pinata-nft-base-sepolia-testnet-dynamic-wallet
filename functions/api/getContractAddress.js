export default function handler(req, res) {
  // Atļaujam tikai GET pieprasījumus
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    return res.status(500).json({ error: 'CONTRACT_ADDRESS not configured' });
  }

  res.status(200).json({ 
    address: contractAddress
  });
}
