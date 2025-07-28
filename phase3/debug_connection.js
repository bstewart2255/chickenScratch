const { Client } = require('pg');

async function debugConnection() {
  const connectionString = process.env.DATABASE_URL || 
    'postgresql://signature_auth_dev_user:cKfLaS3d6nW5JvJCLBMUOsLNFUwr7EkB@dpg-ct27tjpopnds739fr3kg-a.oregon-postgres.render.com/signature_auth_dev';
  
  console.log('Connection string:', connectionString.replace(/:[^:@]*@/, ':****@'));
  
  // Try different SSL configurations
  const sslConfigs = [
    { rejectUnauthorized: false },
    { rejectUnauthorized: true },
    true,
    false
  ];
  
  for (const sslConfig of sslConfigs) {
    console.log(`\nTrying SSL config:`, sslConfig);
    
    const client = new Client({
      connectionString,
      ssl: sslConfig,
      connectionTimeoutMillis: 5000,
    });
    
    try {
      await client.connect();
      console.log('✅ Connected successfully!');
      
      const result = await client.query('SELECT version()');
      console.log('PostgreSQL version:', result.rows[0].version);
      
      await client.end();
      return; // Success, exit
      
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      if (error.code) console.error('Error code:', error.code);
    }
  }
  
  // Try with explicit host/port
  console.log('\nTrying with explicit host configuration...');
  const url = new URL(connectionString);
  
  const client = new Client({
    host: url.hostname,
    port: url.port || 5432,
    database: url.pathname.slice(1),
    user: url.username,
    password: url.password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  
  try {
    console.log('Connecting to:', url.hostname, 'port:', url.port || 5432);
    await client.connect();
    console.log('✅ Connected with explicit config!');
    await client.end();
  } catch (error) {
    console.error('❌ Explicit config also failed:', error.message);
    
    // Check if it's a network issue
    if (error.code === 'ENOTFOUND') {
      console.error('\n🔍 DNS resolution failed. The hostname cannot be resolved.');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n🔍 Network timeout/refused. Possible causes:');
      console.error('   - Database is sleeping (free tier)');
      console.error('   - Firewall blocking connection');
      console.error('   - Database credentials changed');
    }
  }
}

debugConnection().catch(console.error);