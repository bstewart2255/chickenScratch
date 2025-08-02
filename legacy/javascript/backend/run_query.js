const pool = require('./db.js');

async function runQuery() {
  const query = `
    SELECT 
      signature_data->0->0->>'pressure' as sig_pressure,
      shape_data->'raw'->0->0->>'pressure' as shape_pressure
    FROM signatures s
    JOIN shapes sh ON s.user_id = sh.user_id
    LIMIT 5;
  `;

  try {
    console.log('Running query...');
    const result = await pool.query(query);
    
    console.log('\nQuery Results:');
    console.log('==============');
    
    if (result.rows.length === 0) {
      console.log('No results found.');
    } else {
      console.log('sig_pressure | shape_pressure');
      console.log('-------------|---------------');
      result.rows.forEach((row, index) => {
        console.log(`${row.sig_pressure || 'NULL'} | ${row.shape_pressure || 'NULL'}`);
      });
    }
    
    console.log(`\nTotal rows returned: ${result.rows.length}`);
    
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    await pool.end();
  }
}

runQuery(); 