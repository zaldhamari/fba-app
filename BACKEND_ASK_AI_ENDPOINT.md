# Backend: Add /ai/ask Endpoint

Add this route to your fba-backend Express app (in whichever file handles your `/ai` routes):

```javascript
// POST /api/ai/ask
router.post('/ask', async (req, res) => {
  try {
    const { question, context } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required' });
    }

    const systemPrompt = `You are an expert Amazon FBA and e-commerce advisor. 
Answer the user's question concisely and practically. 
Focus on actionable advice. Keep responses under 200 words.
If the user provides product context, factor it into your answer.`;

    const userMessage = context
      ? `Context: ${context}\n\nQuestion: ${question}`
      : question;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const answer = response.choices[0]?.message?.content?.trim() ?? 'No response generated.';
    res.json({ answer });
  } catch (error) {
    console.error('[ai/ask]', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});
```

Deploy this to Railway by pushing to your GitHub repo.
