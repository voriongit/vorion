const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Try different model names
const modelsToTry = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',
  'claude-3-sonnet-20240229',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
  'claude-2.1',
  'claude-2.0',
  'claude-instant-1.2',
];

async function testModel(modelName) {
  try {
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    console.log(`✅ ${modelName} - WORKS!`);
    return true;
  } catch (error) {
    console.log(`❌ ${modelName} - Error: ${error.status} ${error.error?.error?.message || error.message}`);
    return false;
  }
}

async function testAllModels() {
  console.log('Testing Anthropic models with your API key...\n');

  for (const model of modelsToTry) {
    await testModel(model);
  }

  console.log('\n✨ Test complete!');
}

testAllModels();
