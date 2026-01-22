// netlify/functions/chat.js
exports.handler = async (event) => {
  // 自分のAPIキーをNetlifyの設定から読み込む（後述）
  const API_KEY = process.env.GEMINI_API_KEY; 
  
  const body = JSON.parse(event.body);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: body.prompt }] }]
      })
    });

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};
