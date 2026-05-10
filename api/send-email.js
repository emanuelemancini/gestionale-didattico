export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html } = req.body;
  
  if (!to || !to.length || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const API_KEY = process.env.RESEND_API_KEY;

  if (!API_KEY || API_KEY.startsWith('re_placeholder')) {
    // In dev o senza chiave, simuliamo l'invio
    console.log('[DEV] Simulazione invio email a:', to);
    return res.status(200).json({ success: true, simulated: true, id: 'simulated_' + Date.now() });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Gestionale Didattico <onboarding@resend.dev>',
        to: to, // array di email
        subject: subject,
        html: html
      })
    });

    const data = await response.json();

    if (response.ok) {
      res.status(200).json({ success: true, data });
    } else {
      res.status(400).json({ success: false, error: data });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
