// Test script to verify BFL API key works
require('dotenv').config();

const RUNWARE_API_BASE = 'https://api.runware.ai/v1';

// Hardcode the API key for testing (from your .env file)
const TEST_API_KEY = 'UWK3mRdD67zSY2i8XL0RZFWQfMYM78zR';

async function testBFLAPI() {
  const apiKey = TEST_API_KEY || process.env.RUNWARE_API_KEY || process.env.BFL_API_KEY;
  
  console.log('=== BFL API Key Test ===');
  console.log('API Key present:', !!apiKey);
  console.log('API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'NOT FOUND');
  
  if (!apiKey) {
    console.error('❌ ERROR: No API key found in environment variables');
    console.log('Please ensure .env file has BFL_API_KEY or RUNWARE_API_KEY');
    process.exit(1);
  }
  
  console.log('\n=== Testing Runware API ===');
  console.log('Endpoint:', RUNWARE_API_BASE);
  
  // Generate a valid UUIDv4
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  const body = {
    taskType: 'imageInference',
    taskUUID: generateUUID(),
    positivePrompt: 'a modern living room, interior design, professional photography',
    width: 512,
    height: 512,
    model: 'runware:400@4',
    numberResults: 1,
    outputType: 'URL',
    outputFormat: 'jpg',
    steps: 20,
    CFGScale: 7.5,
  };
  
  console.log('Request body:', JSON.stringify(body, null, 2));
  
  try {
    console.log('\nSending request...');
    const response = await fetch(RUNWARE_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify([body]),
    });
    
    console.log('Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      process.exit(1);
    }
    
    const data = await response.json();
    console.log('\n✅ API Response:', JSON.stringify(data, null, 2));
    
    // Try to extract image URL
    const root = Array.isArray(data) ? data[0] : data;
    const firstContainer = root?.data?.[0] ?? root?.tasks?.[0] ?? root;
    const firstResult = firstContainer?.results?.[0] ?? firstContainer?.output?.[0] ?? firstContainer;
    const imageUrl = firstResult?.url ?? firstResult?.imageURL ?? firstResult?.imageUrl ?? root?.imageURL;
    
    if (imageUrl) {
      console.log('\n🎉 SUCCESS! Image generated:');
      console.log('Image URL:', imageUrl);
    } else {
      console.log('\n⚠️  Response received but no image URL found');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    process.exit(1);
  }
}

testBFLAPI();
